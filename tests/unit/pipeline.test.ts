// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { extractSignals } from '../../src/content/extractSignals';
import { runDetector } from '../../src/core/detector';

const load = (name: string) => readFileSync(`tests/fixtures/html/${name}`, 'utf8');
const sample = (times: number[]) => times.map((t) => extractSignals(document, t));
const types = (html: string) => {
  document.body.innerHTML = html;
  return runDetector(sample([0, 100, 200, 300])).map((e) => e.type);
};

describe('đường ống DOM, Signals, detector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('trang có quảng cáo thì phát AD_START', () => {
    expect(types(load('ad-showing.html'))).toEqual(['AD_START']);
  });

  it('class đổi tên nhưng lớp phủ và huy hiệu còn: vẫn nhận ra', () => {
    expect(types(load('ad-no-class.html'))).toEqual(['AD_START']);
  });

  it('chỉ có huy hiệu thì không phát gì', () => {
    expect(types(load('badge-only.html'))).toEqual([]);
  });

  it('trang bình thường không phát gì', () => {
    expect(types(load('normal.html'))).toEqual([]);
  });
});