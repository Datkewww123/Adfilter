// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { collapseEmptyAdSlots } from '../../src/cosmetic/elementCollapsing';

describe('ElementCollapsing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('co rút thành công khung chứa quảng cáo rỗng về chiều cao 0px', () => {
    const emptySlot = document.createElement('div');
    emptySlot.className = 'ad-container';
    emptySlot.style.height = '250px';
    emptySlot.style.margin = '20px';
    document.body.appendChild(emptySlot);

    const count = collapseEmptyAdSlots(document);
    expect(count).toBe(1);
    expect(emptySlot.style.display).toBe('none');
    expect(emptySlot.style.height).toBe('0px');
    expect(emptySlot.style.margin).toBe('0px');
  });

  it('co rút khung chỉ chứa khoảng trắng vô nghĩa', () => {
    const whitespaceSlot = document.createElement('div');
    whitespaceSlot.id = 'banner-ads-top';
    whitespaceSlot.textContent = '   \n  \t  ';
    document.body.appendChild(whitespaceSlot);

    const count = collapseEmptyAdSlots(document);
    expect(count).toBe(1);
    expect(whitespaceSlot.style.display).toBe('none');
  });

  it('không co rút các phần tử chứa nội dung thật của trang', () => {
    const validContent = document.createElement('div');
    validContent.className = 'ad-container'; // Dù class có chữ ad
    validContent.textContent = 'Chương 125: Đại chiến gia tộc'; // Nhưng chứa chữ thật của truyện
    document.body.appendChild(validContent);

    const count = collapseEmptyAdSlots(document);
    expect(count).toBe(0);
    expect(validContent.style.display).not.toBe('none');
  });

  it('co rút khung mà toàn bộ con bên trong đã bị ẩn (display: none)', () => {
    const parentHolder = document.createElement('div');
    parentHolder.className = 'ads-wrapper';
    parentHolder.id = 'ad-slot-1';

    const hiddenChild = document.createElement('div');
    hiddenChild.style.display = 'none';
    parentHolder.appendChild(hiddenChild);
    document.body.appendChild(parentHolder);

    const count = collapseEmptyAdSlots(document);
    expect(count).toBe(1);
    expect(parentHolder.style.height).toBe('0px');
  });
});