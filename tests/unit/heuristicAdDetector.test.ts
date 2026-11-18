// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { isIabBannerSize, scanAndHideHeuristicAds, IAB_SIZES } from '../../src/cosmetic/heuristicAdDetector';

describe('HeuristicAdDetector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('nhận diện chính xác toàn bộ các kích thước banner quảng cáo IAB', () => {
    for (const size of IAB_SIZES) {
      expect(isIabBannerSize(size.w, size.h)).toBe(true);
    }
  });

  it('chấp nhận dung sai kích thước +/- 5px cho banner thực tế', () => {
    expect(isIabBannerSize(302, 248)).toBe(true); // Gần 300x250
    expect(isIabBannerSize(725, 93)).toBe(true);  // Gần 728x90
    expect(isIabBannerSize(323, 52)).toBe(true);  // Gần 320x50
  });

  it('loại trừ các kích thước không phải quảng cáo (như trang truyện hay video)', () => {
    expect(isIabBannerSize(800, 1200)).toBe(false); // Ảnh trang truyện
    expect(isIabBannerSize(1920, 1080)).toBe(false); // Khung video Full HD
    expect(isIabBannerSize(50, 50)).toBe(false);    // Avatar / Icon
    expect(isIabBannerSize(0, 0)).toBe(false);
  });

  it('quét và ẩn thành công thẻ iframe quảng cáo có kích thước IAB', () => {
    const container = document.createElement('div');
    const iframe = document.createElement('iframe');
    
    // Giả lập kích thước bounding rect cho iframe
    iframe.getBoundingClientRect = () => ({
      width: 300,
      height: 250,
      top: 0,
      left: 0,
      right: 300,
      bottom: 250,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    container.appendChild(iframe);
    document.body.appendChild(container);

    const hiddenCount = scanAndHideHeuristicAds(document);
    expect(hiddenCount).toBe(1);
    expect(container.style.display).toBe('none');
    expect(container.style.height).toBe('0px');
  });

  it('không ẩn các iframe có kích thước thông thường (không phải banner quảng cáo)', () => {
    const iframe = document.createElement('iframe');
    iframe.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    document.body.appendChild(iframe);

    const hiddenCount = scanAndHideHeuristicAds(document);
    expect(hiddenCount).toBe(0);
    expect(iframe.style.display).not.toBe('none');
  });

  it('ẩn triệt để widget __clb-spot_, .my_banner, iframe sandbox about:blank và lưới 4 ô g-role="img" không dùng thẻ <a>', () => {
    document.body.innerHTML = `
      <article id="item-detail">
        <h1>Truyện hay</h1>
        <div class="my_banner">
          <iframe id="native-blank-frame" sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>
        </div>
        <div id="__clb-spot_2121458_ryo_3">
          <iframe id="__clb-spot_2121458_ryo_3_container" sandbox="allow-same-origin allow-scripts allow-popups-to-escape-sandbox"></iframe>
        </div>
        <div id="grid-native-no-anchor" style="display: grid; grid-template-columns: repeat(4, minmax(100px, 300px)); z-index: 2147483646;">
          <div><img g-role="img" src="https://um.vandalcuculla.click/tsk/abc" /></div>
          <div><img g-role="img" src="https://um.vandalcuculla.click/tsk/def" /></div>
          <div><img g-role="img" src="https://um.vandalcuculla.click/tsk/ghi" /></div>
          <div><img g-role="img" src="https://um.vandalcuculla.click/tsk/jkl" /></div>
        </div>
        <ul id="chapter-list">
          <li><a href="/chap-1">Chapter 1</a></li>
          <li><a href="/chap-2">Chapter 2</a></li>
        </ul>
      </article>
    `;

    const hiddenCount = scanAndHideHeuristicAds(document);
    expect(hiddenCount).toBeGreaterThanOrEqual(3);
    expect((document.querySelector('.my_banner') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('__clb-spot_2121458_ryo_3') as HTMLElement).style.display).toBe(
      'none'
    );
    expect((document.getElementById('grid-native-no-anchor') as HTMLElement).style.display).toBe(
      'none'
    );
    expect((document.getElementById('item-detail') as HTMLElement).style.display).not.toBe('none');
    expect((document.getElementById('chapter-list') as HTMLElement).style.display).not.toBe('none');
  });

  it('ẩn dải Native Ads 4 thẻ <a> trỏ cross-origin kèm tracking mà vẫn giữ nguyên iframe trình phát video', () => {
    const origUrl = window.location.href;
    Object.defineProperty(window, 'location', {
      value: { hostname: 'hitomi.la', href: 'https://hitomi.la/reader/1.html' },
      configurable: true,
    });

    try {
      document.body.innerHTML = `
        <iframe id="player-frame" src="https://embed.example/player/1" sandbox="allow-scripts allow-same-origin"></iframe>
        <div id="bottom-native-row">
          <a href="https://promo.realsrv.com/c?zone=101" target="_blank"><img src="https://cdn.realsrv.com/1.jpg" /><span>Sofia, 23</span></a>
          <a href="https://promo.realsrv.com/c?zone=102" target="_blank"><img src="https://cdn.realsrv.com/2.jpg" /><span>One little tap</span></a>
          <a href="https://promo.realsrv.com/c?zone=103" target="_blank"><img src="https://cdn.realsrv.com/3.jpg" /><span>Unlock</span></a>
          <a href="https://promo.realsrv.com/c?zone=104" target="_blank"><img src="https://cdn.realsrv.com/4.jpg" /><span>Dream</span></a>
        </div>
      `;

      scanAndHideHeuristicAds(document);

      expect((document.getElementById('bottom-native-row') as HTMLElement).style.display).toBe(
        'none'
      );
      expect((document.getElementById('player-frame') as HTMLElement).style.display).not.toBe(
        'none'
      );
    } finally {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost', href: origUrl },
        configurable: true,
      });
    }
  });
});