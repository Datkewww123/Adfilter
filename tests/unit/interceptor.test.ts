import { describe, expect, it } from 'vitest';
import {
  containsAdSignalText,
  extractRequestUrl,
  getRuntimeYouTubeAdMode,
  handleYouTubeAdModeMessage,
  isAdNetworkUrl,
  isPlayerDataUrl,
  isStreamingWatchUrl,
  purge,
  setRuntimeYouTubeAdMode,
} from '../../src/stealth/interceptor';
import {
  readCachedYouTubeAdMode,
  writeCachedYouTubeAdMode,
  YT_AD_MODE_MSG_TYPE,
} from '../../src/storage/config';

describe('interceptor: nhận diện đúng URL và thanh lọc dữ liệu quảng cáo YouTube', () => {
  it('nhận diện đúng URL gọi dữ liệu player (/player, /next, /get_watch)', () => {
    expect(isPlayerDataUrl('https://www.youtube.com/youtubei/v1/player?prettyPrint=false')).toBe(
      true,
    );
    expect(isPlayerDataUrl('https://www.youtube.com/youtubei/v1/next?key=AIzaSy')).toBe(true);
    expect(isPlayerDataUrl('https://www.youtube.com/youtubei/v1/get_watch?prettyPrint=false')).toBe(
      true,
    );
  });

  it('bỏ qua các URL video stream thông thường và không coi /player/ad_break là player data', () => {
    expect(isPlayerDataUrl('https://rr1---sn.googlevideo.com/videoplayback?expire=123')).toBe(
      false,
    );
    expect(isPlayerDataUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
    expect(isPlayerDataUrl('https://www.youtube.com/youtubei/v1/player/ad_break')).toBe(false);
  });

  it('chặn đúng endpoint remarketing gây lỗi CORS 302 và /player/ad_break', () => {
    expect(
      isAdNetworkUrl(
        'https://www.google.com/pagead/1p-user-list/962985656/?backend=innertube&cname=1&label=followon_view&ptype=no_rmkt',
      ),
    ).toBe(true);
    expect(
      isAdNetworkUrl('https://www.youtube.com/ads/user-lists/962985656/?backend=innertube'),
    ).toBe(true);
    expect(isAdNetworkUrl('https://www.youtube.com/youtubei/v1/player/ad_break')).toBe(true);
    expect(
      isAdNetworkUrl('https://www.youtube.com/api/stats/watchtime?ns=yt&el=detailpage'),
    ).toBe(false);
    expect(
      isAdNetworkUrl('https://www.youtube.com/ptracking?html5=1&video_id=DcClSK3sC'),
    ).toBe(false);
  });

  it('trích xuất URL an toàn từ string, URL hoặc Request-like object', () => {
    expect(extractRequestUrl('https://www.youtube.com/youtubei/v1/player')).toBe(
      'https://www.youtube.com/youtubei/v1/player',
    );
    expect(extractRequestUrl(new URL('https://www.youtube.com/youtubei/v1/get_watch'))).toBe(
      'https://www.youtube.com/youtubei/v1/get_watch',
    );
    expect(extractRequestUrl({ url: 'https://www.youtube.com/youtubei/v1/next' })).toBe(
      'https://www.youtube.com/youtubei/v1/next',
    );
  });

  it('làm sạch payload mảng get_watch và xóa remarketing URL nhưng giữ nguyên tracking xem video', () => {
    const payload = [
      {
        playerResponse: {
          adPlacements: [{ adPlacementRenderer: {} }],
          playerAds: [{ playerLegacyDesktopWatchAdsRenderer: {} }],
          adSlots: [{ adSlotRenderer: {} }],
          adBreakParams: 'secret',
          playbackTracking: {
            googleRemarketingUrl: { baseUrl: 'https://www.google.com/pagead/1p-user-list/962985656/' },
            youtubeRemarketingUrl: { baseUrl: 'https://www.youtube.com/ads/user-lists/962985656/' },
            ptrackingUrl: { baseUrl: 'https://www.youtube.com/ptracking?html5=1' },
            qoeUrl: { baseUrl: 'https://s.youtube.com/api/stats/qoe' },
            videostatsPlaybackUrl: { baseUrl: 'https://www.youtube.com/api/stats/playback' },
            videostatsWatchtimeUrl: { baseUrl: 'https://www.youtube.com/api/stats/watchtime' },
            atrUrl: { baseUrl: 'https://www.youtube.com/api/stats/atr' },
          },
        },
      },
      {
        watchNextResponse: {
          adSlots: [{ slot: 1 }],
        },
      },
    ];

    expect(purge(payload)).toBe(true);

    expect(payload[0].playerResponse?.adPlacements).toEqual([]);
    expect(payload[0].playerResponse?.playerAds).toEqual([]);
    expect(payload[0].playerResponse?.adSlots).toEqual([]);
    expect(payload[0].playerResponse?.adBreakParams).toBeUndefined();
    expect(payload[0].playerResponse?.playbackTracking.googleRemarketingUrl).toBeUndefined();
    expect(payload[0].playerResponse?.playbackTracking.youtubeRemarketingUrl).toBeUndefined();
    expect(payload[0].playerResponse?.playbackTracking.ptrackingUrl).toBeDefined();
    expect(payload[0].playerResponse?.playbackTracking.qoeUrl).toBeDefined();
    expect(payload[0].playerResponse?.playbackTracking.videostatsPlaybackUrl).toBeDefined();
    expect(payload[0].playerResponse?.playbackTracking.videostatsWatchtimeUrl).toBeDefined();
    expect(payload[0].playerResponse?.playbackTracking.atrUrl).toBeDefined();
    expect(payload[1].watchNextResponse?.adSlots).toEqual([]);
  });

  it('containsAdSignalText nhận diện nhanh text chứa tín hiệu ad và bỏ qua payload sạch', () => {
    expect(containsAdSignalText('{}')).toBe(false);
    expect(containsAdSignalText('{"videoDetails":{"videoId":"dQw4w9WgXcQ","isLive":false}}')).toBe(
      false,
    );
    expect(containsAdSignalText('{"adPlacements":[{"adPlacementRenderer":{}}]}')).toBe(true);
    expect(containsAdSignalText('{"playerAds":[{}]}')).toBe(true);
    expect(containsAdSignalText('{"adSlots":[{}]}')).toBe(true);
    expect(containsAdSignalText('{"adBreakParams":"abc"}')).toBe(true);
    expect(containsAdSignalText('{"googleRemarketingUrl":{"baseUrl":"x"}}')).toBe(true);
    expect(containsAdSignalText('{"reelWatchEndpoint":{"adClientParams":{}}}')).toBe(true);
  });

  it('purge trả về false cho VOD payload sạch và true khi thực sự sửa dữ liệu', () => {
    const cleanVod = {
      videoDetails: { videoId: 'abc123', lengthSeconds: '240', isLive: false },
      streamingData: { formats: [{ url: 'https://rr1---sn.googlevideo.com/videoplayback' }] },
      playbackTracking: {
        ptrackingUrl: { baseUrl: 'https://www.youtube.com/ptracking?html5=1' },
      },
    };
    expect(purge(cleanVod)).toBe(false);

    const dirtyVod = {
      adPlacements: [{ adPlacementRenderer: {} }],
      videoDetails: { videoId: 'xyz' },
    };
    expect(purge(dirtyVod)).toBe(true);
    expect(dirtyVod.adPlacements).toEqual([]);
  });

  it('isStreamingWatchUrl nhận diện riêng endpoint streaming /youtubei/v1/get_watch', () => {
    expect(isStreamingWatchUrl('https://www.youtube.com/youtubei/v1/get_watch?prettyPrint=false')).toBe(
      true,
    );
    expect(isStreamingWatchUrl('https://www.youtube.com/youtubei/v1/player?prettyPrint=false')).toBe(
      false,
    );
    expect(isStreamingWatchUrl('https://www.youtube.com/youtubei/v1/next?key=AIzaSy')).toBe(false);
  });

  it('chế độ fast-skip giữ nguyên adSlots/adPlacements và /api/stats/ads 1st-party nhưng vẫn chặn remarketing, Shorts ad, /pagead/ và ad_break', () => {
    expect(isAdNetworkUrl('https://www.youtube.com/api/stats/ads?foo=1', 'fast-skip')).toBe(false);
    expect(isAdNetworkUrl('https://m.youtube.com/api/stats/ads?foo=1', 'fast-skip')).toBe(false);
    expect(isAdNetworkUrl('https://s.youtube.com/api/stats/ads?foo=1', 'fast-skip')).toBe(false);
    expect(isAdNetworkUrl('https://www.youtube.com/api/stats/ads?foo=1', 'strict-defuser')).toBe(
      true,
    );
    expect(isAdNetworkUrl('https://www.youtube.com/pagead/viewthroughconversion', 'fast-skip')).toBe(
      true,
    );
    expect(
      isAdNetworkUrl(
        'https://www.youtube.com/pagead/viewthroughconversion?next=/api/stats/ads',
        'fast-skip',
      ),
    ).toBe(true);
    expect(isAdNetworkUrl('https://evil-youtube.com/api/stats/ads?foo=1', 'fast-skip')).toBe(true);
    expect(
      isAdNetworkUrl('https://youtube.com.attacker.org/api/stats/ads?foo=1', 'fast-skip'),
    ).toBe(true);
    expect(
      isAdNetworkUrl(
        'https://bad-site.com/track?target=https://www.youtube.com/api/stats/ads',
        'fast-skip',
      ),
    ).toBe(true);
    expect(isAdNetworkUrl('https://www.youtube.com/youtubei/v1/player/ad_break', 'fast-skip')).toBe(
      true,
    );
    expect(isAdNetworkUrl('https://googleads.g.doubleclick.net/pagead/id', 'fast-skip')).toBe(
      true,
    );

    const payload = {
      adPlacements: [{ adPlacementRenderer: {} }],
      playerAds: [{ x: 1 }],
      adSlots: [{ slot: 1 }],
      adBreakParams: 'keep-for-cooldown',
      playbackTracking: {
        googleRemarketingUrl: { baseUrl: 'https://www.google.com/pagead/1p-user-list/' },
        ptrackingUrl: { baseUrl: 'https://www.youtube.com/ptracking' },
      },
      entries: [
        { command: { reelWatchEndpoint: { videoId: 'normal1' } } },
        { command: { reelWatchEndpoint: { videoId: 'ad1', ad: {} } } },
      ],
    };

    expect(purge(payload, 0, 'fast-skip')).toBe(true);
    expect(payload.adPlacements).toHaveLength(1);
    expect(payload.playerAds).toHaveLength(1);
    expect(payload.adSlots).toHaveLength(1);
    expect(payload.adBreakParams).toBe('keep-for-cooldown');
    expect(payload.playbackTracking.googleRemarketingUrl).toBeUndefined();
    expect(payload.playbackTracking.ptrackingUrl).toBeDefined();
    expect(payload.entries).toHaveLength(1);

    expect(containsAdSignalText('{"adSlots":[{}]}', 'fast-skip')).toBe(false);
    expect(containsAdSignalText('{"googleRemarketingUrl":{}}', 'fast-skip')).toBe(true);
    expect(containsAdSignalText('{"reelWatchEndpoint":{}}', 'fast-skip')).toBe(true);
  });

  it('đồng bộ chế độ YouTubeAdMode qua cache localStorage và postMessage live', () => {
    const backing = new Map<string, string>();
    const fakeStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => {
        backing.set(k, v);
      },
    };
    writeCachedYouTubeAdMode('strict-defuser', fakeStorage);
    expect(readCachedYouTubeAdMode(fakeStorage)).toBe('strict-defuser');
    setRuntimeYouTubeAdMode(readCachedYouTubeAdMode(fakeStorage));
    expect(getRuntimeYouTubeAdMode()).toBe('strict-defuser');

    // Khi storage bị chặn (about:blank), luôn fallback an toàn về mặc định fast-skip
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => writeCachedYouTubeAdMode('strict-defuser', throwingStorage)).not.toThrow();
    expect(readCachedYouTubeAdMode(throwingStorage)).toBe('fast-skip');

    const fakeWin = {};
    const otherWin = {};
    handleYouTubeAdModeMessage(
      { source: otherWin, data: { type: YT_AD_MODE_MSG_TYPE, mode: 'fast-skip' } },
      fakeWin,
    );
    expect(getRuntimeYouTubeAdMode()).toBe('strict-defuser');

    handleYouTubeAdModeMessage(
      { source: fakeWin, data: { type: YT_AD_MODE_MSG_TYPE, mode: 'fast-skip' } },
      fakeWin,
    );
    expect(getRuntimeYouTubeAdMode()).toBe('fast-skip');
  });

  it('purge không treo hay ném lỗi trên object vòng lặp, getter lỗi hoặc Object.freeze', () => {
    const cyclic: Record<string, unknown> = { adPlacements: [{ id: 1 }] };
    for (let i = 0; i < 12; i++) cyclic[`ref${i}`] = cyclic;
    Object.defineProperty(cyclic, 'brokenGetter', {
      enumerable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(() => purge(cyclic, 0, 'strict-defuser')).not.toThrow();
    expect(cyclic.adPlacements).toEqual([]);

    const frozen = Object.freeze({ adPlacements: [{ id: 1 }], adBreakParams: 'x' });
    expect(() => purge(frozen, 0, 'strict-defuser')).not.toThrow();
  });
});