import type { Action } from '../core/intervention';

export interface VideoLike {
  muted: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
}

export interface ActuatorDeps {
  getVideo: () => VideoLike | null;
  clickSkip: () => boolean;
}

export interface ActResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export class Actuator {
  private baseline: { muted: boolean; rate: number } | null = null;
  private touched = false;

  constructor(private readonly deps: ActuatorDeps) {}

  /** Gọi khi video đang bình thường để nhớ thiết lập của người dùng. */
  noteBaseline(): void {
    if (this.touched) return;
    const v = this.deps.getVideo();
    if (v) this.baseline = { muted: v.muted, rate: v.playbackRate };
  }

  touch(): void { this.touched = true; }

  apply(a: Action): ActResult {
    try {
      switch (a.type) {
        case 'CLICK_SKIP':
          return this.deps.clickSkip()
            ? { ok: true }
            : { ok: false, error: 'skip button not visible' };

        case 'MUTE_SPEEDUP': {
          const v = this.deps.getVideo();
          if (!v) return { ok: false, error: 'no video' };
          if (!this.baseline) return { ok: false, skipped: true, error: 'no baseline' };
          v.muted = true;
          v.playbackRate = a.speed;
          this.touched = true;
          return { ok: true };
        }

        case 'SEEK_TO_END': {
          const v = this.deps.getVideo();
          if (!v) return { ok: false, error: 'no video' };
          if (!Number.isFinite(v.duration) || v.duration <= 0) {
            return { ok: false, skipped: true, error: 'duration unknown' };
          }
          v.currentTime = Math.max(0, v.duration - 0.1);
          return { ok: true };
        }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Luôn gọi khi quảng cáo kết thúc, khi lỗi, hoặc khi tắt extension. */
  restore(): void {
    if (!this.baseline) return;
    try {
      const v = this.deps.getVideo();
      if (v && this.baseline) {
        v.muted = this.baseline.muted;
        v.playbackRate = this.baseline.rate;
      }
    } finally {
      this.touched = false;
    }
  }
}
