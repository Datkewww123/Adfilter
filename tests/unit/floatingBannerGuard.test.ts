// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { purgeFloatingAds } from '../../src/cosmetic/floatingBannerGuard';

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
});