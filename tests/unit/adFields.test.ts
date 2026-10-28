import { describe, expect, it } from 'vitest';
import { AD_PLAYER_FIELDS, stripAdFields } from '../../src/core/adFields';

describe('adFields: danh sách trường quảng cáo', () => {
  it('danh sách có đủ các trường quảng cáo chính', () => {
    expect(AD_PLAYER_FIELDS).toContain('adPlacements');
    expect(AD_PLAYER_FIELDS).toContain('playerAds');
    expect(AD_PLAYER_FIELDS).toContain('adSlots');
    expect(AD_PLAYER_FIELDS).toContain('adBreaks');
    expect(AD_PLAYER_FIELDS).toContain('playbackTracking');
  });

  it('stripAdFields xóa đúng các trường QC mà giữ nguyên dữ liệu video chính', () => {
    const fake = {
      videoDetails: { videoId: 'abc123', title: 'Test Video' },
      adPlacements: [{ renderer: {} }],
      playerAds: [{ ad: {} }],
      adSlots: [{ slot: {} }],
      adBreaks: [{ break: {} }],
      playbackTracking: { ping: 'url' },
      streamingData: { formats: [] },
    };
    const result = stripAdFields(fake);
    expect(result.videoDetails).toEqual({ videoId: 'abc123', title: 'Test Video' });
    expect(result.streamingData).toEqual({ formats: [] });
    expect('adPlacements' in result).toBe(false);
    expect('playerAds' in result).toBe(false);
    expect('adSlots' in result).toBe(false);
    expect('adBreaks' in result).toBe(false);
    expect('playbackTracking' in result).toBe(false);
  });

  it('stripAdFields không lỗi khi đối tượng không có trường QC', () => {
    const clean = { videoDetails: { videoId: 'xyz' } };
    const result = stripAdFields(clean);
    expect(result.videoDetails).toEqual({ videoId: 'xyz' });
  });
});
