import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inspectHealth } from '../../src/stealth/watchdog';

describe('watchdog: giám sát selectors và ad fields', () => {
  let happyWindow: InstanceType<typeof Window>;
  let doc: Document;

  beforeEach(() => {
    happyWindow = new Window();
    doc = happyWindow.document as unknown as Document;
  });

  afterEach(() => {
    delete (happyWindow as any).ytInitialPlayerResponse;
  });

  it('báo cáo healthy = true khi có đủ selector và không rò rỉ trường QC', () => {
    const moviePlayer = doc.createElement('div');
    moviePlayer.id = 'movie_player';
    const video = doc.createElement('video');
    doc.body.appendChild(moviePlayer);
    doc.body.appendChild(video);

    (happyWindow as any).ytInitialPlayerResponse = {
      videoDetails: { videoId: 'clean123' },
    };

    const report = inspectHealth(doc);
    expect(report.healthy).toBe(true);
    expect(report.missingSelectors).toEqual([]);
    expect(report.leakedFields).toEqual([]);
  });

  it('phát hiện selector bị thiếu khi DOM thay đổi', () => {
    const report = inspectHealth(doc);
    expect(report.healthy).toBe(false);
    expect(report.missingSelectors).toContain('#movie_player');
    expect(report.missingSelectors).toContain('video');
  });

  it('phát hiện rò rỉ adPlacements hoặc playerAds trong response', () => {
    const moviePlayer = doc.createElement('div');
    moviePlayer.id = 'movie_player';
    const video = doc.createElement('video');
    doc.body.appendChild(moviePlayer);
    doc.body.appendChild(video);

    (happyWindow as any).ytInitialPlayerResponse = {
      adPlacements: [{ ad: 1 }],
      playerAds: [{ ad: 2 }],
    };

    const report = inspectHealth(doc);
    expect(report.healthy).toBe(false);
    expect(report.leakedFields).toEqual(['adPlacements', 'playerAds']);
  });
});
