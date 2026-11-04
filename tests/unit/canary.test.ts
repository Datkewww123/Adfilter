import { describe, expect, it } from 'vitest';
import { evaluateStructure } from '../../canary/evaluate';

describe('evaluateStructure', () => {
  it('đủ mọi thứ cần thiết thì ok', () => {
    expect(evaluateStructure({ player: true, video: true }, ['player', 'video'])).toEqual({
      ok: true,
      missing: [],
    });
  });

  it('liệt kê đúng phần tử thiếu', () => {
    expect(evaluateStructure({ player: true, video: false }, ['player', 'video'])).toEqual({
      ok: false,
      missing: ['video'],
    });
  });

  it('không có thông tin thì coi là thiếu', () => {
    expect(evaluateStructure({}, ['player']).missing).toEqual(['player']);
  });
});
