import { ext } from '../platform/api';
import { log } from '../core/log';
import { canAct, emptyBreaker, trip, type Breaker } from '../core/circuitBreaker';
import { initialState, step, type DetectorState } from '../core/detector';
import { plan, SEEK_AFTER_MS, type Action, type ActionType } from '../core/intervention';
import { emptyStatus, type Msg, type TabStatus } from '../core/messages';
import type { AdPhase, Signals } from '../core/types';
import { verifyAction } from '../core/verify';
import { recordAction } from '../storage/actionLog';
import { saveBreaker } from '../storage/breakerStore';
import { defaultConfig, normalizeConfig, type Config } from '../storage/config';
import { CONFIG_KEY, loadConfig, saveConfig } from '../storage/configStore';
import { Actuator } from './actuator';
import { extractSignals } from './extractSignals';
import { PlayerObserver } from './playerObserver';
import { Recorder } from './recorder';
import { getActiveVideo, getSkipButton, SEL } from './selectors';
import { isStuck } from '../core/playbackGuard';
import {
  classify,
  endObservation,
  newObservation,
  observeAd,
  type AdObservation,
} from '../core/classifier';
import { applyMask, removeMask } from '../stealth/visual-mask';
import { onAdStart, onAdEnd, onSeekExecuted, runHealthCheck } from '../stealth/pipeline';

let obs: AdObservation | null = null;

const VERIFY_AFTER_MS = 250;
let currentStatus: TabStatus = emptyStatus();
let det: DetectorState = initialState;
let lastShown: AdPhase = 'UNKNOWN';
let intervenedThisAd = false;
let adStartedAt = 0;
let cfg: Config = {
  ...defaultConfig,
};
let done: ActionType[] = [];
let breaker: Breaker = emptyBreaker();
let lastSignals: Signals | null = null;
let lastSoughtDuration: number | null = null;
let lastCurrentTime = 0;

const recorder = new Recorder();
const actuator = new Actuator({
  getVideo: () => getActiveVideo(document),
  clickSkip: () => {
    const btn = getSkipButton(document);
    if (!btn) return false;

    // Khi nút Skip xuất hiện, lập tức tua video về cuối và ép play()
    const v = getActiveVideo(document);
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      v.currentTime = Math.max(0, v.duration - 0.1);
      v.playbackRate = cfg.maxSpeed;
      if (v.paused) void v.play().catch(() => undefined);
    }

    btn.click();
    const inner = btn.querySelector<HTMLElement>(
      '.ytp-skip-ad-button__text, .ytp-ad-skip-button-text-modern, span, div',
    );
    if (inner) inner.click();

    const opts = { bubbles: true, cancelable: true, composed: true, view: window };
    btn.dispatchEvent(new PointerEvent('pointerdown', opts));
    btn.dispatchEvent(new MouseEvent('mousedown', opts));
    btn.dispatchEvent(new PointerEvent('pointerup', opts));
    btn.dispatchEvent(new MouseEvent('mouseup', opts));
    btn.dispatchEvent(new MouseEvent('click', opts));

    const parent = btn.parentElement;
    if (parent && parent !== document.body) {
      parent.dispatchEvent(new MouseEvent('click', opts));
      parent.click();
    }
    return true;
  },
});

const clock = (t: number): string => new Date(t).toISOString().slice(11, 19);

void loadConfig().then((c) => {
  cfg = c;
  log.info('config', cfg);
}).catch(() => undefined);

breaker = emptyBreaker();
void saveBreaker(breaker).catch(() => undefined);

ext.storage.onChanged.addListener((changes, area) => {
  const ch = changes[CONFIG_KEY];
  if (area === 'local' && ch) {
    cfg = normalizeConfig(ch.newValue);
    log.info('config đã đổi', cfg);
    if (!cfg.enabled) actuator.restore();
  }
});

