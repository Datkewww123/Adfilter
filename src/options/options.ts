import { loadConfig, saveConfig } from '../storage/configStore';
import type { YouTubeAdMode } from '../storage/config';
import { defaultStealthConfig, STEALTH_CONFIG_KEY, type StealthConfig } from '../core/stealthConfig';
import { ext } from '../platform/api';
import {
  CUSTOM_FILTERS_RAW_KEY,
  FILTER_LISTS_CONFIG_KEY,
  getFilterListsConfig,
  validateRemoteFilterUrl,
  type FilterListsConfig,
} from '../background/dynamicFilters';

const speed = document.getElementById('maxSpeed') as HTMLInputElement | null;
const seek = document.getElementById('allowSeek') as HTMLInputElement | null;

const youtubeAdModeEl = document.getElementById('youtubeAdMode') as HTMLSelectElement | null;
const youtubeAdModeHintEl = document.getElementById('youtubeAdModeHint');
const cosmetic = document.getElementById('cosmeticEnabled') as HTMLInputElement | null;
const mask = document.getElementById('visualMaskEnabled') as HTMLInputElement | null;
const fallback = document.getElementById('fastSeekFallback') as HTMLInputElement | null;

function renderYouTubeAdModeHint(mode: YouTubeAdMode): void {
  if (!youtubeAdModeHintEl) return;
  youtubeAdModeHintEl.textContent =
    mode === 'fast-skip'
      ? 'Chế độ A (khuyến nghị): Che đen + tắt tiếng + tua hết QC video đầu phiên (~0.3s), cho phép /api/stats/ads 1st-party để các video kế tiếp tải <1s (vẫn chặn 3rd-party DNR, /pagead/ & ad_break).'
      : 'Chế độ B: Chặn tuyệt đối tại nguồn (không gửi ping /api/stats/ads 1st-party), nhưng server YouTube có thể giữ luồng video 4–8 giây ở từng video có QC.';
}

const filterGlobalEl = document.getElementById('filterGlobalEnabled') as HTMLInputElement | null;
const filterVietnamEl = document.getElementById('filterVietnamEnabled') as HTMLInputElement | null;
const filterRedirectsEl = document.getElementById('filterRedirectsEnabled') as HTMLInputElement | null;
const remoteUrlsEl = document.getElementById('remoteFilterUrls') as HTMLTextAreaElement | null;
const customRulesEl = document.getElementById('customFilterRules') as HTMLTextAreaElement | null;
const saveFiltersBtn = document.getElementById('saveCustomFiltersBtn') as HTMLButtonElement | null;
const updateRemoteBtn = document.getElementById('updateRemoteFiltersBtn') as HTMLButtonElement | null;
const filterSyncStatusEl = document.getElementById('filterSyncStatus');
const lastUpdatedLabelEl = document.getElementById('lastUpdatedLabel');

async function getStealthConfig(): Promise<StealthConfig> {
  const r = await ext.storage.local.get(STEALTH_CONFIG_KEY);
  return { ...defaultStealthConfig, ...(r[STEALTH_CONFIG_KEY] ?? {}) };
}

async function saveStealthConfig(patch: Partial<StealthConfig>): Promise<void> {
  const cur = await getStealthConfig();
  await ext.storage.local.set({ [STEALTH_CONFIG_KEY]: { ...cur, ...patch } });
}

async function saveFilterListsPatch(patch: Partial<FilterListsConfig>): Promise<void> {
  const cur = await getFilterListsConfig();
  await ext.storage.local.set({ [FILTER_LISTS_CONFIG_KEY]: { ...cur, ...patch } });
  await requestFilterSync('SYNC_FILTERS');
}

function renderLastUpdated(ts: number): void {
  if (!lastUpdatedLabelEl) return;
  lastUpdatedLabelEl.textContent = ts > 0
    ? `Cập nhật bộ lọc từ xa gần nhất: ${new Date(ts).toLocaleString('vi-VN')}`
    : 'Mọi quy tắc tùy chỉnh luôn tự động loại trừ YouTube để giữ luồng phát an toàn.';
}

async function requestFilterSync(kind: 'SYNC_FILTERS' | 'UPDATE_REMOTE_FILTERS'): Promise<void> {
  if (filterSyncStatusEl) filterSyncStatusEl.textContent = 'Đang đồng bộ...';
  try {
    const res = (await ext.runtime.sendMessage({ kind })) as
      | { ok?: boolean; dynamicRulesCount?: number; cosmeticCount?: number }
      | undefined;
    if (res?.ok && filterSyncStatusEl) {
      filterSyncStatusEl.textContent = `Đã áp dụng ${res.dynamicRulesCount ?? 0} quy tắc mạng, ${res.cosmeticCount ?? 0} quy tắc ẩn`;
    } else if (filterSyncStatusEl) {
      filterSyncStatusEl.textContent = 'Đã lưu cấu hình.';
    }
    const cfg = await getFilterListsConfig();
    renderLastUpdated(cfg.lastUpdatedAt);
  } catch {
    if (filterSyncStatusEl) filterSyncStatusEl.textContent = 'Đã lưu cục bộ.';
  }
}

