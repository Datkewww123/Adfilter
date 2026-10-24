import { ext } from '../platform/api';
import { log } from '../core/log';
import { initialState, step, type DetectorState } from '../core/detector';
import { plan, type ActionType } from '../core/intervention';
import { emptyStatus, type Msg, type TabStatus } from '../core/messages';
import type { AdPhase, Signals } from '../core/types';
import { defaultConfig, normalizeConfig, type Config } from '../storage/config';
import { CONFIG_KEY, loadConfig } from '../storage/configStore';
import { recordAction } from '../storage/actionLog';
import { PlayerObserver } from './playerObserver';
import { Recorder } from './recorder';

let currentStatus: TabStatus = emptyStatus();
let det: DetectorState = initialState;
let lastShown: AdPhase = 'UNKNOWN';
let adStartedAt = 0;
let cfg: Config = defaultConfig;
let done: ActionType[] = [];
const recorder = new Recorder();
const clock = (t: number): string => new Date(t).toISOString().slice(11, 19);

void loadConfig()
  .then((c) => {
    cfg = c;
    log.info('config', cfg);
  })
  .catch(() => undefined);

ext.storage.onChanged.addListener((changes, area) => {
  const ch = changes[CONFIG_KEY];
  if (area === 'local' && ch) {
    cfg = normalizeConfig(ch.newValue);
    log.info('config đã đổi', cfg);
  }
});

function send(msg: Msg): void {
  try {
    void ext.runtime.sendMessage(msg).catch(() => undefined);
  } catch {
    log.warn('extension context invalidated, stop observing');
    observer.stop();
  }
}

function planStep(s: Signals): void {
  const actions = plan(
    { inAd: true, msIntoAd: s.t - adStartedAt, skipVisible: s.skipVisible, done },
    cfg,
  );
  for (const a of actions) {
    done = [...done, a.type];
    log.info(cfg.dryRun ? 'DRY-RUN sẽ làm:' : 'CHƯA CÀI ĐẶT (tuần 8):', a);
    recordAction({ at: s.t, action: a.type, dryRun: cfg.dryRun });
  }
}

function handle(s: Signals): void {
  recorder.feed(s);
  const { next, events } = step(det, s);
  det = next;
  let changed = false;

  for (const e of events) {
    changed = true;
    if (e.type === 'AD_START') {
      adStartedAt = e.at;
      done = [];
      log.info(clock(e.emittedAt), 'AD_START, độ trễ', e.emittedAt - e.at, 'ms');
    } else {
      currentStatus = {
        ...currentStatus,
        adsDetected: currentStatus.adsDetected + 1,
        adSeconds: currentStatus.adSeconds + (e.at - adStartedAt) / 1000,
      };
      done = [];
      log.info(clock(e.emittedAt), 'AD_END');
    }
  }

  if (det.phase === 'AD') planStep(s);

  const shown: AdPhase = s.playerFound ? det.phase : 'UNKNOWN';
  if (shown !== lastShown) {
    lastShown = shown;
    changed = true;
  }

  if (!changed) return;
  currentStatus = { ...currentStatus, phase: shown, updatedAt: s.t };
  send({ kind: 'STATUS_UPDATE', status: currentStatus });
}

const observer = new PlayerObserver(handle);
observer.start();
send({ kind: 'STATUS_UPDATE', status: currentStatus });