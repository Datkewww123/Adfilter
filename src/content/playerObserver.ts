import { SEL } from './selectors';
import { extractSignals } from './extractSignals';
import type { Signals } from '../core/types';

const MIN_GAP_MS = 100;
const SAFETY_TICK_MS = 250;

export class PlayerObserver {
  private mo?: MutationObserver;
  private observed?: Element;
  private tick?: number;
  private last = 0;

  // Callback riêng được gọi tức thời (0ms) khi DOM phát hiện .ad-showing
  private onInstant?: () => void;

  constructor(
    private readonly onSignals: (s: Signals) => void,
    opts?: { onInstant?: () => void },
  ) {
    this.onInstant = opts?.onInstant;
  }

  start(): void {
    document.addEventListener('yt-navigate-finish', this.attach);
    this.attach();
    this.tick = window.setInterval(this.emit, SAFETY_TICK_MS);
  }

  stop(): void {
    document.removeEventListener('yt-navigate-finish', this.attach);
    this.mo?.disconnect();
    if (this.tick !== undefined) clearInterval(this.tick);
  }

  private attach = (): void => {
    const player = document.querySelector(SEL.player);
    if (!player || player === this.observed) return;

    this.mo?.disconnect();
    this.observed = player;
    this.mo = new MutationObserver(this.onMutation);
    this.mo.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
    this.emit();
  };

  /**
   * Callback MutationObserver: phát hiện class .ad-showing ngay lập tức (0ms)
   * và gọi onInstant trước khi qua throttle + debounce bình thường.
   */
  private onMutation = (mutations: MutationRecord[]): void => {
    // Kiểm tra nhanh nếu có mutation nào thay đổi class của #movie_player
    for (const m of mutations) {
      if (
        m.type === 'attributes' &&
        m.attributeName === 'class' &&
        m.target === this.observed
      ) {
        const el = m.target as Element;
        if (el.classList.contains('ad-showing') || el.classList.contains('ad-interrupting')) {
          // Gọi ngay lập tức — KHÔNG qua throttle hay debounce
          if (this.onInstant) this.onInstant();
        }
        break;
      }
    }
    // Sau đó mới emit theo cơ chế throttle bình thường
    this.emit();
  };

  private emit = (): void => {
    if (this.observed && !this.observed.isConnected) {
      this.mo?.disconnect();
      this.observed = undefined;
    }
    if (!this.observed) this.attach();

    const now = Date.now();
    if (now - this.last < MIN_GAP_MS) return;
    this.last = now;

    this.onSignals(extractSignals(document, now));
  };
}
