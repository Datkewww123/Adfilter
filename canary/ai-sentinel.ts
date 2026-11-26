import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { SELECTORS_DESKTOP } from '../src/content/selectors';
import {
  analyzeDriftWithGemini,
  detectAnomalies,
  extractKnownClassTokens,
  formatGitHubIssueMarkdown,
  validateProposedFindings,
  type PageAuditSnapshot,
  type ValidatedSiteReport,
} from './aiSentinelCore';

const rawUrls = (process.env.CANARY_URLS ?? process.env.CANARY_URL ?? '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

if (rawUrls.length === 0) {
  console.log('ℹ️ Chưa cấu hình CANARY_URLS — bỏ qua phiên tuần tra AI Canary.');
  process.exit(0);
}

async function loadKnownTokens(): Promise<Set<string>> {
  const files = ['src/stealth/cosmetic.css', 'src/content/selectors.ts', 'filters/vietnam.txt', 'filters/global.txt'];
  const contents = await Promise.all(
    files.map((f) => fs.readFile(path.resolve(f), 'utf8').catch(() => '')),
  );
  return extractKnownClassTokens(contents);
}

async function inspectUrl(url: string, extensionPath: string): Promise<PageAuditSnapshot | null> {
  const userDataDir = path.resolve('.tmp-canary-profile-' + Date.now());
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    await page.waitForTimeout(5_000);

    if (page.url().includes('consent.')) {
      console.log(`⚠️ [${url}] Gặp trang đồng ý cookie, bỏ qua.`);
      return null;
    }

    const parsedHost = new URL(page.url()).hostname;
    const isVideoPlatform =
      parsedHost === 'youtube.com' || parsedHost.endsWith('.youtube.com');

    if (isVideoPlatform) {
      const missingCoreSelectors: string[] = [];
      for (const key of ['player', 'video'] as const) {
        const count = await page.locator(SELECTORS_DESKTOP[key]).count();
        if (count === 0) missingCoreSelectors.push(`${key} (${SELECTORS_DESKTOP[key]})`);
      }

      const unknownAdClasses = await page.evaluate(() => {
        const player = document.querySelector('#movie_player');
        if (!player) return [] as string[];
        const found = new Set<string>();
        for (const el of Array.from(player.querySelectorAll('*'))) {
          for (const cls of Array.from(el.classList)) {
            if (/ad-|skip|promo|sponsor|enforcement/i.test(cls)) {
              found.add(cls);
            }
          }
        }
        return Array.from(found);
      });

      return {
        url: page.url(),
        hostname: parsedHost,
        kind: 'video-platform',
        missingCoreSelectors,
        unknownAdClasses,
        suspectVisibleElements: [],
      };
    }

    const suspectVisibleElements = await page.evaluate((currentHost) => {
      const suspects: Array<{
        tag: string;
        id: string;
        classes: string[];
        position: string;
        zIndex: string;
        width: number;
        height: number;
        hrefHost: string;
        textSnippet: string;
      }> = [];

      for (const el of Array.from(document.querySelectorAll<HTMLElement>('div, aside, section, iframe'))) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 40) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
          continue;
        }

        const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
        const externalAnchor = el.querySelector<HTMLAnchorElement>('a[href^="http"]');
        let hrefHost = '';
        if (externalAnchor) {
          try {
            const h = new URL(externalAnchor.href).hostname;
            if (h && h !== currentHost && !h.endsWith('.' + currentHost)) {
              hrefHost = h;
            }
          } catch {}
        }

        const hasGif = Boolean(el.querySelector('img[src*=".gif" i]'));
        if ((isFixedOrSticky && (hrefHost || hasGif)) || (hrefHost && hasGif)) {
          suspects.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            classes: Array.from(el.classList),
            position: style.position,
            zIndex: style.zIndex,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            hrefHost,
            textSnippet: (el.textContent || '').slice(0, 80),
          });
        }
      }
      return suspects;
    }, parsedHost);

    return {
      url: page.url(),
      hostname: parsedHost,
      kind: 'general-web',
      missingCoreSelectors: [],
      unknownAdClasses: [],
      suspectVisibleElements,
    };
  } finally {
    await context.close().catch(() => undefined);
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function maybeCreateGitHubIssue(title: string, body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // Tránh mở trùng Issue trong cùng ngày nếu đã có Issue [AI Canary] đang mở
  const listRes = await fetch(
    `https://api.github.com/repos/${repo}/issues?state=open&per_page=20`,
    { headers },
  );
  if (listRes.ok) {
    const openIssues = (await listRes.json()) as Array<{ title?: string; html_url?: string }>;
    const existing = openIssues.find((iss) => iss.title === title);
    if (existing) {
      console.log(`ℹ️ Đã có sẵn Issue mở cho hôm nay: ${existing.html_url}`);
      return;
    }
  }

  const createRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, body }),
  });
  if (createRes.ok) {
    const created = (await createRes.json()) as { html_url?: string };
    console.log(`✅ Đã tự động tạo GitHub Issue báo cáo: ${created.html_url}`);
  } else {
    console.warn(`⚠️ Không thể tạo GitHub Issue (${createRes.status})`);
  }
}

async function main(): Promise<void> {
  const extensionPath = path.resolve('dist/chromium');
  const knownTokens = await loadKnownTokens();
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const validatedReports: ValidatedSiteReport[] = [];

  for (const targetUrl of rawUrls) {
    console.log(`🔍 Đang kiểm tra: ${targetUrl}`);
    const snapshot = await inspectUrl(targetUrl, extensionPath);
    if (!snapshot) continue;

    const anomaly = detectAnomalies(snapshot, knownTokens);
    if (!anomaly.hasAnomaly) {
      console.log(`✅ [${snapshot.hostname}] Cấu trúc ổn định, không phát hiện rò rỉ quảng cáo.`);
      continue;
    }

    console.log(`⚠️ [${snapshot.hostname}] Phát hiện dấu hiệu mới:`, anomaly.reasons);
    if (!apiKey) {
      console.log('ℹ️ Chưa cấu hình GEMINI_API_KEY — chỉ ghi nhật ký dấu hiệu thô.');
      continue;
    }

    const diagnosis = await analyzeDriftWithGemini(anomaly.sanitizedSnapshot, apiKey);
    const report = validateProposedFindings(
      anomaly.sanitizedSnapshot,
      anomaly.reasons,
      diagnosis,
    );
    if (report) {
      validatedReports.push(report);
    } else {
      console.log(`✅ [${snapshot.hostname}] AI xác nhận không phải quảng cáo mới hoặc quy tắc không cần thiết.`);
    }
  }

  if (validatedReports.length > 0) {
    const issue = formatGitHubIssueMarkdown(validatedReports, new Date().toISOString());
    await fs.writeFile(path.resolve('canary-ai-report.md'), issue.body, 'utf8');
    console.log('\n📄 Đã xuất báo cáo chi tiết ra canary-ai-report.md');
    await maybeCreateGitHubIssue(issue.title, issue.body);
  } else {
    console.log('\n🎉 Hoàn tất tuần tra AI Canary — Toàn bộ trang mục tiêu đều hoạt động ổn định!');
  }
}

main().catch((err) => {
  console.error('❌ Lỗi khi chạy AI Canary Sentinel:', err);
  process.exit(1);
});
