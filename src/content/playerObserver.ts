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

  constructor(private readonly onSignals: (s: Signals) => void) {}

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
    this.mo = new MutationObserver(this.emit);
    this.mo.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
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