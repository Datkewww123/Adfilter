// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSecurityChallengeCooldown,
  isSecurityChallengeHost,
  isSecurityChallengeUrl,
  isSecurityInterstitialDocument,
  isSecurityWidgetElement,
  markSecurityChallengeCooldown,
  readSecurityChallengeCooldown,
} from '../../src/core/securityChallenge';

describe('SecurityChallenge: nhận diện và bảo vệ trang xác thực chống bot', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.title = 'Normal Page';
    delete (window as unknown as Record<string, unknown>)._cf_chl_opt;
    delete (window as unknown as Record<string, unknown>).__CF$cv$params;
  });

  it('nhận diện chính xác các domain và đường dẫn xác thực (Cloudflare, hCaptcha, reCAPTCHA, WAF...) và chống giả mạo tên miền', () => {
    expect(isSecurityChallengeHost('challenges.cloudflare.com')).toBe(true);
    expect(isSecurityChallengeHost('sub.hcaptcha.com')).toBe(true);
    expect(isSecurityChallengeHost('www.recaptcha.net')).toBe(true);
    expect(isSecurityChallengeHost('www.google.com', '/recaptcha/api2/anchor')).toBe(true);
    expect(isSecurityChallengeHost('evil-cloudflare.com')).toBe(false);
    expect(isSecurityChallengeHost('www.google.com', '/search')).toBe(false);

    expect(isSecurityChallengeUrl('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1')).toBe(true);
    expect(isSecurityChallengeUrl('https://dtv-ebook.com.vn/cdn-cgi/challenge-platform/scripts/jsd/main.js')).toBe(true);
    expect(isSecurityChallengeUrl('https://dtv-ebook.com.vn/van-co.html?__cf_chl_rt_tk=abc123')).toBe(true);
    expect(isSecurityChallengeUrl('https://www.google.com/recaptcha/api2/anchor?k=123')).toBe(true);
    expect(isSecurityChallengeUrl('https://api.arkoselabs.com/fc/gc/')).toBe(true);
    expect(isSecurityChallengeUrl('https://geo.captcha-delivery.com/captcha/')).toBe(true);
    expect(isSecurityChallengeUrl('https://static.geetest.com/v4/')).toBe(true);
    expect(isSecurityChallengeUrl('https://check.ddos-guard.net/check.js')).toBe(true);
    expect(isSecurityChallengeUrl('https://edge.awswaf.com/challenge')).toBe(true);
    expect(isSecurityChallengeUrl('https://client.px-cdn.net/captcha')).toBe(true);

    // Chống URL giả mạo (CodeQL Incomplete URL Substring Sanitization)
    expect(isSecurityChallengeUrl('https://evil-cloudflare.com/cdn/ad.js')).toBe(false);
    expect(isSecurityChallengeUrl('https://bad.com/?u=https://challenges.cloudflare.com/')).toBe(false);
    expect(isSecurityChallengeUrl('https://dtv-ebook.com.vn/van-co-toi-cuong-tong_14770.html')).toBe(false);

    // Nền tảng ứng dụng & SSO sạch được miễn trừ an toàn
    expect(isSecurityChallengeHost('chatgpt.com')).toBe(true);
    expect(isSecurityChallengeHost('auth.openai.com')).toBe(true);
    expect(isSecurityChallengeHost('accounts.google.com')).toBe(true);
    expect(isSecurityChallengeHost('login.microsoftonline.com')).toBe(true);
    expect(isSecurityChallengeUrl('https://auth.openai.com/authorize?redirect_uri=https://chatgpt.com')).toBe(true);
  });

  it('nhận diện trang chờ xác thực toàn trang và không nhận nhầm trang web thường có widget comment', () => {
    const cfByOptWin = {
      location: { href: 'https://dtv-ebook.com.vn/van-co.html', origin: 'https://dtv-ebook.com.vn' },
      _cf_chl_opt: { cvId: '3' },
      document,
    } as unknown as Window;
    expect(isSecurityInterstitialDocument(cfByOptWin, document)).toBe(true);

    document.body.innerHTML = '<div id="challenge-running">Checking your browser...</div>';
    expect(isSecurityInterstitialDocument(window, document)).toBe(true);

    document.body.innerHTML = '<script src="/cdn-cgi/challenge-platform/h/b/orchestrate"></script>';
    expect(isSecurityInterstitialDocument(window, document)).toBe(true);

    document.body.innerHTML =
      '<h1>dtv-ebook.com.vn</h1><p>Performing security verification. Ray ID: a5cdccf08f4afcf0</p>';
    document.title = 'Just a moment...';
    expect(isSecurityInterstitialDocument(window, document)).toBe(true);

    // Trang đọc truyện bình thường dù có form bình luận kèm 1 khung recaptcha vẫn KHÔNG bị coi là trang chờ toàn trang
    document.title = 'Vạn Cổ Tối Cường Tông - DTV Ebook';
    document.body.innerHTML =
      '<main><article><p>Chương 1 nội dung truyện</p></article><form><div class="g-recaptcha"></div><button>Gửi</button></form></main>';
    expect(isSecurityInterstitialDocument(window, document)).toBe(false);
  });

  it('nhận diện đúng widget xác thực (Turnstile/captcha) qua class/id hoặc iframe src', () => {
    const turnstile = document.createElement('div');
    turnstile.className = 'cf-turnstile';
    const inner = document.createElement('span');
    turnstile.appendChild(inner);
    document.body.appendChild(turnstile);
    expect(isSecurityWidgetElement(turnstile)).toBe(true);
    expect(isSecurityWidgetElement(inner)).toBe(true);

    const frame = document.createElement('iframe');
    frame.setAttribute('src', 'https://challenges.cloudflare.com/turnstile/f/ov2/av0/rch');
    document.body.appendChild(frame);
    expect(isSecurityWidgetElement(frame)).toBe(true);

    const adBanner = document.createElement('div');
    adBanner.className = 'w-overlay w-overlay-popup';
    document.body.appendChild(adBanner);
    expect(isSecurityWidgetElement(adBanner)).toBe(false);
  });

  it('quản lý cooldown sessionStorage an toàn và chịu lỗi khi storage bị khóa', () => {
    const mem = new Map<string, string>();
    const fakeStore: Storage = {
      length: 0,
      clear: () => mem.clear(),
      key: () => null,
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        mem.set(k, v);
      },
      removeItem: (k) => {
        mem.delete(k);
      },
    };

    expect(readSecurityChallengeCooldown(fakeStore, 1000)).toBe(false);
    markSecurityChallengeCooldown(fakeStore, 30_000, 1000);
    expect(readSecurityChallengeCooldown(fakeStore, 5000)).toBe(true);
    expect(readSecurityChallengeCooldown(fakeStore, 35_000)).toBe(false);
    clearSecurityChallengeCooldown(fakeStore);
    expect(readSecurityChallengeCooldown(fakeStore, 5000)).toBe(false);

    const throwingStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => markSecurityChallengeCooldown(throwingStore)).not.toThrow();
    expect(readSecurityChallengeCooldown(throwingStore)).toBe(false);
    expect(() => clearSecurityChallengeCooldown(throwingStore)).not.toThrow();
  });
});
