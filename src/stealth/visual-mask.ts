/**
 * Visual Mask — Lớp bảo vệ bọc lót thị giác.
 * Che màn hình đen tức thời (< 50ms) nếu quảng cáo lọt qua để người dùng không thấy hình ảnh quảng cáo.
 *
 * An toàn: mask tự động tháo sau MAX_MASK_MS nếu không còn class .ad-showing,
 * tránh trường hợp bị kẹt che màn hình khi Defuser đã bóc sạch QC từ trước.
 */

const MASK_ID = '__adfilter_visual_mask';
const MAX_MASK_MS = 3000; // Tối đa 3 giây — sau đó tự kiểm tra và tháo nếu không còn QC

let maskActive = false;
let _autoRemoveTimer: any = null;

function _clearAutoRemove(): void {
  if (_autoRemoveTimer !== null) {
    clearTimeout(_autoRemoveTimer);
    _autoRemoveTimer = null;
  }
}

function _scheduleAutoRemove(): void {
  _clearAutoRemove();
  _autoRemoveTimer = window.setTimeout(() => {
    // Chỉ tháo mask nếu không có quảng cáo thật đang chạy
    const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    const isRealAd =
      player &&
      (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
    if (!isRealAd) {
      removeMask();
    } else {
      // Quảng cáo vẫn còn — lên lịch kiểm tra lại sau 1 giây
      _scheduleAutoRemove();
    }
  }, MAX_MASK_MS);
}

export function applyMask(): void {
  if (maskActive) return;
  maskActive = true;

  let mask = document.getElementById(MASK_ID);
  if (!mask) {
    mask = document.createElement('div');
    mask.id = MASK_ID;
    Object.assign(mask.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: '#0f0f0f',
      zIndex: '9999',
      pointerEvents: 'none', // KHÔNG block click — chỉ che hình ảnh QC
    });
    const player = document.querySelector('#movie_player');
    if (player) {
      (player as HTMLElement).style.position = 'relative';
      player.appendChild(mask);
    }
  }
  mask.style.display = 'block';

  // Khởi động bộ đếm an toàn tự động tháo mask sau MAX_MASK_MS
  _scheduleAutoRemove();
}

export function removeMask(): void {
  _clearAutoRemove();
  if (!maskActive) return;
  maskActive = false;

  const mask = document.getElementById(MASK_ID);
  if (mask) mask.style.display = 'none';
}
