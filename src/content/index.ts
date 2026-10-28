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
let skipAttempts = 0;
const MAX_SKIP_ATTEMPTS = 3;

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
      v.playbackRate = 16.0;
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

/**
 * Can thiệp tức thời 0ms — được gọi ngay khi phát hiện .ad-showing,
 * không cần chờ debounce hay planStep. Tắt tiếng + tua về cuối ngay lập tức.
 */
function instantIntervene(): void {
  const player = document.querySelector(SEL.player);
  const isAd =
    player &&
    (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
  if (!isAd || !canAct(breaker, Date.now())) return;

  const v = getActiveVideo(document);
  if (!v) return;

  // Tắt tiếng ngay lập tức
  v.muted = true;

  // Tăng tốc tối đa ngay lập tức
  v.playbackRate = 16.0;

  // Tua về cuối ngay nếu duration đã có
  if (Number.isFinite(v.duration) && v.duration > 0) {
    v.currentTime = Math.max(0, v.duration - 0.1);
    if (v.paused) void v.play().catch(() => undefined);
  }

  // Click skip nếu nút đã xuất hiện
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
        skipAttempts++;
        if (skipAttempts < MAX_SKIP_ATTEMPTS) {
          done = done.filter((t) => t !== a.type);
        } else {
          log.warn('CLICK_SKIP đạt giới hạn tối đa, chuyển hướng dùng SEEK_TO_END');
          // Không xóa CLICK_SKIP nữa, giải phóng SEEK_TO_END để tua dứt điểm
          done = done.filter((t) => t !== 'SEEK_TO_END');
          lastSoughtDuration = null;
        }
      } else {
        done = done.filter((t) => t !== a.type);
      }
      // BUG FIX: Không gọi actuator.restore() khi quảng cáo vẫn đang chiếu!
      // Chỉ restore khi AD_END — tránh tự bật tiếng lại giữa chừng quảng cáo.
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

  // Cơ chế One-Shot Seek dứt khoát: tua 1 lần duy nhất cho mỗi quảng cáo và gọi play()
  if (a.type === 'SEEK_TO_END') {
    const v = getActiveVideo(document);
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      lastSoughtDuration = v.duration;
      v.currentTime = Math.max(0, v.duration - 0.1);
      v.playbackRate = 16.0;
      if (v.paused) {
        void v.play().catch(() => undefined);
      }
    }
    const videos = Array.from((player || document).querySelectorAll<HTMLVideoElement>('video'));
    for (const vid of videos) {
      if (vid !== v && Number.isFinite(vid.duration) && vid.duration > 0) {
        vid.currentTime = Math.max(0, vid.duration - 0.1);
        vid.playbackRate = 16.0;
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
    // Cho phép thử lại ở frame tiếp theo khi duration đã nạp xong
    done = done.filter((t) => t !== a.type);
  }
}

function planStep(s: Signals): void {
  // Bắt buộc s.adShowing phải là true mới lên kế hoạch can thiệp
  if (!s.adShowing) return;

  const v = getActiveVideo(document);
  if (v && Number.isFinite(v.duration) && v.duration > 0) {
    // 1. Quảng cáo mới có thời lượng khác (Ad 2 trong chuỗi Ad Pod)
    const isNewDuration = lastSoughtDuration !== v.duration && v.currentTime < v.duration - 0.5;
    // 2. Quảng cáo mới khởi động lại từ 0s (dù cùng duration)
    const isRestart = v.currentTime < 1.0 && lastCurrentTime > 2.0 && !v.seeking;
    // 3. Quảng cáo đơn: khi nút Skip xuất hiện hoặc sẵn sàng mà video chưa về cuối -> giải phóng tua ngay!
    const isSkipReady = s.skipVisible && v.currentTime < v.duration - 0.5;
    // 4. Lệnh tua ban đầu ở giây 0 bị YouTube từ chối (sau 1s mà currentTime vẫn < 2s)
    const isSeekRejected =
      !v.seeking && v.currentTime < 2.0 && s.t - adStartedAt > 1000 && lastSoughtDuration === v.duration;

    if (isNewDuration || isRestart || isSkipReady || isSeekRejected) {
      done = done.filter((t) => t !== 'SEEK_TO_END');
      lastSoughtDuration = null;
    }
    if (Number.isFinite(v.currentTime)) {
      lastCurrentTime = v.currentTime;
    }
  }

  // Nếu nút Skip đang hiển thị, cho phép thử lại CLICK_SKIP nhưng có giới hạn tối đa
  if (s.skipVisible && skipAttempts < MAX_SKIP_ATTEMPTS) {
    done = done.filter((t) => t !== 'CLICK_SKIP');
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
      adStartedAt = e.at;
      done = [];
      lastSoughtDuration = null;
      skipAttempts = 0;
      lastCurrentTime = 0;
      obs = newObservation(e.at);
      log.info(clock(e.emittedAt), 'AD_START, độ trễ', e.emittedAt - e.at, 'ms');
      // Can thiệp tức thời 0ms ngay tại thời điểm AD_START — không chờ planStep
      if (cfg.enabled && !cfg.dryRun) instantIntervene();
    } else {
      removeMask();
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
      skipAttempts = 0;
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
