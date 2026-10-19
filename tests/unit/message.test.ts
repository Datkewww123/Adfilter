import { describe, it, expect } from 'vitest';
import { isMsg, statusKey, emptyStatus } from '../../src/core/messages';
describe('isMsg', () => {
  it('chấp nhận STATUS_UPDATE hợp lệ', () => {
    expect(isMsg({ kind: 'STATUS_UPDATE', status: emptyStatus() 
})).toBe(true);
  });
  it('chấp nhận GET_STATUS có tabId là số', () => {
    expect(isMsg({ kind: 'GET_STATUS', tabId: 7 })).toBe(true);
  });

  it.each([
    null,
    undefined,
    'x',
    42,
    {},
    { kind: 'GET_STATUS' },
    { kind: 'GET_STATUS', tabId: '7' },
    { kind: 'STATUS_UPDATE' },
    { kind: 'OTHER' },
  ])('từ chối đầu vào sai: %j', (input) => {
    expect(isMsg(input)).toBe(false);
  });
});
describe('statusKey', () => {
  it('ghép khóa theo tab', () => {
    expect(statusKey(12)).toBe('tab:12');
  });
});