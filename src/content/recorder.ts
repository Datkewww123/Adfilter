import { buildFixture } from '../core/fixture';
import type { Signals } from '../core/types';

const MAX_FRAMES = 6000;
const MIN_STORE_GAP_MS = 1000;

const signature = (s: Signals): string =>
  [s.playerFound, s.adShowing, s.adOverlay, s.adBadge, s.skipVisible, s.paused, s.duration, s.label].join('|');

function download(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export class Recorder {
  private frames: Signals[] = [];
  private recording = false;
  private manualLabel = false;
  private currentLabel = false;
  private lastSig = '';
  private lastStoredAt = 0;
  private hud?: HTMLElement;

  constructor() {
    window.addEventListener('keydown', this.onKey);
  }

  feed(s: Signals): void {
    if (!this.recording) return;

    // Tự động nhận diện quảng cáo từ DOM, kết hợp nếu người dùng can thiệp thủ công
    const isAd = this.manualLabel || s.adShowing || s.adOverlay || s.adBadge;
    this.currentLabel = isAd;

    const frame: Signals = { ...s, label: isAd };
    const sig = signature(frame);
    if (sig === this.lastSig && s.t - this.lastStoredAt < MIN_STORE_GAP_MS) return;

    this.lastSig = sig;
    this.lastStoredAt = s.t;
    this.frames.push(frame);

    if (this.frames.length >= MAX_FRAMES) {
      this.recording = false;
      this.render('FULL, bấm Alt+Shift+E để lưu');
    } else if (this.hud) {
      this.render();
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    // Hỗ trợ cả Alt+Shift, chỉ cần Alt, hoặc phím F2 cho nhãn
    const isA = (e.altKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) || e.code === 'F2';
    const isR = e.altKey && (e.code === 'KeyR' || e.key.toLowerCase() === 'r');
    const isE = e.altKey && (e.code === 'KeyE' || e.key.toLowerCase() === 'e');

    if (isR) {
      this.toggleRecording();
      e.preventDefault();
    } else if (isA) {
      this.manualLabel = !this.manualLabel;
      this.currentLabel = this.manualLabel;
      this.render();
      e.preventDefault();
    } else if (isE) {
      this.exportAndClear();
      e.preventDefault();
    }
  };

  private toggleRecording(): void {
    this.recording = !this.recording;
    if (this.recording) {
      this.frames = [];
      this.lastSig = '';
      this.manualLabel = false;
      this.currentLabel = false;
    }
    this.render();
  }

  private exportAndClear(): void {
    if (this.frames.length === 0) {
      this.render('chưa có dữ liệu');
      return;
    }
    const note = window.prompt('Ghi chú (không ghi tên video hay tài khoản):', '') ?? '';
    const browser = navigator.userAgent.match(new RegExp('(Chrome|Firefox)/[0-9.]+'))?.[0] ?? 'unknown';
    const fixture = buildFixture(this.frames, { recordedAt: new Date().toISOString(), browser, note });
    download('fixture-' + fixture.meta.recordedAt.replace(/[:.]/g, '-') + '.json', fixture);
    this.recording = false;
    this.frames = [];
    this.manualLabel = false;
    this.currentLabel = false;
    this.render('đã lưu');
  }

  private render(extra = ''): void {
    if (!this.hud) {
      this.hud = document.createElement('div');
      this.hud.style.cssText =
        'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:4px 8px;font:12px monospace;color:#fff;background:#000c;border-radius:4px;cursor:pointer;user-select:none;transition:background 0.3s';
      this.hud.title = 'Click vào đây để đổi nhãn AD / no bằng chuột';
      this.hud.onclick = () => {
        this.manualLabel = !this.manualLabel;
        this.currentLabel = this.manualLabel;
        this.render();
      };
      document.body.appendChild(this.hud);
    }
    const state = this.recording ? 'REC' : 'IDLE';
    const label = this.currentLabel ? 'AD' : 'no';
    const tail = extra ? ' | ' + extra : '';
    this.hud.textContent = state + ' | label=' + label + ' | frames=' + this.frames.length + tail;
    // Đổi màu đỏ nổi bật khi có quảng cáo để bạn dễ nhìn bằng mắt!
    this.hud.style.backgroundColor = this.currentLabel ? '#d32f2fc9' : '#000000cc';
  }
}
