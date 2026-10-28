import { describe, expect, it } from 'vitest';

describe('interceptor: nhận diện đúng URL cần thanh lọc', () => {
  const isPlayerUrl = (url: string) =>
    url.includes('/youtubei/v1/player') || url.includes('/youtubei/v1/next');

  it('nhận diện đúng URL gọi dữ liệu player', () => {
    expect(isPlayerUrl('https://www.youtube.com/youtubei/v1/player?prettyPrint=false')).toBe(true);
    expect(isPlayerUrl('https://www.youtube.com/youtubei/v1/next?key=AIzaSy')).toBe(true);
  });

  it('bỏ qua các URL video stream thông thường', () => {
    expect(isPlayerUrl('https://rr1---sn.googlevideo.com/videoplayback?expire=123')).toBe(false);
    expect(isPlayerUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
  });
});