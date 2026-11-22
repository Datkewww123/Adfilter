import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearTrackedPopunderTabs,
  handlePopunderTabNavigation,
  isHttpOrHttpsUrl,
} from '../../src/background/popunderTabGuard';
import { ext } from '../../src/platform/api';

describe('Background Popunder Tab Guard', () => {
  const removeSpy = vi.fn().mockResolvedValue(undefined);
  const updateSpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    clearTrackedPopunderTabs();
    removeSpy.mockClear();
    updateSpy.mockClear();
    Object.assign(ext, {
      tabs: {
        remove: removeSpy,
        update: updateSpy,
      },
    });
  });

  it('tự động đóng tab popunder bom88.adqc.net mở qua 302 redirect và trả focus về tab gốc', async () => {
    const t0 = 1_000_000;
    // 1. Tab 99 được mở từ tab phim 10 qua link 302 nội bộ `/go/123`
    const onRedirectStart = await handlePopunderTabNavigation(
      99,
      'https://animevietsub.bid/go/123',
      10,
      t0
    );
    expect(onRedirectStart).toBe(false);
    expect(removeSpy).not.toHaveBeenCalled();

    // 2. Sau 200ms, tab 99 chuyển hướng tới bom88.adqc.net/cpd/animevietsubpopunder
    const blocked = await handlePopunderTabNavigation(
      99,
      'https://bom88.adqc.net/cpd/animevietsubpopunder',
      undefined,
      t0 + 200
    );
    expect(blocked).toBe(true);
    expect(removeSpy).toHaveBeenCalledWith(99);
    expect(updateSpy).toHaveBeenCalledWith(10, { active: true });
  });

  it('không đóng nhầm tab do người dùng tự mở (không có openerTabId) hoặc sau TTL 15s', async () => {
    const t0 = 2_000_000;
    expect(
      await handlePopunderTabNavigation(
        50,
        'https://bom88.adqc.net/cpd/animevietsubpopunder',
        undefined,
        t0
      )
    ).toBe(false);
    expect(removeSpy).not.toHaveBeenCalled();

    // Tab mở từ tab 10 nhưng quá 15s sau mới điều hướng
    await handlePopunderTabNavigation(51, 'https://animevietsub.bid/tap-2', 10, t0);
    expect(
      await handlePopunderTabNavigation(
        51,
        'https://bom88.adqc.net/cpd/animevietsubpopunder',
        undefined,
        t0 + 16_000
      )
    ).toBe(false);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('không đóng tab hợp lệ (ChatGPT OAuth redirect_uri, GitHub issues/88 hoặc tên miền trong whitelist)', async () => {
    const t0 = 3_000_000;
    await handlePopunderTabNavigation(60, 'https://chatgpt.com/', 10, t0);
    expect(
      await handlePopunderTabNavigation(
        60,
        'https://auth.openai.com/authorize?client_id=abc&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fapi%2Fauth%2Fcallback',
        undefined,
        t0 + 150,
      ),
    ).toBe(false);
    expect(
      await handlePopunderTabNavigation(
        61,
        'https://github.com/org/repo/issues/88',
        10,
        t0 + 150,
      ),
    ).toBe(false);
    expect(
      await handlePopunderTabNavigation(
        62,
        'https://bom88.adqc.net/cpd/test',
        10,
        t0 + 150,
        ['bom88.adqc.net'],
      ),
    ).toBe(false);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('từ chối URL non-http khi kiểm tra điều hướng', () => {
    expect(isHttpOrHttpsUrl('https://bom88.adqc.net/')).toBe(true);
    expect(isHttpOrHttpsUrl('chrome://extensions/')).toBe(false);
    expect(isHttpOrHttpsUrl('about:blank')).toBe(false);
  });
});
