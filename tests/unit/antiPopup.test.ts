import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installAntiPopup, isSuspiciousUrl } from '../../src/stealth/antiPopup';

describe('AntiPopup Engine', () => {
  let fakeWindow: any;
  let originalOpenMock: any;

  beforeEach(() => {
    originalOpenMock = vi.fn().mockReturnValue({});
    fakeWindow = {
      open: originalOpenMock,
      addEventListener: vi.fn(),
    };
  });

  it('nhận diện chính xác URL quảng cáo / cờ bạc đáng ngờ', () => {
    expect(isSuspiciousUrl('https://shopee.vn/universal-link')).toBe(true);
    expect(isSuspiciousUrl('https://kubet88.net/casino')).toBe(true);
    expect(isSuspiciousUrl('https://big88.services/?utm_source=clickadu&utm_medium=popunder_123')).toBe(true);
    expect(isSuspiciousUrl('https://sunwinchinhhang.com/truyenqq')).toBe(true);
    expect(isSuspiciousUrl('https://gemwinchinhhang.com/promo')).toBe(true);
    expect(isSuspiciousUrl('https://debet.com/login')).toBe(true);
    expect(isSuspiciousUrl('https://five88.com/')).toBe(true);
    expect(isSuspiciousUrl('https://red88.com/')).toBe(true);
    expect(isSuspiciousUrl('https://bondeddarkenedswerve.com/sklnk/2117581')).toBe(true);
    expect(isSuspiciousUrl('https://bit.ly/adudr')).toBe(true);
    expect(isSuspiciousUrl('https://magiamgia.space/shopee')).toBe(true);
    expect(isSuspiciousUrl('https://vsbet.com/promo')).toBe(true);
    expect(isSuspiciousUrl('https://bom88.win/')).toBe(true);
    expect(isSuspiciousUrl('https://bom88.adqc.net/cpd/animevietsubpopunder')).toBe(true);
    expect(isSuspiciousUrl('https://yo88.club/')).toBe(true);
    expect(isSuspiciousUrl('https://zo88.vip/')).toBe(true);
    expect(isSuspiciousUrl('https://hit.club/')).toBe(true);
    expect(isSuspiciousUrl('https://nettruyen.com/chap-1')).toBe(false);
    expect(isSuspiciousUrl('')).toBe(false);
  });

  it('chặn popunder ăn theo khi bấm nút Play hoặc bấm card phim tới domain lạ bất kỳ (Intent Matching)', () => {
    let pointerDownCb: ((e?: Event) => void) | undefined;
    fakeWindow.location = { href: 'https://animevietsub.bid/phim/1', origin: 'https://animevietsub.bid' };
    fakeWindow.addEventListener = vi.fn((event: string, cb: (e?: Event) => void) => {
      if (event === 'pointerdown') {
        pointerDownCb = cb;
      }
    });

    const onBlocked = vi.fn();
    installAntiPopup(fakeWindow, { onBlocked });

    // 1. Giả lập click nút Play bên trong player
    const playTarget = {
      tagName: 'BUTTON',
      closest: (sel: string) => (sel.includes('player') ? {} : null),
    };
    pointerDownCb?.({ target: playTarget } as unknown as Event);
    expect(fakeWindow.open('https://unknown-brand-new-ad.xyz/tab', '_blank')).toBeNull();
    expect(originalOpenMock).not.toHaveBeenCalled();

    // 2. Giả lập click thẻ <a> phim nội bộ nhưng script mở kèm tab domain lạ
    const movieCardLink = {
      tagName: 'A',
      getAttribute: (k: string) => (k === 'href' ? '/anime/bo-1' : ''),
      closest: (sel: string) => (sel === 'a[href]' ? movieCardLink : null),
    };
    pointerDownCb?.({ target: movieCardLink } as unknown as Event);
    expect(fakeWindow.open('https://totally-new-popunder.net/go', '_blank')).toBeNull();
    expect(originalOpenMock).not.toHaveBeenCalled();

    // 3. Click link ngoài chủ đích thì cho phép mở đúng link đó
    const docLink = {
      tagName: 'A',
      getAttribute: (k: string) => (k === 'href' ? 'https://myanimelist.net/anime/1' : '_blank'),
      closest: (sel: string) => (sel === 'a[href]' ? docLink : null),
    };
    pointerDownCb?.({ target: docLink } as unknown as Event);
    fakeWindow.open('https://myanimelist.net/anime/1', '_blank');
    expect(originalOpenMock).toHaveBeenCalledTimes(1);
  });

  it('chặn thẻ <a target="_blank">.click() giả lập popunder trên mobile', () => {
    const origClick = vi.fn();
    class FakeAnchor {
      href = 'https://bit.ly/adudr';
      target = '_blank';
      getAttribute(name: string) {
        return name === 'target' ? this.target : this.href;
      }
    }
    (FakeAnchor.prototype as unknown as { click: () => void }).click = origClick;

    const onBlocked = vi.fn();
    const winWithAnchor = {
      ...fakeWindow,
      HTMLAnchorElement: FakeAnchor,
    };

    installAntiPopup(winWithAnchor, { onBlocked });

    const anchor = new FakeAnchor() as unknown as HTMLAnchorElement;
    anchor.click();

    expect(origClick).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith('https://bit.ly/adudr');
  });

  it('chặn window.open khi không có tương tác người dùng gần nhất', () => {
    const onBlocked = vi.fn();
    installAntiPopup(fakeWindow, { onBlocked });

    const result = fakeWindow.open('https://example.com/popup', '_blank');

    expect(result).toBeNull();
    expect(originalOpenMock).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith('https://example.com/popup');
  });

  it('chặn window.open tới trang cá cược / popunder ngay cả ngay sau khi người dùng vừa click', () => {
    let pointerDownCb: (() => void) | undefined;
    fakeWindow.addEventListener = vi.fn((event: string, cb: () => void) => {
      if (event === 'pointerdown') {
        pointerDownCb = cb;
      }
    });

    const onBlocked = vi.fn();
    installAntiPopup(fakeWindow, { onBlocked });

    // Giả lập người dùng vừa click chuột vào link chương truyện
    pointerDownCb?.();

    const popunderUrl =
      'https://big88.services/?a=8df17168&utm_source=clickadu&utm_medium=popunder_2117581';
    const result = fakeWindow.open(popunderUrl, '_blank');

    expect(result).toBeNull();
    expect(originalOpenMock).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith(popunderUrl);

    // Nhưng cho phép link hợp lệ do người dùng mở
    fakeWindow.open('https://truyenqqto.com/chap-2', '_blank');
    expect(originalOpenMock).toHaveBeenCalledTimes(1);
  });

  it('chặn native click tráo href lúc pointerdown và chặn <form target="_blank">.submit()', () => {
    const clickHandlers: Array<(e: Event) => void> = [];
    const pointerHandlers: Array<(e?: Event) => void> = [];
    const submitHandlers: Array<(e: Event) => void> = [];

    const origFormSubmit = vi.fn();
    class FakeForm {
      target = '_blank';
      action = 'https://bom88.adqc.net/cpd/animevietsubpopunder';
      getAttribute(k: string) {
        return k === 'target' ? this.target : this.action;
      }
    }
    (FakeForm.prototype as unknown as { submit: () => void }).submit = origFormSubmit;

    const fakeDoc = {
      addEventListener: vi.fn((type: string, cb: (e: Event) => void) => {
        if (type === 'click') clickHandlers.push(cb);
        if (type === 'submit') submitHandlers.push(cb);
      }),
    };
    const win = {
      open: vi.fn().mockReturnValue({}),
      location: { href: 'https://animevietsub.bid/', origin: 'https://animevietsub.bid' },
      document: fakeDoc,
      HTMLFormElement: FakeForm,
      addEventListener: vi.fn((type: string, cb: (e?: Event) => void) => {
        if (type === 'pointerdown') pointerHandlers.push(cb);
      }),
    } as unknown as Window;

    const onBlocked = vi.fn();
    installAntiPopup(win, { onBlocked });

    let currentHref = '#tap-1';
    const fakeAnchor = {
      tagName: 'A',
      get href() {
        return currentHref;
      },
      getAttribute: (k: string) => (k === 'href' ? currentHref : '_blank'),
      setAttribute: (_k: string, val: string) => {
        currentHref = val;
      },
      closest: (sel: string) => (sel === 'a[href]' ? fakeAnchor : null),
    };

    pointerHandlers.forEach((cb) => cb({ target: fakeAnchor } as unknown as Event));
    currentHref = 'https://bom88.adqc.net/cpd/animevietsubpopunder';

    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    clickHandlers.forEach((cb) =>
      cb({
        target: fakeAnchor,
        preventDefault,
        stopImmediatePropagation,
      } as unknown as Event)
    );

    expect(preventDefault).toHaveBeenCalled();
    expect(stopImmediatePropagation).toHaveBeenCalled();
    expect(currentHref).toBe('#tap-1');
    expect(onBlocked).toHaveBeenCalledWith('https://bom88.adqc.net/cpd/animevietsubpopunder');

    const fakeForm = new FakeForm() as unknown as HTMLFormElement;
    fakeForm.submit();
    expect(origFormSubmit).not.toHaveBeenCalled();
  });
});