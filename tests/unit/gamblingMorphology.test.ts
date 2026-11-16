// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isGamblingMorphologyMatch,
  isCrossOriginUrl,
} from '../../src/stealth/gamblingMorphology';
import { scanAndHideHeuristicAds } from '../../src/cosmetic/heuristicAdDetector';
import { purgeFloatingAds } from '../../src/cosmetic/floatingBannerGuard';

describe('Site-Agnostic Gambling Morphology & Neutral Edge Bar Guard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('nhận diện chính xác các domain/ảnh nhà cái mới qua hình thái mà không cần hardcode từng tên', () => {
    expect(isGamblingMorphologyMatch('https://hdbet.com/km', '', '', '', 'animehay.tv')).toBe(true);
    expect(isGamblingMorphologyMatch('https://3bet.win/play', '', '', '', 'animehay.tv')).toBe(true);
    expect(isGamblingMorphologyMatch('https://sun88.club/', '', '', '', 'animehay.tv')).toBe(true);
    expect(isGamblingMorphologyMatch('https://brandmoi99.vip/', '', '', '', 'motchill.tv')).toBe(true);
    expect(isGamblingMorphologyMatch('/out/1', 'cdn/img1.png', 'Săn túi thần tài', '', 'animehay.tv')).toBe(false);
  });

  it('không gắn cờ nhầm các từ tiếng Anh thông dụng hoặc link nội bộ cùng domain', () => {
    expect(isGamblingMorphologyMatch('https://target.com/deal', '', '', '', 'site.vn')).toBe(false);
    expect(isGamblingMorphologyMatch('https://github.com/user/repo', '', '', '', 'site.vn')).toBe(false);
    expect(isGamblingMorphologyMatch('https://phim88.vn/xem-phim/tap-1', '', '', '', 'phim88.vn')).toBe(false);
    expect(isCrossOriginUrl('https://phim88.vn/a', 'phim88.vn')).toBe(false);
    expect(isCrossOriginUrl('https://other88.com/a', 'phim88.vn')).toBe(true);
  });

  it('ẩn thanh catfish bám đáy có class/id trung tính kiểu AnimeHay chứa HDBET/SUN88/3Bet và nút X góc phải', () => {
    const neutralEdgeBar = document.createElement('div');
    neutralEdgeBar.id = 'fx-bottom-strip';
    neutralEdgeBar.className = 'ck-panel-row';
    neutralEdgeBar.style.position = 'fixed';
    neutralEdgeBar.style.bottom = '0px';
    neutralEdgeBar.innerHTML = `
      <a href="/go/promo" target="_blank"><img src="/banners/promo-strip.gif" alt="Khuyến mãi" /></a>
      <button type="button" style="background:#dc2626;color:#fff">X</button>
    `;
    const img = neutralEdgeBar.querySelector('img') as HTMLImageElement;
    img.getBoundingClientRect = () => ({ width: 600, height: 64 } as DOMRect);

    document.body.appendChild(neutralEdgeBar);

    const hidden = purgeFloatingAds(document);
    expect(hidden).toBe(1);
    expect(neutralEdgeBar.style.display).toBe('none');
  });

  it('ẩn banner ngang in-page trỏ cross-origin mà giữ nguyên thẻ poster phim đứng hợp lệ', () => {
    const adStripWrap = document.createElement('div');
    adStripWrap.id = 'top-strip';
    const adLink = document.createElement('a');
    adLink.href = 'https://sponsor-unknown.example/promo';
    adLink.target = '_blank';
    const adImg = document.createElement('img');
    adImg.src = 'https://cdn.example/strip.png';
    adImg.getBoundingClientRect = () => ({ width: 728, height: 90 } as DOMRect);
    adLink.appendChild(adImg);
    adStripWrap.appendChild(adLink);

    const moviePosterCard = document.createElement('div');
    moviePosterCard.className = 'movie-item';
    const movieLink = document.createElement('a');
    movieLink.href = '/phim/seitokai';
    const posterImg = document.createElement('img');
    posterImg.src = '/posters/seitokai.jpg';
    posterImg.getBoundingClientRect = () => ({ width: 200, height: 300 } as DOMRect);
    movieLink.appendChild(posterImg);
    moviePosterCard.appendChild(movieLink);

    document.body.appendChild(adStripWrap);
    document.body.appendChild(moviePosterCard);

    const count = scanAndHideHeuristicAds(document);
    expect(count).toBe(1);
    expect(adStripWrap.style.display).toBe('none');
    expect(moviePosterCard.style.display).not.toBe('none');
  });
});