async function init(): Promise<void> {
  const c = await loadConfig();
  if (speed) speed.value = String(c.maxSpeed);
  if (seek) seek.checked = c.allowSeek;
  if (youtubeAdModeEl) youtubeAdModeEl.value = c.youtubeAdMode;
  renderYouTubeAdModeHint(c.youtubeAdMode);

  const sc = await getStealthConfig();
  if (cosmetic) cosmetic.checked = sc.cosmeticEnabled;
  if (mask) mask.checked = sc.visualMaskEnabled;
  if (fallback) fallback.checked = sc.fastSeekFallback;

  const fl = await getFilterListsConfig();
  if (filterGlobalEl) filterGlobalEl.checked = fl.globalEnabled;
  if (filterVietnamEl) filterVietnamEl.checked = fl.vietnamEnabled;
  if (filterRedirectsEl) filterRedirectsEl.checked = fl.redirectsEnabled;
  if (remoteUrlsEl) remoteUrlsEl.value = fl.remoteFilterUrls.join('\n');
  renderLastUpdated(fl.lastUpdatedAt);

  const rawRes = await ext.storage.local.get(CUSTOM_FILTERS_RAW_KEY);
  if (customRulesEl && typeof rawRes[CUSTOM_FILTERS_RAW_KEY] === 'string') {
    customRulesEl.value = rawRes[CUSTOM_FILTERS_RAW_KEY] as string;
  }
}

speed?.addEventListener('change', () => {
  const v = Number(speed.value);
  if (Number.isFinite(v)) void saveConfig({ maxSpeed: v }).then(init);
});
seek?.addEventListener('change', () => void saveConfig({ allowSeek: seek.checked }));

youtubeAdModeEl?.addEventListener('change', () => {
  const mode: YouTubeAdMode =
    youtubeAdModeEl.value === 'strict-defuser' ? 'strict-defuser' : 'fast-skip';
  renderYouTubeAdModeHint(mode);
  void saveConfig({ youtubeAdMode: mode }).then(() =>
    saveStealthConfig({ defuserEnabled: mode === 'strict-defuser' }),
  );
});
cosmetic?.addEventListener('change', () => void saveStealthConfig({ cosmeticEnabled: cosmetic.checked }));
mask?.addEventListener('change', () => void saveStealthConfig({ visualMaskEnabled: mask.checked }));
fallback?.addEventListener('change', () => void saveStealthConfig({ fastSeekFallback: fallback.checked }));

filterGlobalEl?.addEventListener('change', () => void saveFilterListsPatch({ globalEnabled: filterGlobalEl.checked }));
filterVietnamEl?.addEventListener('change', () => void saveFilterListsPatch({ vietnamEnabled: filterVietnamEl.checked }));
filterRedirectsEl?.addEventListener('change', () =>
  void saveFilterListsPatch({ redirectsEnabled: filterRedirectsEl.checked })
);

function parseValidatedUrls(): string[] {
  if (!remoteUrlsEl) return [];
  return remoteUrlsEl.value
    .split(/\r?\n/)
    .map((line) => validateRemoteFilterUrl(line))
    .filter((u): u is string => u !== null);
}

saveFiltersBtn?.addEventListener('click', () => {
  void (async () => {
    const remoteFilterUrls = parseValidatedUrls();
    const cur = await getFilterListsConfig();
    await ext.storage.local.set({
      [FILTER_LISTS_CONFIG_KEY]: { ...cur, remoteFilterUrls },
      [CUSTOM_FILTERS_RAW_KEY]: customRulesEl?.value ?? '',
    });
    await requestFilterSync('SYNC_FILTERS');
  })();
});

updateRemoteBtn?.addEventListener('click', () => {
  void (async () => {
    const remoteFilterUrls = parseValidatedUrls();
    const cur = await getFilterListsConfig();
    await ext.storage.local.set({
      [FILTER_LISTS_CONFIG_KEY]: { ...cur, remoteFilterUrls },
      [CUSTOM_FILTERS_RAW_KEY]: customRulesEl?.value ?? '',
    });
    await requestFilterSync('UPDATE_REMOTE_FILTERS');
  })();
});

void init();
