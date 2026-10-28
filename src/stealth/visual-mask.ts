/**
 * Visual Mask — Lớp bảo vệ bọc lót thị giác.
 * Che màn hình đen tức thời (< 50ms) nếu quảng cáo lọt qua để người dùng không thấy hình ảnh quảng cáo.
 * Việc tắt tiếng và tua video được điều phối bởi Actuator và planStep() để đảm bảo khôi phục chính xác trạng thái người dùng.
 */

const MASK_ID = '__adfilter_visual_mask';
let maskActive = false;

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
      pointerEvents: 'none',
    });
    const player = document.querySelector('#movie_player');
    if (player) {
      (player as HTMLElement).style.position = 'relative';
      player.appendChild(mask);
    }
  }
  mask.style.display = 'block';
}

export function removeMask(): void {
  if (!maskActive) return;
  maskActive = false;

  const mask = document.getElementById(MASK_ID);
  if (mask) mask.style.display = 'none';
}
