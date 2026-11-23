# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.8] - 2026-11-24

### Fixed
- **Sửa lỗi chuyển video YouTube tốn 8–10 giây (phạt SABR) & lỗi không lên video trên `v3.1.7`:**
  - Khôi phục mặc định chuẩn `v3.1.3` (`defaultConfig.youtubeAdMode = 'fast-skip'` trong `src/storage/config.ts`) và tự động chuyển cấu hình `'auto'` cũ của `v3.1.7` về `'fast-skip'` để toàn bộ video chuyển tiếp mở nhanh `< 1 giây` (tránh phạt SABR `4–10s` từ `googlevideo.com` khi chạy `strict-defuser`).
  - Gỡ bỏ hoàn toàn hàm `inspectSabrBackoff()` đệ quy 6 tầng khỏi `src/stealth/interceptor.ts`; giữ lại toàn bộ bảo vệ `try/catch` và loại trừ `Node`/`Window` trong `purge()`, `patchedResponseJson()` và `src/stealth/defuser.ts` để tuyệt đối không làm sập script khởi tạo trình phát video.
  - Tinh gọn `src/options/options.html` & `src/options/options.ts` về 2 lựa chọn rõ ràng (`Tải nhanh (<1s) — Mặc định` và `Chặn tuyệt đối tại nguồn`), giữ Popup gọn sạch không có thẻ A/B.
- **Sửa lỗi video YouTube tự bị Pause ngầm (Mix/Playlist hoặc sau khi gỡ hộp thoại Enforcement):**
  - `src/stealth/defuser.ts`: bổ sung `resumeAfterPopup()` gọi `playViaPlayer()` (ngay lập tức + kiểm tra lại sau `250ms`) ngay khi `removeInterruptionPopups()` gỡ `ytd-enforcement-message-view-model`.
  - `src/stealth/defuser.ts`: nâng cấp listener `pause` trong `attachPlaybackGuard()` bổ sung 2 nhịp kiểm tra phục hồi an toàn ở `250ms` và `700ms` (hủy ngay nếu người dùng tự bấm Space/Click pause trong `1200ms`) khi YouTube tự pause lúc `readyState < 2` hoặc đang buffering (`playerState === 3`).

## [3.1.7] - 2026-11-23

### Changed
- **Hợp nhất cơ chế xử lý quảng cáo YouTube thành 1 chế độ `Tự động thông minh (auto)` làm mặc định:**
  - Cập nhật `defaultConfig.youtubeAdMode = 'auto'` trong `src/storage/config.ts`: mặc định chạy **Chặn tuyệt đối tại nguồn (`strict-defuser`)** để xóa trắng 100% `adPlacements`/`playerAds`/`adSlots` tại nguồn JSON (vào thẳng video gốc không nháy quảng cáo).
  - Bổ sung cơ chế tự động phát hiện SABR backoff (`inspectSabrBackoff` trong `src/stealth/interceptor.ts`): nếu YouTube trả tín hiệu phạt `backoffTimeMs >= 3000` trong phiên, tự động lùi tạm sang `fast-skip` cho phiên đó để không bị xoay vòng chờ 4–8 giây.
  - Làm gọn Popup (`src/popup/popup.html`, `src/popup/popup.ts`): bỏ thẻ chuyển Chế độ A/B khỏi Popup, chuyển tùy chọn ép thủ công (`Tự động thông minh` / `Luôn chặn tuyệt đối` / `Luôn tải nhanh`) vào trang `⚙️ Cài đặt Bộ lọc` (`src/options/options.html`, `src/options/options.ts`).

## [3.1.6] - 2026-11-23

### Changed
- **Khôi phục luồng xử lý quảng cáo YouTube nhanh và ổn định của `v3.1.3` (`b3a1bde`):**
  - Đưa `src/content/index.ts` (`instantIntervene`, `planStep`, `execute`, `verifyLater`, `clickSkip`), `src/content/playerObserver.ts`, `src/stealth/cosmetic.css`, `src/content/selectors.ts` và `src/stealth/interceptor.ts` về đúng luồng xử lý tức thì đã chứng minh độ ổn định cao trên `v3.1.3` (tốc độ dập quảng cáo `~0.2–0.3s`), kết hợp giữ lại toàn bộ cải tiến của `v3.1.4` – `v3.1.5` (logo thương hiệu Adfilter, chuẩn hóa Chrome Web Store, sửa chặn nhầm ChatGPT/OAuth, nhận diện trạng thái YouTube trên Popup).

