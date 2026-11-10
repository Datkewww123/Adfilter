// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateUniqueSelector, startElementPicker } from '../../src/content/elementPicker';

describe('ElementPicker (Element Zapper / Visual Picker)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('hàm generateUniqueSelector tạo selector chuẩn xác theo ID, Class hoặc Nth-child', () => {
    const divId = document.createElement('div');
    divId.id = 'annoying-banner';
    document.body.appendChild(divId);
    expect(generateUniqueSelector(divId)).toBe('#annoying-banner');

    const divClass = document.createElement('div');
    divClass.className = 'promo-box popup-layer';
    document.body.appendChild(divClass);
    expect(generateUniqueSelector(divClass)).toBe('div.promo-box.popup-layer');

    const list = document.createElement('ul');
    const li1 = document.createElement('li');
    const li2 = document.createElement('li');
    list.appendChild(li1);
    list.appendChild(li2);
    document.body.appendChild(list);
    expect(generateUniqueSelector(li2)).toBe('li:nth-child(2)');
  });

  it('di chuột làm nổi bật phần tử với viền đỏ và phục hồi khi di chuột ra', () => {
    const box = document.createElement('div');
    box.id = 'ad-box';
    document.body.appendChild(box);

    const cleanup = startElementPicker(document);

    // Kích hoạt mouseover
    box.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(box.style.outline).toContain('solid');
    expect(box.style.cursor).toBe('crosshair');

    // Kích hoạt mouseout
    box.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(box.style.outline).toBe('');

    cleanup();
  });

  it('click vào phần tử thì xóa phần tử khỏi DOM và gọi callback onPicked', () => {
    const target = document.createElement('div');
    target.id = 'bad-ad-layer';
    document.body.appendChild(target);

    const onPickedSpy = vi.fn();
    startElementPicker(document, onPickedSpy);

    // Click vào target
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // Phần tử bị xóa khỏi DOM
    expect(document.getElementById('bad-ad-layer')).toBeNull();
    // Callback được gọi với selector
    expect(onPickedSpy).toHaveBeenCalledWith('#bad-ad-layer');
  });

  it('nhấn phím Escape hủy bỏ chế độ chọn mà không xóa phần tử', () => {
    const target = document.createElement('div');
    target.id = 'safe-element';
    document.body.appendChild(target);

    startElementPicker(document);

    // Di chuột vào phần tử
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(target.style.outline).not.toBe('');

    // Nhấn Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    // Outline được dọn dẹp và phần tử vẫn còn trong DOM
    expect(target.style.outline).toBe('');
    expect(document.getElementById('safe-element')).not.toBeNull();
  });
});
