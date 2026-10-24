import { ext } from '../platform/api';
import { log } from '../core/log';
import { canAct, emptyBreaker, recordFailure, trip, type Breaker } from '../core/circuitBreaker';
import { initialState, step, type DetectorState } from '../core/detector';
import { plan, type Action, type ActionType } from '../core/intervention';
import { emptyStatus, type Msg, type TabStatus } from '../core/messages';
import type { AdPhase, Signals } from '../core/types';
import { verifyAction } from '../core/verify';
import { recordAction } from '../storage/actionLog';
import { loadBreaker, saveBreaker } from '../storage/breakerStore';
import { defaultConfig, normalizeConfig, type Config } from '../storage/config';
import { CONFIG_KEY, loadConfig, saveConfig } from '../storage/configStore';
import { Actuator } from './actuator';
import { PlayerObserver } from './playerObserver';
import { Recorder } from './recorder';
import { SEL } from './selectors';

const VERIFY_AFTER_MS = 1500;
let currentStatus: TabStatus = emptyStatus();
let det: DetectorState = initialState;
let lastShown: AdPhase = 'UNKNOWN';
let adStartedAt = 0;
let cfg: Config = defaultConfig;
let done: ActionType[] = [];
let breaker: Breaker = emptyBreaker();
let lastSignals: Signals | null = null;

const recorder = new Recorder();
const actuator = new Actuator({
  getVideo: () => document.querySelector<HTMLVideoElement>(SEL.video),
  clickSkip: () => {
    const btn = document.querySelector<HTMLElement>(SEL.skipButton);
    if (!btn || btn.getClientRects().length === 0) return false;
    btn.click();
    return true;
  },
});

const clock = (t: number): string => new Date(t).toISOString().slice(11, 19);

void loadConfig().then((c) => {
  cfg = c;
  log.info('config', cfg);
}).catch(() => undefined);

void loadBreaker().then((b) => {
  breaker = b;
}).catch(() => undefined);

ext.storage.onChanged.addListener((changes, area) => {
  const ch = changes[CONFIG_KEY];
  if (area === 'local' && ch) {
    cfg = normalizeConfig(ch.newValue);
    log.info('config đã đổi', cfg);
    if (!cfg.enabled) actuator.restore();
  }
});

// Phím tắt khẩn cấp: Alt+Shift+K bật/tắt toàn bộ can thiệp
window.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.code === 'KeyK') {
    e.preventDefault();
    void saveConfig({ enabled: !cfg.enabled }).catch(() => undefined);
  }
});

function send(msg: Msg): void {
  try {
    void ext.runtime.sendMessage(msg).catch(() => undefined);
  } catch {
    log.warn('extension context invalidated, stop observing');
    actuator.restore();
    observer.stop();
  }
}

function failBreaker(now: number): void {
  breaker = recordFailure(breaker, now);
  void saveBreaker(breaker).catch(() => undefined);
}

function verifyLater(a: Action, startedAt: number): void {
  window.setTimeout(() => {
    const s = lastSignals;
    if (!s) return;
    const ok = verifyAction(a, s);
    recordAction({
      at: s.t,
      action: a.type,
      dryRun: false,
      verified: ok,
      latencyMs: s.t - startedAt,
    });
    if (!ok) {
      log.warn('xác minh thất bại, khôi phục', a.type);
      actuator.restore();
      failBreaker(s.t);
    }
  }, VERIFY_AFTER_MS);
}

function execute(a: Action, s: Signals): void {
  if (!canAct(breaker, s.t)) {
    log.warn('ngắt mạch đang mở, bỏ qua', a.type);
    recordAction({ at: s.t, action: a.type, dryRun: false, ok: false, error: 'breaker-open' });
    return;
  }
  const res = actuator.apply(a);
  recordAction({ at: s.t, action: a.type, dryRun: false, ok: res.ok, error: res.error });
  if (res.ok) {
    verifyLater(a, s.t);
    return;
  }
  log.warn('hành động không thực hiện được', a.type, res.error);
  if (!res.skipped) failBreaker(s.t);
}

function planStep(s: Signals): void {
  const actions = plan(
    { inAd: true, msIntoAd: s.t - adStartedAt, skipVisible: s.skipVisible, done },
    cfg,
  );
  for (const a of actions) {
    done = [...done, a.type];
    if (cfg.dryRun) {
      log.info('DRY-RUN sẽ làm:', a);
      recordAction({ at: s.t, action: a.type, dryRun: true });
    } else {
      log.info('THỰC HIỆN:', a);
      execute(a, s);
    }
  }
}

function onEnforcement(s: Signals): void {
  if (!canAct(breaker, s.t)) return;
  breaker = trip(s.t);
  actuator.restore();
  void saveBreaker(breaker).catch(() => undefined);
  log.warn('ENFORCEMENT_SEEN: trang hiện cảnh báo, dừng can thiệp');
  recordAction({ at: s.t, action: 'ENFORCEMENT_SEEN', dryRun: cfg.dryRun });
}

function handle(s: Signals): void {
  lastSignals = s;
  recorder.feed(s);
  if (s.enforcement) onEnforcement(s);

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
      actuator.restore();
      log.info(clock(e.emittedAt), 'AD_END');
    }
  }

  if (det.phase === 'NORMAL' && s.playerFound) actuator.noteBaseline();
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