// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { installShadowShield, isSuspiciousShadowHost } from '../../src/stealth/scriptlets/shadowShield';

describe('attachShadow Shield (Closed Shadow DOM Ad Widget Defense)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    installShadowShield(window);
  });

  it('nhận diện các host shadow widget quảng cáo phổ biến (.w-overlay, data-zone, fixed z-index cực đại)', () => {
    const wOverlay = document.createElement('div');
    wOverlay.className = 'w-overlay w-overlay-popup abc123';
    expect(isSuspiciousShadowHost(wOverlay, 'closed')).toBe(true);

    const zoneHost = document.createElement('div');
    zoneHost.setAttribute('data-zone', 'banner-top');
    expect(isSuspiciousShadowHost(zoneHost, 'closed')).toBe(true);

    const fixedHighZ = document.createElement('div');
    fixedHighZ.setAttribute('style', 'position:fixed;inset:0;z-index:2147483001;');
    expect(isSuspiciousShadowHost(fixedHighZ, 'closed')).toBe(true);

    const normalPlayer = document.createElement('video-controls');
    normalPlayer.className = 'player-controls';
    expect(isSuspiciousShadowHost(normalPlayer, 'open')).toBe(false);
  });

  it('tự động đánh dấu và ẩn host khi trang tạo Closed Shadow DOM .w-overlay', () => {
    const host = document.createElement('div');
    host.className = 'w-overlay w-overlay-catfish deadbeef';
    document.body.appendChild(host);

    const root = host.attachShadow({ mode: 'closed' });
    expect(root).toBeDefined();
    expect(host.getAttribute('data-adfilter-shadow-ad')).toBe('1');
    expect(host.style.getPropertyValue('display')).toBe('none');
  });

  it('bắt và ẩn cả host ngụy trang class ngẫu nhiên khi chèn link cá cược / CDN ảnh rác vào closed shadow root', () => {
    const randomHost = document.createElement('div');
    randomHost.className = 'x9k2m1';
    document.body.appendChild(randomHost);

    const closedRoot = randomHost.attachShadow({ mode: 'closed' });
    expect(randomHost.getAttribute('data-adfilter-shadow-ad')).toBeNull();

    const adBox = document.createElement('div');
    adBox.innerHTML =
      '<a href="https://debetchinhhang.com/truyenqqvietcom-popup"><img src="https://assets.yougetwhatyoupayfor.net/banners/debet.gif"></a>';
    closedRoot.appendChild(adBox);

    expect(randomHost.getAttribute('data-adfilter-shadow-ad')).toBe('1');
    expect(randomHost.style.getPropertyValue('display')).toBe('none');
  });

  it('không can thiệp Custom Element hợp lệ với open shadow root bình thường', () => {
    const widget = document.createElement('my-comment-box');
    document.body.appendChild(widget);

    const root = widget.attachShadow({ mode: 'open' });
    const p = document.createElement('p');
    p.textContent = 'Bình luận chương 1 rất hay!';
    root.appendChild(p);

    expect(widget.getAttribute('data-adfilter-shadow-ad')).toBeNull();
    expect(widget.style.getPropertyValue('display')).not.toBe('none');
  });
});
