import { disguise } from './anti-detect';

// Danh sách các từ khóa cờ bạc, quảng cáo, tracking trong URL popup
const SUSPICIOUS_URL_PATTERNS = [
  /shopee\.vn/i,
  /lazada\.vn/i,
  /bet\d+/i,
  /debet/i,
  /kubet/i,
  /big\d+/i,
  /five\d+/i,
  /red\d+/i,
  /win\d+/i,
  /88/i,
  /casino/i,
  /game.*bai/i,
  /nohu/i,
  /taixiu/i,
  /sunwin/i,
  /gemwin/i,
  /rikvip/i,
  /zowin/i,
  /nhatvip/i,
  /go88/i,
  /hitclub/i,
  /789club/i,
  /b52/i,
  /chinhhang/i,
  /mplmncb/i,
  /clickadu/i,
  /popunder/i,
  /ad.*click/i,
  /pop.*cash/i,
  /propeller/i,
  /traffic/i,
  /redirect/i,
];

export interface AntiPopupOptions {
  onBlocked?: (url: string) => void;
}

let lastUserClickTime = 0;

// Ghi nhận tương tác chuột của người dùng
export function trackUserGesture(targetWindow: Window = window): void {
  try {
    targetWindow.addEventListener(
      'pointerdown',
      () => {
        lastUserClickTime = Date.now();
      },
      { capture: true, passive: true }
    );
  } catch {
    // Bỏ qua lỗi context
  }
}

export function isUserGestureRecent(thresholdMs: number = 1000): boolean {
  return Date.now() - lastUserClickTime <= thresholdMs;
}

export function isSuspiciousUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false;
  return SUSPICIOUS_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function installAntiPopup(targetWindow: Window = window, options: AntiPopupOptions = {}): void {
  const originalOpen = targetWindow.open;
  if (!originalOpen) return;

  trackUserGesture(targetWindow);

  function patchedOpen(
    this: Window,
    url?: string | URL,
    target?: string,
    features?: string
  ): WindowProxy | null {
    const urlString = url ? String(url) : '';

    // 1. Nếu mở không có tương tác người dùng trong 1000ms qua -> Chặn tuyệt đối
    if (!isUserGestureRecent(1000)) {
      options.onBlocked?.(urlString);
      return null;
    }

    // 2. Nếu URL chứa từ khóa quảng cáo/cờ bạc -> Chặn
    if (isSuspiciousUrl(urlString)) {
      options.onBlocked?.(urlString);
      return null;
    }

    // 3. Cho phép các thao tác mở tab hợp lệ của người dùng
    return originalOpen.call(this, url, target, features);
  }

  disguise(patchedOpen, originalOpen);
  targetWindow.open = patchedOpen;
}