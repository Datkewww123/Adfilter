import { describe, expect, it } from 'vitest';
import { pushRing } from '../../src/core/ring';

describe('pushRing', () => {
  it('thêm vào cuối khi chưa đầy', () => {
    expect(pushRing([1, 2], 3, 5)).toEqual([1, 2, 3]);
  });

  it('bỏ phần tử cũ nhất khi vượt sức chứa', () => {
    expect(pushRing([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it('không sửa mảng đầu vào', () => {
    const a = [1, 2];
    pushRing(a, 3, 5);
    expect(a).toEqual([1, 2]);
  });
});