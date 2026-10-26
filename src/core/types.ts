export type AdPhase = 'UNKNOWN' | 'NORMAL' | 'AD';
export interface Signals {
  t: number; // Date.now() tại thời điểm chụp
  playerFound: boolean;
  adShowing: boolean; // player có class ad-showing hoặc ad-interrupting
  adOverlay: boolean;
  adBadge: boolean;
  skipVisible: boolean;
  duration: number | null;
  currentTime: number | null;
  paused: boolean | null;
  label?: boolean; // dùng ở tuần 4: nhãn thật do bạn bấm phím
  muted?: boolean | null;
  playbackRate?: number | null;
  enforcement?: boolean; 
  adBadgeText?: string | null
}