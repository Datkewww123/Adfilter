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

    // 1. Click trực tiếp lên button
    btn.click();

    // 2. Click lên phần tử text/icon con bên trong button
    const inner = btn.querySelector<HTMLElement>(
      '.ytp-skip-ad-button__text, .ytp-ad-skip-button-text-modern, span, div',
    );
    if (inner) inner.click();

    // 3. Gửi chuỗi sự kiện chuột hoàn chỉnh
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

// Luôn reset ngắt mạch sạch sẽ khi khởi động
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
 * Cưỡng chế tắt tiếng và tua dứt điểm TẤT CẢ thẻ video trên trang (kể cả video chạy ngầm)
 */
function silenceAndSkipAllVideos(): void {
  const allVideos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  for (const v of allVideos) {
    // 1. Cưỡng chế tắt tiếng tức khắc
    v.muted = true;
    v.volume = 0;

    // 2. Tăng tốc tối đa (16x)
    v.playbackRate = cfg.maxSpeed;

    // 3. Tua về giây cuối cùng nếu đã biết duration
    if (Number.isFinite(v.duration) && v.duration > 0) {
      v.currentTime = Math.max(0, v.duration - 0.1);
      try {
        v.dispatchEvent(new Event('ended'));
      } catch {}
    }

    if (v.paused) {
      void v.play().catch(() => undefined);
    }
  }
}

/**
 * Can thiệp tức thời 0ms — được gọi ngay khi phát hiện .ad-showing hoặc ad audio ngầm,
 * không cần chờ debounce hay planStep. Tắt tiếng + tua về cuối ngay lập tức.
 */
function instantIntervene(): void {
  const player = document.querySelector(SEL.player);
  const isAd =
    player &&
    (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
  if (!isAd || !canAct(breaker, Date.now()) || !cfg.enabled || cfg.dryRun) return;
  actuator.noteBaseline();
  actuator.touch();

  // Tắt tiếng và tua toàn bộ video chạy ngầm
  silenceAndSkipAllVideos();
  resumePlay();

  // Click skip nếu nút đã xuất hiện
  const btn = getSkipButton(document);
  if (btn) {
    btn.click();
    const inner = btn.querySelector<HTMLElement>('.ytp-skip-ad-button__text, span');
    if (inner) inner.click();
  }

  log.info('[instantIntervene] can thiệp tức thời 0ms trên toàn bộ video');
}

function verifyLater(a: Action, startedAt: number): void {
  window.setTimeout(() => {
    // Trích xuất tín hiệu MỚI NHẤT từ DOM và thẻ video để kiểm tra chính xác
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
        // Synthetic click bị YouTube chặn isTrusted, không spam click để tránh nghẽn event loop.
        // Chuyển hướng kích hoạt SEEK_TO_END để tua dứt điểm ngay lập tức.
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
  // KHÓA BẢO VỆ TUYỆT ĐỐI CHO VIDEO CỦA NGƯỜI DÙNG:
  // Chỉ can thiệp khi player THỰC SỰ đang chiếu quảng cáo (có class .ad-showing hoặc .ad-interrupting)
  const player = document.querySelector(SEL.player);
  const isAd =
    player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
  if (!isAd) {
    log.warn('Không ở trong quảng cáo, hủy bỏ hành động để bảo vệ video người dùng', a.type);
    return;
  }

  // Chỉ dừng lại khi trang hiện cảnh báo chống adblock (ENFORCEMENT_SEEN)
  if (!canAct(breaker, s.t)) {
    log.warn('ngắt mạch đang mở do cảnh báo trang, bỏ qua', a.type);
    recordAction({ at: s.t, action: a.type, dryRun: false, ok: false, error: 'breaker-open' });
    return;
  }

  // Cơ chế One-Shot Seek dứt khoát: tua toàn bộ thẻ video và gọi play()
  if (a.type === 'SEEK_TO_END') {
    onSeekExecuted();
    silenceAndSkipAllVideos();
    const v = getActiveVideo(document);
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      lastSoughtDuration = v.duration;
    }
    resumePlay();
  }

  const res = actuator.apply(a);
  recordAction({ at: s.t, action: a.type, dryRun: false, ok: res.ok, error: res.error });
  if (res.ok) {
    intervenedThisAd = true;
    verifyLater(a, s.t);
    return;
  }
  if (res.skipped) {
    // Cho phép thử lại ở frame tiếp theo khi duration đã nạp xong
    done = done.filter((t) => t !== a.type);
  }
}

function planStep(s: Signals): void {
  // Bắt buộc s.adShowing phải là true mới lên kế hoạch can thiệp
  if (!s.adShowing) return;

  const v = getActiveVideo(document);
  if (v && Number.isFinite(v.duration) && v.duration > 0) {
    // Nếu video chưa tua xong về cuối, tiếp tục giải phóng SEEK_TO_END để ép tua dứt điểm
    if (v.currentTime < v.duration - 0.2) {
      done = done.filter((t) => t !== 'SEEK_TO_END');
      lastSoughtDuration = null;
    } else {
      // Khi đã ở cuối quảng cáo mà bị dừng hình, kích hoạt play ngay
      resumePlay();
    }
    if (Number.isFinite(v.currentTime)) {
      lastCurrentTime = v.currentTime;
    }
  }

  // Khi bật allowSeek, cho phép tua ngay (msIntoAd >= SEEK_AFTER_MS)
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
      applyMask();
      onAdStart();
      adStartedAt = e.at;
      done = [];
      lastSoughtDuration = null;
      lastCurrentTime = 0;
      obs = newObservation(e.at);
      log.info(clock(e.emittedAt), 'AD_START, độ trễ', e.emittedAt - e.at, 'ms');
      // Can thiệp tức thời 0ms ngay tại thời điểm AD_START — không chờ planStep
      if (cfg.enabled && !cfg.dryRun) instantIntervene();

      // Bảo vệ: Tự động gỡ Visual Mask sau tối đa 2 giây tránh màn hình đen nếu AD_END bị kẹt
      window.setTimeout(() => {
        const player = document.querySelector(SEL.player);
        if (!player || !player.classList.contains('ad-showing')) {
          removeMask();
        }
      }, 2000);
    } else {
      removeMask();
      onAdEnd();
      if (obs) {
        const c = classify(endObservation(obs, e.at));
        currentStatus = { ...currentStatus, adKind: c.kind, confidence: c.confidence };
        obs = null;
      }
      currentStatus = {
        ...currentStatus,
        adsDetected: currentStatus.adsDetected + 1,
        adSeconds: currentStatus.adSeconds + (e.at - adStartedAt) / 1000,
        updatedAt: e.emittedAt,
      };
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
  // Callback tức thời 0ms ngay khi MutationObserver thấy .ad-showing trên DOM,
  // không qua throttle MIN_GAP_MS hay State Machine debounce.
  onInstant: () => {
    if (cfg.enabled && !cfg.dryRun) instantIntervene();
  },
});
observer.start();
send({ kind: 'STATUS_UPDATE', status: currentStatus });

// ─── Watchdog: Kiểm tra sức khỏe pipeline mỗi 60 giây ──────────────────────
window.setInterval(() => {
  const report = runHealthCheck();
  if (!report.healthy) {
    log.warn('[Pipeline Watchdog] Phát hiện vấn đề:', report);
  }
}, 60_000);
