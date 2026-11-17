// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { purgeFloatingAds, purgeFloatingElementSubtree } from '../../src/cosmetic/floatingBannerGuard';

describe('FloatingBannerGuard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('quét và ẩn thành công banner sticky dưới chân trang', () => {
    const banner = document.createElement('div');
    banner.id = 'bottom-ad-banner';
    banner.style.position = 'fixed';
    banner.style.bottom = '0px';
    document.body.appendChild(banner);

    const count = purgeFloatingAds(document);
    expect(count).toBe(1);
    expect(banner.style.display).toBe('none');
    expect(banner.style.height).toBe('0px');
  });

  it('quét và ẩn banner dọc hai bên sườn (side sticky banner)', () => {
    const sideBanner = document.createElement('div');
    sideBanner.className = 'qc-left-side';
    sideBanner.style.position = 'fixed';
    sideBanner.style.left = '0px';
    sideBanner.style.width = '160px';
    document.body.appendChild(sideBanner);

    const count = purgeFloatingAds(document);
    expect(count).toBe(1);
    expect(sideBanner.style.display).toBe('none');
  });

  it('không ẩn các thanh điều hướng chuẩn của trang (không chứa từ khóa quảng cáo)', () => {
    const navBar = document.createElement('div');
    navBar.id = 'main-navigation-bar';
    navBar.style.position = 'fixed';
    navBar.style.bottom = '0px';
    document.body.appendChild(navBar);

    const count = purgeFloatingAds(document);
    expect(count).toBe(0);
    expect(navBar.style.display).not.toBe('none');
  });

  it('khôi phục tự động scroll khi trang web cố tình khóa overflow', () => {
    document.body.style.overflow = 'hidden';
    purgeFloatingAds(document);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('quét và ẩn các banner nổi hai bên sườn kiểu TruyenQQ (floatLeft, floatRight, catfish) và container chứa link nhà cái', () => {
    const leftFlank = document.createElement('div');
    leftFlank.id = 'floating-left-container';
    leftFlank.style.position = 'fixed';
    leftFlank.style.left = '15px';
    document.body.appendChild(leftFlank);

    const rightFlank = document.createElement('div');
    rightFlank.id = 'floatRight';
    rightFlank.style.position = 'fixed';
    rightFlank.style.right = '15px';
    document.body.appendChild(rightFlank);

    const catfishModal = document.createElement('div');
    catfishModal.style.position = 'fixed';
    catfishModal.style.bottom = '20px';
    catfishModal.innerHTML = '<a href="https://five88.com/promo"><img src="https://mplmncb.com/banners-web/five88.gif"></a>';
    document.body.appendChild(catfishModal);

    const count = purgeFloatingAds(document);
    expect(count).toBe(3);
    expect(leftFlank.style.display).toBe('none');
    expect(rightFlank.style.display).toBe('none');
    expect(catfishModal.style.display).toBe('none');
  });

  it('ẩn host Closed Shadow DOM [data-adfilter-shadow-ad], .w-overlay và bảo toàn modal đăng nhập hợp lệ', () => {
    const shadowHost = document.createElement('div');
    shadowHost.setAttribute('data-adfilter-shadow-ad', '1');
    document.body.appendChild(shadowHost);

    const wOverlay = document.createElement('div');
    wOverlay.className = 'w-overlay w-overlay-popup abc123';
    document.body.appendChild(wOverlay);

    const loginModal = document.createElement('div');
    loginModal.id = 'login-modal';
    loginModal.style.position = 'fixed';
    loginModal.style.zIndex = '2147483005';
    loginModal.innerHTML = '<form><input type="email" /><button>Đăng nhập</button></form>';
    document.body.appendChild(loginModal);

    const count = purgeFloatingAds(document);
    expect(count).toBe(2);
    expect(shadowHost.style.display).toBe('none');
    expect(wOverlay.style.display).toBe('none');
    expect(loginModal.style.display).not.toBe('none');
  });

  it('ẩn popup làm mờ background có nút X ở z-index thường và dãy banner VSbet/YO88/HITCLUB/ZO88', () => {
    const dimmedModal = document.createElement('div');
    dimmedModal.style.position = 'fixed';
    dimmedModal.style.inset = '0';
    dimmedModal.style.zIndex = '9999';
    dimmedModal.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    dimmedModal.innerHTML = `
      <button class="close-btn">×</button>
      <a href="https://promo.example/out" target="_blank"><img src="https://cdn.example/banner.gif" /></a>
    `;
    document.body.appendChild(dimmedModal);

    const vsbetBanner = document.createElement('div');
    vsbetBanner.style.position = 'fixed';
    vsbetBanner.style.top = '0px';
    vsbetBanner.innerHTML = '<a href="/out/1"><img src="vsbet-tottenham.jpg" alt="VSbet" /></a>';
    document.body.appendChild(vsbetBanner);

    const count = purgeFloatingAds(document);
    expect(count).toBe(2);
    expect(dimmedModal.style.display).toBe('none');
    expect(vsbetBanner.style.display).toBe('none');
  });

  it('purgeFloatingElementSubtree ẩn ngay popup ở microtask 0ms không cần quét toàn document', () => {
    const dynamicWrap = document.createElement('div');
    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.inset = '0';
    popup.style.zIndex = '5000';
    popup.style.backgroundColor = 'rgba(0,0,0,0.7)';
    popup.innerHTML = '<button>×</button><a href="/go" target="_blank"><img src="x.gif" /></a>';
    dynamicWrap.appendChild(popup);
    document.body.appendChild(dynamicWrap);

    const hidden = purgeFloatingElementSubtree(dynamicWrap, document);
    expect(hidden).toBe(1);
    expect(popup.style.display).toBe('none');
  });

  it('không ẩn nhầm thanh điều khiển đọc truyện (reader/header/padding) hoặc danh sách chương dính cố định', () => {
    const readerBar = document.createElement('div');
    readerBar.className = 'reader-bottom-padding';
    readerBar.style.position = 'fixed';
    readerBar.style.bottom = '0px';
    readerBar.innerHTML = '<span>Trang 1/20</span>';

    const stickyChapterDrawer = document.createElement('div');
    stickyChapterDrawer.id = 'floating-chapter-drawer';
    stickyChapterDrawer.style.position = 'fixed';
    stickyChapterDrawer.style.left = '0px';
    stickyChapterDrawer.innerHTML = `
      <ul>
        <li><a href="/chap-1">Chương 1</a></li>
        <li><a href="/chap-2">Chương 2</a></li>
      </ul>
    `;

    document.body.appendChild(readerBar);
    document.body.appendChild(stickyChapterDrawer);

    const hidden = purgeFloatingAds(document);
    expect(hidden).toBe(0);
    expect(readerBar.style.display).not.toBe('none');
    expect(stickyChapterDrawer.style.display).not.toBe('none');
  });
});