import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isVastAdUrl,
  cleanVastXml,
  installVastInterceptor,
} from '../../src/stealth/videoAdInterceptor';

describe('VideoAdInterceptor (Web Phim VAST/VPAID)', () => {
  it('nhận diện chính xác URL quảng cáo video VAST và bỏ qua stream phim', () => {
    // VAST / VPAID / Ad Server URLs
    expect(isVastAdUrl('https://adserver.org/vast?tag=123')).toBe(true);
    expect(isVastAdUrl('https://imasdk.googleapis.com/js/core/bridge.html')).toBe(true);
    expect(isVastAdUrl('https://doubleclick.net/gampad/ads?vast=3')).toBe(true);
    expect(isVastAdUrl('https://cdn.movie.com/ads/preroll.xml')).toBe(true);

    // Media stream URLs (tuyệt đối không được chặn)
    expect(isVastAdUrl('https://cdn.movie.com/hls/stream.m3u8')).toBe(false);
    expect(isVastAdUrl('https://cdn.movie.com/video/chunk_001.ts')).toBe(false);
    expect(isVastAdUrl('https://cdn.movie.com/movies/full-hd.mp4')).toBe(false);
    expect(isVastAdUrl('https://www.youtube.com/watch?v=12345')).toBe(false);
    expect(isVastAdUrl('https://rr1---sn-xxx.googlevideo.com/videoplayback')).toBe(false);
  });

  it('hàm cleanVastXml trả về VAST rỗng khi phát hiện thẻ quảng cáo', () => {
    const rawVast = `
      <VAST version="3.0">
        <Ad id="12345">
          <InLine>
            <AdTitle>Gambling Preroll Ad</AdTitle>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4">https://bad-ad.com/ad.mp4</MediaFile>
            </MediaFiles>
          </InLine>
        </Ad>
      </VAST>
    `;
    const cleaned = cleanVastXml(rawVast);
    expect(cleaned).toContain('<VAST version="3.0"></VAST>');
    expect(cleaned).not.toContain('bad-ad.com');

    // Không phải XML VAST thì giữ nguyên
    const nonVast = '{"status": "ok"}';
    expect(cleanVastXml(nonVast)).toBe(nonVast);
  });

  it('bẫy fetch trả về XML VAST rỗng khi player web phim gọi URL quảng cáo', async () => {
    const fakeWin = {
      fetch: vi.fn().mockImplementation((input: any) => {
        return Promise.resolve(new Response('real movie stream', { status: 200 }));
      }),
    } as unknown as Window;

    installVastInterceptor(fakeWin);

    // 1. Gọi fetch tới URL quảng cáo VAST
    const adResponse = await fakeWin.fetch('https://adserver.com/vast?site=phimmoi');
    const adBody = await adResponse.text();
    expect(adResponse.status).toBe(200);
    expect(adBody).toContain('<VAST version="3.0"></VAST>');

    // 2. Gọi fetch tới file stream phim thật
    const movieResponse = await fakeWin.fetch('https://movie-cdn.com/film.m3u8');
    const movieBody = await movieResponse.text();
    expect(movieBody).toBe('real movie stream');
  });

  it('bẫy XMLHttpRequest trả về XML VAST rỗng với status 200', async () => {
    class MockXHR extends EventTarget {
      readyState = 0;
      status = 0;
      statusText = '';
      responseText = '';
      response = '';
      open(..._args: any[]) {}
      send(..._args: any[]) {}
    }

    const fakeWin = {
      XMLHttpRequest: MockXHR,
    } as any;

    installVastInterceptor(fakeWin);

    const xhr = new fakeWin.XMLHttpRequest();
    xhr.open('GET', 'https://adserver.com/vpaid/ad.xml');
    xhr.send();

    // Chờ microtask hoàn thành kích hoạt sự kiện
    await new Promise((r) => setTimeout(r, 20));

    expect(xhr.status).toBe(200);
    expect(xhr.responseText).toContain('<VAST version="3.0"></VAST>');
  });
});