### Fixed
- **Sửa lỗi vào Livestream YouTube bị đứng/lag 15–20 giây (`tryLiveHead`):**
  - Cập nhật `tryLiveHead()` trong `src/stealth/defuser.ts`: thêm chốt `if (video.currentTime > 1.5) { _liveHeadDone = true; return; }` để chỉ tua về live head khi đầu phát thực sự kẹt ở đầu DVR (`0..1.5s`), tránh xóa bộ đệm 4–6s của YouTube khi mới vào live.
  - Nâng ngưỡng `edge > 10` cho nhánh `seekToStreamTime` / fallback và lùi an toàn về `edge - 3` (thay vì `edge - 0.5`).
- **Giữ nguyên bản vá `watchPlayback()` chống ngắt mạch oan trên `v3.1.3`:**
  - Chỉ kiểm tra `isStuck` khi `v.readyState >= 3` và `!second.adShowing`, tự gọi `resumePlay()`, và dùng `recordFailure()` (ngưỡng 3 lần) thay vì `trip()` khóa 30 phút ngay lần đầu.

## [3.1.5] - 2026-11-22

### Added
- **Tích hợp bộ logo & icon thương hiệu chính thức (`16x16`, `32x32`, `48x48`, `128x128`, `300x300`):**
  - Tạo bộ icon chuẩn Chrome Web Store trong `src/icons/` (`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`) và `docs/assets/logo-300.png` cho trang giới thiệu & Store listing.
  - Khai báo đầy đủ `"icons"` và `"action.default_icon"` trong `src/manifest.json`, đồng thời cập nhật `scripts/build.ts` sao chép `src/icons` vào thư mục đóng gói đầu ra.
  - Hiển thị logo thương hiệu trực tiếp trên tiêu đề Popup (`src/popup/popup.html`), Options (`src/options/options.html`) và `README.md`.

### Changed
- **Chuẩn hóa tuân thủ chính sách Chrome Web Store (Nhóm 1 & Nhóm 2):**
  - Cập nhật `"description"` trong `src/manifest.json` và `package.json` theo hướng trung tính, loại bỏ tên thương hiệu bên thứ ba (`Brave`, `YouTube` / `Stealth`) khỏi metadata và nhãn giao diện (`Popup` / `Options`).
  - Tinh gọn `"host_permissions"` trong `src/manifest.json` thành `["<all_urls>"]` (loại bỏ khai báo dư thừa trùng với `<all_urls>`).
  - Gỡ bỏ checkbox telemetry chưa nối mạch (`#telemetry`) khỏi `src/options/options.html` và `src/options/options.ts` để thống nhất hoàn toàn với cam kết không thu thập dữ liệu người dùng.
  - Cấu hình `sourcemap: dev` trong `scripts/build.ts` để bản phát hành chính thức (`dist/` & `release/*.zip`) không chứa file `.js.map` mang đường dẫn nội bộ máy phát triển.

### Fixed
- **Sửa lỗi báo nhầm kẹt video (`[AdFilter] video có vẻ bị kẹt sau can thiệp`) và ngắt mạch sớm khi video YouTube đang nạp đệm SABR (`DcCISK3sCYg`):**
  - Cập nhật `watchPlayback()` trong `src/content/index.ts` đo thời gian phát thực tế qua `extractSignals(document, Date.now())` thay vì đọc `lastSignals` cũ, bỏ qua khi `v.readyState < 3` (đang tải đệm SABR) hoặc đang ở lượt quảng cáo (`adShowing`), tự động gọi `resumePlay()`, và dùng `recordFailure()` (ngưỡng 3 lần) thay vì `trip()` khóa cứng 30 phút ngay lần đầu.
  - Cập nhật `isStuck()` trong `src/core/playbackGuard.ts` trả về `false` khi `next.adShowing` đang bật.
  - Định tuyến `log.warn` / `log.error` qua `console.info` gắn nhãn `[WARN]` / `[ERROR]` trong `src/core/log.ts` và dùng chung trong `src/background/index.ts` để trang `chrome://extensions` không gắn cờ **"Lỗi"** cho log vận hành thông thường.
