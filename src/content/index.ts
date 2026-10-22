import { ext } from '../platform/api';
import { log } from '../core/log';
import { initialState, step, type DetectorState } from '../core/detector';
import { emptyStatus, type Msg, type TabStatus } from '../core/messages';
import type { AdPhase, Signals } from '../core/types';
import { PlayerObserver } from './playerObserver';
import { Recorder } from './recorder';

let currentStatus: TabStatus = emptyStatus();
let det: DetectorState = initialState;
let lastShown: AdPhase = 'UNKNOWN';
let adStartedAt = 0;
const recorder = new Recorder();
const clock = (t: number): string => new Date(t).toISOString().slice(11, 19);

function send(msg: Msg): void {
  try {
    void ext.runtime.sendMessage(msg).catch(() => undefined);
  } catch {
    log.warn('extension context invalidated, stop observing');
    observer.stop();
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
      log.info(clock(e.emittedAt), 'AD_START, độ trễ', e.emittedAt - e.at, 'ms');
    } else {
      currentStatus = {
        ...currentStatus,
        adsDetected: currentStatus.adsDetected + 1,
        adSeconds: currentStatus.adSeconds + (e.at - adStartedAt) / 1000,
      };
      log.info(clock(e.emittedAt), 'AD_END');
    }
  }

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