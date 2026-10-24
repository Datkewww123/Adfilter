import type { Action } from './intervention';
import type { Signals } from './types';

export function verifyAction(a: Action, after: Signals): boolean {
  if (!after.adShowing) return true; // quảng cáo đã hết, coi như thành công
  switch (a.type) {
    case 'CLICK_SKIP':
      return !after.skipVisible;
    case 'MUTE_SPEEDUP':
      return (
        after.muted === true &&
        Math.abs((after.playbackRate ?? 0) - a.speed) < 0.01
      );
    case 'SEEK_TO_END':
      return (
        after.duration !== null &&
        after.currentTime !== null &&
        after.duration > 0 &&
        after.currentTime / after.duration >= 0.95
      );
  }
}