- **Sửa lỗi nút Skip bị vô hiệu hóa & quảng cáo phát ngầm có tiếng sau màn hình đen trên YouTube (`apqe_u3VJQ4`):**
  - `src/stealth/cosmetic.css`: đổi `.ytp-ad-module` và `.ytp-ad-player-overlay-layout` từ `display: none !important` sang `opacity: 0 !important; visibility: hidden !important; pointer-events: none !important` để vẫn ẩn hoàn toàn với mắt người dùng nhưng giữ kích thước layout cho nút Skip, đồng thời bọc toàn bộ rule ẩn video `.ad-showing` dưới `html:not(.adfilter-inactive)`.
  - `src/content/selectors.ts` & `tests/unit/selectors.test.ts`: bổ sung `isSkipElementRendered()` kiểm tra cây cha không `display: none` và bổ sung 2 unit test cho cấu trúc `.ytp-ad-module > .ytp-ad-player-overlay-layout`.
  - `src/content/index.ts`: thêm `syncMaskActiveState()` đảm bảo chỉ bật `VisualMask` khi extension thực sự đang hoạt động (`enabled && !dryRun && canAct`), ép giữ liên tục `v.muted = true` và `v.playbackRate = cfg.maxSpeed` trong `planStep()`, reset `done` khi chuyển quảng cáo trong cùng cụm và thử bấm lại `CLICK_SKIP` ngay khi nút sẵn sàng.
- **Sửa lỗi treo tua quảng cáo ngầm 8–15s trên YouTube SABR & cải thiện nhận diện trạng thái YouTube trên Popup:**
  - `src/content/playerObserver.ts` & `src/content/index.ts`: thêm `wasAdShowing` chỉ kích hoạt `onInstant` ở sườn lên `.ad-showing` và thêm `trySeekAdOnce()` chỉ thử tua `SEEK_TO_END` tối đa 3 lần khi `readyState >= 2` (loại bỏ vòng lặp gán `v.currentTime` mỗi 250ms làm xóa buffer MSE), giữ riêng `Chế độ A (fast-skip)` cho phép lướt QC đầu phiên ~0.3–1s để các video sau mở `<1s` không bị phạt 6–7s SABR, còn `Chế độ B (strict-defuser)` xóa trắng `adPlacements`/`adSlots` tại nguồn JSON.
  - `src/content/index.ts`, `src/popup/popup.ts` & `src/core/statusText.ts`: cho phép Popup truy vấn trực tiếp `GET_STATUS` từ tab YouTube đang mở và hiển thị trạng thái đúng theo tên miền (`www.youtube.com` vs các trang web khác).
  - `src/stealth/interceptor.ts`, `src/stealth/defuser.ts` & `src/content/index.ts`: tăng độ sâu duyệt `purge()` lên `depth < 6` (tối đa `8` trên các key chứa response), bổ sung lọc `PatchedXHR` khi `responseType === 'json'`, bẫy thêm `ytplayer.bootstrapPlayerResponse` & toàn bộ cây `ytInitialData`, và sửa `trySeekAdOnce()` chỉ khóa `lastSoughtDuration` sau khi `v.readyState >= 2` (tối đa 3 lần thử) kèm tự động `resumePlay()` & điều chỉnh tốc độ tua (`4x` khi `readyState < 3`) để quảng cáo không bị treo buffer phía sau màn hình che đen.

## [3.1.4] - 2026-11-22

### Fixed
- **Sửa lỗi chặn nhầm website hợp lệ (`ChatGPT`, đăng nhập `OAuth/SSO` chứa `redirect_uri`, `Shopee`/`Lazada` và các URL có chứa số `88` / `win11` / `/chap68`):**
  - Siết chặt `src/stealth/urlBlockRegistry.ts`: loại bỏ các mẫu regex quá rộng (`/88/i`, `/redirect/i`, `/traffic/i`, `/win\d+/i`, `/big\d+/i`, `/red\d+/i`, `/b52/i`, `/chinhhang/i`, `/shopee\.vn/i`, `/lazada\.vn/i`) vốn chặn nhầm trang hợp lệ; chỉ đối chiếu tên brand nhà cái/mạng popunder trên **`hostname` thật** đã parse qua `new URL()` (vẫn chặn `/universal-link` trên Shopee, `bit.ly/adudr`, `.click/tsk/`, `/sklnk/` và `utm_medium=popunder`).
  - Sửa `src/stealth/gamblingMorphology.ts`: chỉ kiểm tra hình thái domain nhà cái (`*bet`, `*88`, `*win`, `*club`, `*vip`) trên **`hostname`**, không quét lên `/path` hay `?query` của URL bài viết.
  - Sửa `src/stealth/antiRedirect.ts`: cho phép chuyển hướng cross-origin hợp lệ (`chatgpt.com` → `auth.openai.com` → `accounts.google.com`, SSO/thanh toán), chỉ chặn điều hướng tới `isSuspiciousUrl()` hoặc redirect phát sinh khi người dùng đang bấm vào trình phát video.
  - Miễn trừ tự động các nền tảng ứng dụng & đăng nhập sạch (`chatgpt.com`, `openai.com`, `claude.ai`, `accounts.google.com`, `login.microsoftonline.com`, `login.live.com`, `appleid.apple.com`, `github.com`, `auth0.com`, `okta.com`) trong `exclude_matches` của `src/manifest.json` và `src/core/securityChallenge.ts`.
  - Cập nhật `src/background/popunderTabGuard.ts` tôn trọng `whitelist_domains` khi kiểm tra đóng tab popunder.

