/**
 * Selector Watchdog — Giám sát định kỳ tính toàn vẹn của hệ thống.
 * Nếu phát hiện YouTube đổi class hoặc dữ liệu quảng cáo lọt qua,
 * ghi log cảnh báo để hệ thống tự kích hoạt chế độ Fallback.
 */

export interface WatchdogReport {
  healthy: boolean;
  leakedFields: string[];
  missingSelectors: string[];
}

export function inspectHealth(doc: Document): WatchdogReport {
  const missingSelectors: string[] = [];
  const critical = ['#movie_player', 'video'];

  for (const sel of critical) {
    if (!doc.querySelector(sel)) missingSelectors.push(sel);
  }

  const leakedFields: string[] = [];
  const w = window as any;
  const resp = w.ytInitialPlayerResponse;
  if (resp && typeof resp === 'object') {
    if ('adPlacements' in resp) leakedFields.push('adPlacements');
    if ('playerAds' in resp) leakedFields.push('playerAds');
  }

  return {
    healthy: missingSelectors.length === 0 && leakedFields.length === 0,
    leakedFields,
    missingSelectors,
  };
}