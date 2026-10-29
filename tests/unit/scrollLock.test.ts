import { Window } from 'happy-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasBlockingDialog,
  releaseScrollLockIfSafe,
  SCROLL_LOCK_CLASSES,
  unlockScroll,
} from '../../src/stealth/scrollLock';

function makeVisible(el: Element): void {
  (el as any).getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 320,
    bottom: 200,
    width: 320,
    height: 200,
    toJSON: () => ({}),
  });
}

describe('scrollLock: mở khóa thanh cuộn YouTube', () => {
  let happyWindow: InstanceType<typeof Window>;
  let doc: Document;
  let app: HTMLElement;

  beforeEach(() => {
    happyWindow = new Window();
    doc = happyWindow.document as unknown as Document;
    app = doc.createElement('ytd-app');
    doc.body.appendChild(app);
  });

  function lockScroll(): void {
    for (const el of [doc.body, doc.documentElement, app]) {
      el.classList.add(...SCROLL_LOCK_CLASSES);
      el.style.overflow = 'hidden';
      el.style.overflowY = 'hidden';
    }
  }

  it('unlockScroll gỡ class no-scroll/no-y-scroll và inline overflow', () => {
    lockScroll();

    unlockScroll(doc);

    for (const el of [doc.body, doc.documentElement, app]) {
      expect(el.classList.contains('no-scroll')).toBe(false);
      expect(el.classList.contains('no-y-scroll')).toBe(false);
      expect(el.style.overflow).toBe('');
      expect(el.style.overflowY).toBe('');
    }
  });

  it('releaseScrollLockIfSafe mở khóa khi không có dialog nào', () => {
    lockScroll();

    expect(releaseScrollLockIfSafe(doc)).toBe(true);
    expect(doc.body.classList.contains('no-scroll')).toBe(false);
    expect(doc.body.style.overflow).toBe('');
  });

  it('giữ khóa khi có dialog thật đang hiển thị', () => {
    lockScroll();
    const dialog = doc.createElement('tp-yt-paper-dialog');
    makeVisible(dialog);
    doc.body.appendChild(dialog);

    expect(hasBlockingDialog(doc)).toBe(true);
    expect(releaseScrollLockIfSafe(doc)).toBe(false);
    expect(doc.body.classList.contains('no-scroll')).toBe(true);
  });

  it('bỏ qua dialog bị ẩn hoặc aria-hidden', () => {
    lockScroll();

    const ariaHidden = doc.createElement('tp-yt-paper-dialog');
    ariaHidden.setAttribute('aria-hidden', 'true');
    makeVisible(ariaHidden);
    doc.body.appendChild(ariaHidden);

    const noSize = doc.createElement('ytd-popup-modal');
    doc.body.appendChild(noSize);

    expect(hasBlockingDialog(doc)).toBe(false);
    expect(releaseScrollLockIfSafe(doc)).toBe(true);
  });

  it('không coi popup chặn quảng cáo là dialog thật', () => {
    lockScroll();

    const enforcementDialog = doc.createElement('tp-yt-paper-dialog');
    enforcementDialog.className = 'ytd-enforcement-message-view-model';
    makeVisible(enforcementDialog);
    doc.body.appendChild(enforcementDialog);

    const enforcementView = doc.createElement('ytd-enforcement-message-view-model');
    makeVisible(enforcementView);
    doc.body.appendChild(enforcementView);

    expect(hasBlockingDialog(doc)).toBe(false);
    expect(releaseScrollLockIfSafe(doc)).toBe(true);
    expect(doc.body.classList.contains('no-scroll')).toBe(false);
  });

  it('bỏ qua dialog cha có chứa phần tử enforcement', () => {
    lockScroll();

    const wrapper = doc.createElement('tp-yt-paper-dialog');
    makeVisible(wrapper);
    const enforcementView = doc.createElement('ytd-enforcement-message-view-model');
    wrapper.appendChild(enforcementView);
    doc.body.appendChild(wrapper);

    expect(hasBlockingDialog(doc)).toBe(false);
    expect(releaseScrollLockIfSafe(doc)).toBe(true);
  });
});