## [3.1.3] - 2026-11-20

### Fixed
- **Sửa triệt để lỗi lặp xác thực bảo mật trên mọi website (Cloudflare Turnstile / Managed Challenge *"Performing security verification"*, hCaptcha, reCAPTCHA, AWS WAF, DDoS-Guard, DataDome, Arkose, Imperva, PerimeterX, GeeTest):**
  - Bổ sung `exclude_matches` trong `src/manifest.json` cho `universalDefuser.js` & `universalContent.js` để không tiêm script vào iframe/endpoint xác thực chống bot.
  - Tạo module [src/core/securityChallenge.ts](src/core/securityChallenge.ts) nhận diện an toàn ngữ cảnh & trang chờ xác thực (xác thực hostname/URL qua `new URL()` chuẩn CodeQL, phát hiện `_cf_chl_opt`, `/cdn-cgi/challenge-platform`, `#challenge-running`...) kèm cooldown `sessionStorage` 30 giây khi trình duyệt tự tải lại sau kiểm tra.
  - Bổ sung cơ chế khôi phục sạch toàn bộ hook nguyên bản theo thứ tự LIFO (`shadowShield`, `domShield`, `antiAdblockDefuser`, `unlockContextMenu`, `vastInterceptor`, `antiPopup`, `antiRedirect`) khi phát hiện trang chờ xác thực hoặc khi bấm nút `Tạm dừng`.
  - Bảo vệ Closed Shadow DOM của widget xác thực (Turnstile/captcha) trong `shadowShield.ts`, `domShield.ts`, `heuristicAdDetector.ts` và `clickHijackGuard.ts`.
  - Cho phép chuyển hướng cùng tên miền (`same-origin`) sau xác thực trong `antiRedirect.ts` (vẫn giữ chặn `cross-origin` ngầm và URL độc hại).
  - Đồng bộ nút **`Tạm dừng`** (Per-Site Whitelist) xuống `MAIN` world (`universalDefuser.ts`) ngay ở `0ms` và gỡ `clickHijackGuard` trong `cleanup()` của `universalEngine.ts`.

## [3.1.2] - 2026-11-19

