// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  installDomAppendShield,
  shouldPreblockInsertedNode,
} from '../../src/stealth/scriptlets/domShield';

describe('Zero-Flash Pre-Append DOM Shield (MAIN world 0ms)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    installDomAppendShield(window);
  });

  it('nhận diện và ẩn ngay popup/catfish fixed trước khi appendChild đưa vào DOM', () => {
    const catfish = document.createElement('div');
    catfish.id = 'neutral-catfish';
    catfish.setAttribute('style', 'position: fixed; bottom: 0px; left: 0; right: 0; z-index: 900;');
    catfish.innerHTML = '<a href="https://hdbet.example/km" target="_blank"><img src="banner.gif" /></a>';

    expect(shouldPreblockInsertedNode(catfish, 'animehay.tv')).toBe(true);

    document.body.appendChild(catfish);
    expect(catfish.getAttribute('data-adfilter-preblocked')).toBe('1');
    expect(catfish.style.getPropertyValue('display')).toBe('none');
  });

  it('chặn ngay blurred modal có nút X qua insertBefore và Element.prototype.append', () => {
    const blurredModal = document.createElement('div');
    blurredModal.setAttribute(
      'style',
      'position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999;'
    );
    blurredModal.innerHTML =
      '<button type="button">×</button><a href="/out/1" target="_blank"><img src="promo.gif" /></a>';

    document.body.append(blurredModal);
    expect(blurredModal.getAttribute('data-adfilter-preblocked')).toBe('1');
    expect(blurredModal.style.getPropertyValue('display')).toBe('none');
  });

  it('không chặn nhầm modal đăng nhập hoặc container hợp lệ có form/input/video', () => {
    const loginModal = document.createElement('div');
    loginModal.id = 'login-modal';
    loginModal.setAttribute('style', 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999;');
    loginModal.innerHTML = '<form><input type="text" /><button>Đăng nhập</button></form>';

    expect(shouldPreblockInsertedNode(loginModal, 'animehay.tv')).toBe(false);

    document.body.appendChild(loginModal);
    expect(loginModal.getAttribute('data-adfilter-preblocked')).toBeNull();
    expect(loginModal.style.getPropertyValue('display')).not.toBe('none');
  });
});