// Phím tắt khẩn cấp: Alt+Shift+K bật/tắt toàn bộ can thiệp và reset ngắt mạch
window.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.code === 'KeyK') {
    e.preventDefault();
    breaker = emptyBreaker();
    void saveBreaker(breaker).catch(() => undefined);
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

/**
 * Tăng bộ đếm tích lũy bền vững trong storage.local (không mất khi refresh hay mở tab mới)
 */
function incrementTotalBlocked(count = 1, seconds = 0): void {
  ext.storage.local
    .get(['stats_total_blocked', 'stats_total_seconds'])
    .then((r) => {
      const curCount = typeof r.stats_total_blocked === 'number' ? r.stats_total_blocked : 0;
      const curSec = typeof r.stats_total_seconds === 'number' ? r.stats_total_seconds : 0;
      void ext.storage.local.set({
        stats_total_blocked: curCount + count,
        stats_total_seconds: curSec + Math.round(seconds),
      });
    })
    .catch(() => undefined);
}

// Lắng nghe tín hiệu quảng cáo bị triệt tiêu từ Defuser (MAIN world).
// Chỉ cập nhật trạng thái real-time trên popup — KHÔNG ghi vào storage.
// Nguồn chân lý duy nhất cho storage là sự kiện AD_END bên dưới (1 lần / 1 quảng cáo).
window.addEventListener('message', (event) => {
  if (event.data?.source === 'adfilter-defuser' && event.data?.type === 'AD_DEFUSED') {
    currentStatus = {
      ...currentStatus,
      updatedAt: Date.now(),
    };
    send({ kind: 'STATUS_UPDATE', status: currentStatus });
  }
});

function resumePlay(): void {
  const v = getActiveVideo(document);
  if (v && v.paused) {
    void v.play().catch(() => undefined);
  }
  const bigPlay = document.querySelector<HTMLElement>('.ytp-large-play-button');
  if (bigPlay) {
    bigPlay.click();
  }
}

/**
 * Can thiệp tức thời 0ms — được gọi ngay khi phát hiện .ad-showing,
 * tôn trọng hoàn toàn cấu hình maxSpeed, dryRun, allowSeek.
 */
function instantIntervene(): void {
  const player = document.querySelector(SEL.player);
  const isAd =
    player &&
    (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
  if (!isAd || !canAct(breaker, Date.now()) || !cfg.enabled || cfg.dryRun) return;
  actuator.noteBaseline();
  actuator.touch();

  const allVideos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  for (const v of allVideos) {
    v.muted = true;
    v.playbackRate = cfg.maxSpeed;
    if (cfg.allowSeek && Number.isFinite(v.duration) && v.duration > 0) {
      v.currentTime = Math.max(0, v.duration - 0.1);
      resumePlay();
      try {
        v.dispatchEvent(new Event('ended'));
      } catch {}
    }
  }

  const btn = getSkipButton(document);
  if (btn) {
    btn.click();
    const inner = btn.querySelector<HTMLElement>('.ytp-skip-ad-button__text, span');
    if (inner) inner.click();
  }

  log.info('[instantIntervene] can thiệp tức thời 0ms');
}

function verifyLater(a: Action, startedAt: number): void {
  window.setTimeout(() => {
    const s = extractSignals(document, Date.now());
    lastSignals = s;
    const ok = verifyAction(a, s);
    recordAction({
      at: s.t,
      action: a.type,
      dryRun: false,
      verified: ok,
      latencyMs: s.t - startedAt,
    });
    currentStatus = ok
      ? { ...currentStatus, interventionsOk: currentStatus.interventionsOk + 1 }
      : { ...currentStatus, interventionsFail: currentStatus.interventionsFail + 1 };
    send({ kind: 'STATUS_UPDATE', status: currentStatus });
    if (!ok) {
      log.warn('xác minh chưa đạt, cho phép thử lại', a.type);
      if (a.type === 'CLICK_SKIP') {
        done = done.filter((t) => t !== 'SEEK_TO_END');
        lastSoughtDuration = null;
      } else {
        done = done.filter((t) => t !== a.type);
      }
    }
  }, VERIFY_AFTER_MS);
}

function watchPlayback(): void {
  const first = lastSignals;
  if (!first) return;
  window.setTimeout(() => {
    const second = lastSignals;
    if (second && isStuck(first, second)) {
      log.warn('video có vẻ bị kẹt sau can thiệp');
      recordAction({
        at: second.t,
        action: 'PLAYBACK_STUCK',
        dryRun: false,
        ok: false,
        error: 'playback-stuck',
      });
      breaker = trip(second.t);
      void saveBreaker(breaker).catch(() => undefined);
    }
  }, 3000);
}

function execute(a: Action, s: Signals): void {
  const player = document.querySelector(SEL.player);
  const isAd =
    player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
  if (!isAd) {
    log.warn('Không ở trong quảng cáo, hủy bỏ hành động để bảo vệ video người dùng', a.type);
    return;
  }

  if (!canAct(breaker, s.t)) {
    log.warn('ngắt mạch đang mở do cảnh báo trang, bỏ qua', a.type);
    recordAction({ at: s.t, action: a.type, dryRun: false, ok: false, error: 'breaker-open' });
    return;
  }

  if (a.type === 'SEEK_TO_END') {
    onSeekExecuted();
    const v = getActiveVideo(document);
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      lastSoughtDuration = v.duration;
      v.currentTime = Math.max(0, v.duration - 0.1);
      v.playbackRate = cfg.maxSpeed;
      resumePlay();
      try {
        v.dispatchEvent(new Event('ended'));
      } catch {}
    }
    const videos = Array.from((player || document).querySelectorAll<HTMLVideoElement>('video'));
    for (const vid of videos) {
      if (vid !== v && Number.isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = Math.max(0, vid.duration - 0.1);
        vid.playbackRate = cfg.maxSpeed;
        if (vid.paused) {
          void vid.play().catch(() => undefined);
        }
      }
    }
  }

  const res = actuator.apply(a);
  recordAction({ at: s.t, action: a.type, dryRun: false, ok: res.ok, error: res.error });
  if (res.ok) {
    intervenedThisAd = true;
    verifyLater(a, s.t);
    return;
  }
  if (res.skipped) {
    done = done.filter((t) => t !== a.type);
  }
}

function planStep(s: Signals): void {
  if (!s.adShowing) return;

  const v = getActiveVideo(document);
  if (v && Number.isFinite(v.duration) && v.duration > 0) {
    if (v.currentTime < v.duration - 0.2) {
      done = done.filter((t) => t !== 'SEEK_TO_END');
      lastSoughtDuration = null;
    } else {
      resumePlay();
    }
    if (Number.isFinite(v.currentTime)) {
      lastCurrentTime = v.currentTime;
    }
  }

  const msIntoAd = cfg.allowSeek ? Math.max(SEEK_AFTER_MS, s.t - adStartedAt) : s.t - adStartedAt;

  const actions = plan(
    { inAd: true, msIntoAd, skipVisible: s.skipVisible, done },
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

function handle(s: Signals): void {
  lastSignals = s;
  const res = step(det, s);
  det = res.next;

  if (s.enforcement) {
    if (canAct(breaker, s.t)) {
      recordAction({
        at: s.t,
        action: 'ENFORCEMENT_SEEN',
        dryRun: false,
        ok: false,
        error: 'enforcement-seen',
      });
    }
    breaker = trip(s.t);
    void saveBreaker(breaker).catch(() => undefined);
    log.warn('phát hiện cảnh báo trang, ngắt mạch tạm khóa can thiệp');
    actuator.restore();
  }

  const events = res.events;
  for (const e of events) {
    if (e.type === 'AD_START') {
      // onAdStart() đã gọi applyMask() bên trong — không gọi lại ở đây để tránh double-mask
      onAdStart();
      adStartedAt = e.at;
      done = [];
      lastSoughtDuration = null;
      lastCurrentTime = 0;
      obs = newObservation(e.at);
      log.info(clock(e.emittedAt), 'AD_START, độ trễ', e.emittedAt - e.at, 'ms');
      
      if (cfg.enabled && !cfg.dryRun) instantIntervene();

      // Fallback an toàn: nếu sau 1.5s không còn .ad-showing thì tháo mask
      window.setTimeout(() => {
        const player = document.querySelector(SEL.player);
        if (!player || !player.classList.contains('ad-showing')) {
          removeMask();
        }
      }, 1500);
    } else {
      removeMask();
      onAdEnd();
      const adDurationSec = (e.at - adStartedAt) / 1000;
      if (obs) {
        const c = classify(endObservation(obs, e.at));
        currentStatus = { ...currentStatus, adKind: c.kind, confidence: c.confidence };
        obs = null;
      }
      currentStatus = {
        ...currentStatus,
        adsDetected: currentStatus.adsDetected + 1,
        adSeconds: currentStatus.adSeconds + adDurationSec,
        updatedAt: e.emittedAt,
      };
      incrementTotalBlocked(1, adDurationSec);
      done = [];
      lastSoughtDuration = null;
      lastCurrentTime = 0;
      actuator.restore();
      if (intervenedThisAd) watchPlayback();
      intervenedThisAd = false;
      log.info(clock(e.emittedAt), 'AD_END');
    }
  }

  if (!s.adShowing) {
    lastSoughtDuration = null;
    lastCurrentTime = 0;
  }

  if (s.playerFound) actuator.noteBaseline();
  if (det.phase === 'AD' && obs) {
    obs = observeAd(obs, s);
    const c = classify(obs);
    if (c.kind !== currentStatus.adKind) {
      currentStatus = { ...currentStatus, adKind: c.kind, confidence: c.confidence };
      send({ kind: 'STATUS_UPDATE', status: currentStatus });
    }
  }
  if (det.phase === 'AD' && s.adShowing) planStep(s);

  const shown: AdPhase = s.playerFound ? det.phase : 'UNKNOWN';
  if (shown !== lastShown) {
    lastShown = shown;
    currentStatus = { ...currentStatus, phase: shown, updatedAt: s.t };
    send({
      kind: 'STATUS_UPDATE',
      status: currentStatus,
    });
  }
}

const observer = new PlayerObserver(handle, {
  onInstant: () => {
    if (cfg.enabled && !cfg.dryRun) instantIntervene();
  },
});
observer.start();
send({ kind: 'STATUS_UPDATE', status: currentStatus });

// Watchdog kiểm tra định kỳ 60 giây
window.setInterval(() => {
  const report = runHealthCheck();
  if (!report.healthy) {
    log.warn('[Pipeline Watchdog] Phát hiện vấn đề:', report);
  }
}, 60_000);

// Lắng nghe lệnh RESET_STATS từ popup: reset bộ đếm phiên về 0
ext.runtime.onMessage.addListener((msg: unknown) => {
  if (msg && typeof msg === 'object' && (msg as { kind?: string }).kind === 'RESET_STATS') {
    currentStatus = {
      ...currentStatus,
      adsDetected: 0,
      adSeconds: 0,
      updatedAt: Date.now(),
    };
    send({ kind: 'STATUS_UPDATE', status: currentStatus });
  }
});