### Added
- **YouTube — 2 chế độ xử lý quảng cáo (`Chế độ A: Tải nhanh <1s` mặc định & `Chế độ B: Chặn tuyệt đối`) kèm nút chuyển sống trong Popup/Options (PR #81):** Chế độ A tự động che đen (`VisualMask`) + tắt tiếng + tua hết quảng cáo đầu phiên (~0.3–1s) và chỉ cho phép ping 1st-party `youtube.com/api/stats/ads` (xác thực chặt qua `new URL()`), giúp các video kế tiếp trong phiên tải trong `<1s` mà không bị server phạt `SABR NextRequestPolicy.backoffTimeMs` (4–8s) và vẫn giữ chất lượng gốc cao nhất (4K).

### Fixed
- **YouTube — Khử trễ tải & lỗi trình phát xem trước (PR #78, #79, #80):**
  - Cô lập `attachPlaybackGuard`, `tryLiveHead`, `tryStartupAutoplay` và `videoWatcher` chỉ theo dõi `#movie_player`, chấm dứt lỗi hồi sinh `#video-preview` khi hover rồi bấm chuyển video (PR #80).
  - Không đệm toàn bộ stream `/youtubei/v1/get_watch` trong `fetch()` và cách ly frame `about:blank` trên YouTube để giảm ~0.8–1s độ trễ `loadstart` (PR #79).
  - Loại bỏ các lần gọi `seekToLiveHead()` nhầm trên video thường (VOD) gây khựng luồng phát và thêm fast-path cho `JSON.parse` / `interceptor` (PR #78).
- **Web truyện & Web phim — Tăng cường chặn Popunder và Native Ad Widgets (PR #75, #76, #77):**
  - Chặn quảng cáo native trong sandboxed `about:blank` iframes, widget `__clb-spot` và lưới 4 thẻ quảng cáo tự nhiên (PR #77).
  - Chặn bẫy popunder qua `dispatchEvent`, thẻ `<a>` bẫy động, `frames.open` và các mạng popunder toàn cầu (PR #76).
  - Bảo toàn danh sách chương truyện (`chapter list`) không bị nhận diện nhầm bởi bộ lọc hình thái học và xử lý an toàn URL tương đối (PR #75).

## [3.1.1] - 2026-11-17

### Fixed
- **YouTube — Video đầu tiên tải chậm 5–6 giây:** Chặn tại chỗ request remarketing (`/pagead/1p-user-list/`, `/ads/user-lists/`, `backend=innertube`) gây lỗi `302` → `CORS error`; lọc thêm `/youtubei/v1/get_watch` và `Response.json()`; bẫy `ytcfg` / `ytplayer.config` ngay từ `0ms`; không ép phát khi trình phát đang nạp dữ liệu; bỏ qua click trên video xem trước ở trang chủ.
- **Web phim — Tab quảng cáo bật lên rồi bị chặn (`ERR_BLOCKED_BY_CLIENT`):** Tự động đóng ngay tab popunder và trả về tab phim; chặn mở tab trống `about:blank` khi bấm Play.

### Added
- **Nhận diện banner cờ bạc trên mọi web phim:** Nhận diện tên miền/ảnh nhà cái mới (`*88`, `*bet`, `*win`, `hdbet`, `3bet`, `sun88`...) và thanh banner dính mép màn hình mà không cần biết trước tên web.
- **Zero-Flash:** Ẩn banner/popup ngay trước khi chúng kịp hiện lên màn hình (không còn nháy hình).
- **README:** Hướng dẫn cài đặt từng bước cho người không biết lập trình.

## [3.1.0] - 2026-11-16

### Added
- **Universal Movie & Streaming Shield (Week 30):**
  - **Iframe Player Protection (`all_frames: true`):** Nạp `universalDefuser.js` và `universalContent.js` vào mọi `<iframe>` trình phát video nhúng (vẫn cách ly tuyệt đối `youtube.com` / `youtube-nocookie.com`).
  - **Intent-Aware Anti-Popunder & Transparent Player Shield:** Chặn triệt để `window.open`, `<a target="_blank">.click()`, `location.assign`/`replace` khi bấm Play hoặc bấm card phim dẫn tới domain cross-origin lạ; gỡ bỏ lớp phủ click-catcher trong suốt đè lên trình phát video.
  - **Zero-Delay Pause-Ad & Blurred Backdrop Guard:** Tự động nhận diện và ẩn trực tiếp overlay quảng cáo khi Pause (nút `"Đóng quảng cáo"`, `"Đóng và xem tiếp"`, nhãn `"Quảng cáo"`), bắt sự kiện `pause` + thay đổi attribute DOM tức thì, đồng thời triệt tiêu popup làm mờ background có nút `X` (bảo toàn modal đăng nhập hợp lệ).
  - **Expanded Gambling/Betting Banner Shield:** Phủ thêm các brand/banner `vsbet`, `bom88`, `yo88`, `zo88`, `hitclub`, `hit.club`, `8xbet`, `shbet`, `jun88`, `789bet`, `new88`, `fb88`, `w88`, `fun88` qua cả `a[href*]` lẫn `img[src*]`/`img[alt*]` và bổ sung E2E test web phim toàn diện (`tests/e2e/movieStreaming.spec.ts`).

## [3.0.0] - 2026-11-16

### Added
- **Brave-Style Universal AdBlock Architecture (Weeks 26–29):**
  - **ABP/uBO Filter Compiler & Multi-Ruleset DNR (Week 26):** Biên dịch tự động các bộ lọc `filters/global-ads.txt` & `filters/vietnam-ads.txt` sang 4 static DNR rulesets (`ruleset_adnetworks`, `ruleset_global`, `ruleset_vietnam`, `ruleset_redirects`) cùng tài nguyên giả rỗng `/resources/noop.*` (`1x1.gif`, `noop.js`, `noop.css`, `noop.html`) chống bẫy `onerror` anti-adblock.
  - **Universal Scriptlet Engine & `attachShadow` Shield (Week 27):** Bộ thực thi `+js(...)` trong `MAIN` world (`set-constant`, `abort-on-property-read`, `abort-current-inline-script`, `addEventListener-defuser`, `nowoif`), chặn `_blank` anchor popunder trên mobile, và hook `Element.prototype.attachShadow` bắt triệt để Closed Shadow DOM quảng cáo (`.w-overlay`, `[data-zone]`, class hash ngẫu nhiên).
  - **Domain-Scoped Cosmetic, Procedural (`:has-text`, `:upward`, `:matches-css`) & Site-Agnostic Heuristics (Week 28):** Nạp chỉ mục `cosmetic_index.json` Zero-FOUC với ngoại lệ `#@#`, xử lý native sponsored cards, extreme overlay và tối ưu `MutationObserver`.
  - **Dynamic Filter Updater, Custom Rules & Remote Lists UI (Week 29):** Hỗ trợ bật/tắt ruleset, nhập custom rules chuẩn ABP/uBO và danh sách lọc HTTPS từ xa trong trang Options/Popup, đồng bộ qua `declarativeNetRequest.updateDynamicRules()` và tự động cập nhật định kỳ trong Service Worker.
  - **Strict YouTube Lane Isolation:** Tự động loại trừ `youtube.com` / `youtu.be` / `googlevideo.com` / `ytimg.com` khỏi mọi rule mạng, scriptlet, cosmetic và dynamic rules để bảo toàn luồng phát & stealth YouTube.

## [2.1.0] - 2026-11-12

### Added
- **Vietnamese Manga & Streaming Ad Shield (Week 25):**
  - **Chặn mạng máy chủ quảng cáo Việt Nam (DNR Rules):** Chặn đứng các domain phân phối quảng cáo, popup và popunder đặc thù (`mplmncb.com`, `clickadu.com`, `big88.services`, `sunwinchinhhang.com`, `gemwinchinhhang.com`, `rikvipchinhhang.com`, `win79chinhhang.com`, `debet.com`) ngay tại tầng mạng trình duyệt.
  - **Nâng cấp Anti-Popunder & Click Redirect Guard:** Bẫy `window.open()` và chặn đứng mọi chuyển hướng ngầm tới trang cá cược (`utm_source=clickadu`, `utm_medium=popunder`) ngay cả sau khi người dùng tương tác chuột trên thẻ `<a>`.
  - **Triệt tiêu Banner hai bên sườn & Chân trang (Catfish / Flank Banners):** Tự động phát hiện và ẩn sạch banner dính hai bên mép màn hình (`floatLeft`, `floatRight`, `floating-left`, `floating-right`), banner đỉnh trang (`top-banner-*`), banner chân trang (`catfish-banner-*`) và popup modal cờ bạc (DEBET, SUNWIN).
  - **Kiểm thử tự động E2E:** Bổ sung kịch bản mô phỏng toàn diện cấu trúc web truyện Việt Nam (`tests/e2e/mangaVietnam.spec.ts`).

## [2.0.0] - 2026-11-11

### Added
- **AdFilter Universal Edition — Chặn quảng cáo toàn diện Web Đọc Truyện & Web Phim:**
  - **Mạng lưới DeclarativeNetRequest (DNR):** Hơn 200 quy tắc chặn domain mạng quảng cáo rác, pop-up, cờ bạc, 18+ (Adsterra, PropellerAds, PopAds, ExoClick, MGID...).
  - **Anti-Popup & Anti-Redirect Engine:** Bẫy `window.open`, `location.assign`, `location.replace` trong `MAIN` world, triệt tiêu 100% tình trạng click bị nhảy tab hoặc chuyển hướng trang ngoài ý muốn.
  - **Click Hijacking Guard:** Quét dọn các lớp phủ tàng hình (`opacity: 0`, `z-index: 999999`) bẫy click chuột của người dùng.
  - **Bộ lọc mỹ phẩm Heuristic & Sập khoảng trắng:** Nhận diện banner theo kích thước chuẩn IAB, xóa sạch banner cố định (Floating/Sticky ads) và tự động co rút khoảng trắng thừa về 0px (Zero-Height Collapsing).
  - **Bẻ khóa Anti-Adblock & Tối ưu đọc truyện:** Vô hiệu hóa thư viện FuckAdBlock/BlockAdBlock qua fake `canRunAds` & kích thước mồi; gỡ bỏ modal làm mờ trang; mở khóa chuột phải, sao chép văn bản và bảo vệ cơ chế nạp ảnh lười (`data-src`).
  - **Chặn quảng cáo video Web Phim (VAST/VPAID):** Bẫy các yêu cầu XML VAST/VPAID trả về response rỗng để bỏ qua toàn bộ quảng cáo đệm (preroll ads) trên các player (JWPlayer, Video.js...), đồng thời tự động đóng các overlay quảng cáo giữa phim.
  - **Bật/Tắt theo từng website (Per-Site Whitelist):** Giao diện Popup cho phép người dùng tạm dừng bảo vệ trên các website cá nhân, ngân hàng hoặc trang tin tưởng.
  - **Công cụ chọn phần tử trực quan (Element Zapper):** Cho phép người dùng click trực tiếp vào bất kỳ phần tử nào trên trang web để xóa vĩnh viễn và lưu vào danh sách chặn cá nhân.
  - **Đóng gói phát hành tự động:** Tự động build và đóng gói phân phối định dạng `.zip` sẵn sàng tải lên Chrome Web Store và Firefox Add-ons (`pnpm package`).

## [1.0.0] - 2026-11-06

### Added
- **Hỗ trợ đa trình duyệt & Mobile (Phase 7):**
  - Bộ chuyển đổi thuần `transformManifest` đóng gói đồng thời cho **Chromium (`dist/chromium/`)** và **Firefox Desktop (`dist/firefox/`)**.
  - Mở rộng hỗ trợ giao diện di động `m.youtube.com`, bộ giải phóng khóa cuộn trang (`scrollLock.ts`) và cơ chế bảo vệ luồng phát (`autoplayGuard.ts`, `pauseGuard.ts`, Auto-Resume Guard trong `MAIN` world).
- **Telemetry Tùy chọn & Backend Quan sát (Phase 8):**
  - Hàng đợi sự kiện `ring buffer` và lọc danh sách trắng nghiêm ngặt (`src/core/telemetry.ts`), mặc định tắt (`Opt-in`).
  - Máy chủ **Fastify API + PostgreSQL** (`server/`) xác thực đầu vào bằng Zod `.strict()`, xuất metrics chuẩn **Prometheus** (`/metrics`) và bể chứa webhook cảnh báo (`/alert-hook`).
  - Hệ thống dò cấu trúc chủ động **Canary Detector** (`canary/evaluate.ts`, `canary/check.ts`, `POST /canary`) phát hiện sớm khi YouTube thay đổi DOM.
  - Cấu hình tự động hóa **Grafana Dashboard & Alerting Rules** kèm 2 kịch bản diễn tập Chaos Engineering (`drill-broken-dom.ts`, `drill-circuit-breaker.ts`) đạt MTTD ~40–45s.
- **Hạ tầng Đám mây AWS bằng Terraform & Triển khai Tự động OIDC (Phase 9):**
  - Mã nguồn hạ tầng **Terraform (`infra/`)**: S3 Remote State có mã hóa AES-256 và Versioning, VPC & Security Group **Zero-Inbound (không mở cổng SSH)**, máy chủ EC2 quản trị 100% qua AWS SSM, kho ảnh ECR bất biến (`IMMUTABLE`), ngân sách cảnh báo tự động $10/tháng và CI TFLint.
  - Xác thực **GitHub Actions OIDC** (`infra/oidc.tf`) với 2 vai trò tách biệt (`adfilter-gha-plan` chỉ đọc trên PR và `adfilter-gha-deploy` cho môi trường `production`).
  - Đường ống **Continuous Deployment (`.github/workflows/deploy.yml`, `deploy/deploy.sh`)** theo mô hình thư mục phát hành cô lập (`/opt/adfilter/releases/<SHA>` + symlink `current`), tự động quay lui nguyên tử cả ảnh Docker lẫn cấu hình khi kiểm tra sức khỏe `/health` thất bại, cùng khả năng quay lui thủ công trong 1 phút.
- **Tài liệu Kỹ thuật & Nghiệm thu Toàn diện:**
  - Hoàn thiện [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), 7 bản ghi quyết định thiết kế ([`docs/decisions/0001..0007`](docs/decisions/)), sổ tay sự cố tổng hợp ([`docs/RUNBOOK.md`](docs/RUNBOOK.md)), kịch bản Demo ([`docs/DEMO.md`](docs/DEMO.md)), nghiên cứu tình huống ([`docs/CASE-STUDY.md`](docs/CASE-STUDY.md)), bảng chứng cứ nghiệm thu ([`docs/DONE.md`](docs/DONE.md)) và cẩm nang phỏng vấn ([`docs/notes/interview-prep.md`](docs/notes/interview-prep.md)).

## [0.2.0] - 2026-10-29

### Added
- **Stealth Architecture 3 lớp phòng thủ chuyên sâu (Defense-in-Depth):**
  - **Lớp 1 (Defuser & Interceptor):** Chạy ở `MAIN` world tại `document_start`, thanh lọc triệt để các trường dữ liệu quảng cáo (`adPlacements`, `playerAds`, `adSlots`, `adBreaks`) trong `ytInitialPlayerResponse`, `ytInitialData`, `ytplayer.config` và các request API qua `fetch`/`XMLHttpRequest`.
  - **Lớp 2 (Visual Mask & Cosmetic CSS):** Phủ lớp đen tức thời (< 50ms) và ẩn hoàn toàn phần tử video quảng cáo, banner masthead, promoted video, sponsored Shorts qua CSS `visibility: hidden` và `opacity: 0`.
  - **Lớp 3 (Fast Seek & Actuator Fallback):** Cơ chế One-Shot Seek tua video về cuối trong ~0.05s, kích hoạt sự kiện `ended` và chuyển tiếp luồng phát tự nhiên.
- **Hardening & Chống gỡ bẫy:**
  - Bọc bảo vệ `Object.defineProperty` ngăn YouTube ghi đè hoặc loại bỏ getter/setter hook.
  - Ngụy trang hàm Native (`disguise`) cho `fetch` và `JSON.parse` bảo vệ tính toàn vẹn khi trang web kiểm tra `toString()`.
- **Hỗ trợ toàn diện YouTube Shorts & Mid-roll:**
  - Lọc bỏ `reelWatchEndpoint.ad` trong các feed phản hồi Shorts.
  - Triệt tiêu `adBreaks` loại bỏ gián đoạn giữa chừng video.
- **Runtime Selector Watchdog:**
  - Giám sát định kỳ các selector trọng yếu và kiểm tra rò rỉ dữ liệu quảng cáo.
  - Tự động kích hoạt cơ chế Fallback khi phát hiện thay đổi cấu trúc từ phía YouTube.
- **Tự động giải phóng cảnh báo:**
  - Tự động phát hiện và xóa sạch hộp thoại cảnh báo chặn ad-block (`enforcement dialog`) và thông báo gián đoạn (`interruption popups`).

## [0.1.0] - 2026-10-28

### Added
- Phát hiện quảng cáo bằng State Machine có cơ chế debounce tín hiệu (Precision 100%, Recall 100%).
- Can thiệp an toàn với chế độ chạy thử (dry-run), xác minh hiệu lực và khôi phục âm lượng, tốc độ phát ban đầu.
- Bộ ngắt mạch an toàn (Circuit Breaker) tự động dừng can thiệp khi phát hiện trang bật cơ chế chống ad-block.
- Phím tắt khẩn cấp `Alt+Shift+K` để tắt/bật nhanh extension.
- Giao diện Popup đầy đủ: theo dõi trạng thái tab theo thời gian thực, công tắc tính năng, xuất nhật ký hành động JSON.
- Trang cài đặt mở rộng (Options Page) cấu hình chế độ can thiệp và ngưỡng phát hiện.
- Hệ thống kiểm thử toàn diện: 22 bộ Unit Tests (190 tests) và kiểm thử đầu cuối E2E với Playwright trên Chromium.
- Quy trình CI tự động hóa: kiểm tra kiểu TypeScript, unit test, đánh giá chất lượng (eval Quality Gate), quét lỗ hổng bảo mật (CodeQL, pnpm audit), phát hành tự động qua GitHub Release khi gắn tag.
