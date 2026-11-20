/**
 * Bẫy các cơ chế kiểm tra Anti-Adblock (FuckAdBlock, BlockAdBlock, AdBlock Detector)
 * chạy trực tiếp trong MAIN world.
 */
export function installAntiAdblockDefuser(win: Window = window): () => void {
  const restorers: Array<() => void> = [];
  try {
    // 1. Cung cấp các biến cờ toàn cục phổ biến mà thư viện Anti-Adblock hay đọc
    Object.defineProperty(win, 'canRunAds', {
      value: true,
      writable: false,
      configurable: true,
    });
    restorers.push(() => {
      try {
        delete (win as any).canRunAds;
      } catch {}
    });

    Object.defineProperty(win, 'isAdBlockActive', {
      value: false,
      writable: false,
      configurable: true,
    });
    restorers.push(() => {
      try {
        delete (win as any).isAdBlockActive;
      } catch {}
    });

    // 2. Bẫy đo kích thước thẻ mồi: nếu script của trang đo offsetHeight/offsetWidth của thẻ thử nghiệm ad
    const htmlProto =
      (win as any).HTMLElement?.prototype ||
      (typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : null);
    if (!htmlProto) {
      return () => {
        while (restorers.length > 0) restorers.pop()?.();
      };
    }

    const origOffsetHeightDesc = Object.getOwnPropertyDescriptor(htmlProto, 'offsetHeight');
    const originalOffsetHeight = origOffsetHeightDesc?.get;
    if (origOffsetHeightDesc && originalOffsetHeight) {
      Object.defineProperty(htmlProto, 'offsetHeight', {
        get(this: HTMLElement) {
          const className = this.className || '';
          const id = this.id || '';
          if (
            typeof className === 'string' &&
            /adsbox|pub_300x250|ad-placement|sponsor-check/i.test(`${className} ${id}`)
          ) {
            return 100; // Đánh lừa rằng thẻ mồi đang hiển thị với chiều cao 100px
          }
          return originalOffsetHeight.call(this);
        },
        configurable: true,
      });
      restorers.push(() => {
        try {
          Object.defineProperty(htmlProto, 'offsetHeight', origOffsetHeightDesc);
        } catch {}
      });
    }

    const origOffsetWidthDesc = Object.getOwnPropertyDescriptor(htmlProto, 'offsetWidth');
    const originalOffsetWidth = origOffsetWidthDesc?.get;
    if (origOffsetWidthDesc && originalOffsetWidth) {
      Object.defineProperty(htmlProto, 'offsetWidth', {
        get(this: HTMLElement) {
          const className = this.className || '';
          const id = this.id || '';
          if (
            typeof className === 'string' &&
            /adsbox|pub_300x250|ad-placement|sponsor-check/i.test(`${className} ${id}`)
          ) {
            return 300; // Đánh lừa rằng thẻ mồi đang hiển thị với chiều rộng 300px
          }
          return originalOffsetWidth.call(this);
        },
        configurable: true,
      });
      restorers.push(() => {
        try {
          Object.defineProperty(htmlProto, 'offsetWidth', origOffsetWidthDesc);
        } catch {}
      });
    }
  } catch {
    // Im lặng để không làm gián đoạn các trang web bình thường
  }

  return () => {
    while (restorers.length > 0) {
      restorers.pop()?.();
    }
  };
}
