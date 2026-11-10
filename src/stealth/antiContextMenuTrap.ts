/**
 * Vô hiệu hóa các cơ chế bẫy chống chuột phải, chống copy, chống bôi đen văn bản
 * trên các website đọc truyện.
 */
export function unlockContextMenu(win: Window = window): () => void {
  const events = ['contextmenu', 'copy', 'cut', 'paste', 'selectstart', 'dragstart'];

  const handler = (e: Event) => {
    // Ngăn chặn các script của website đọc truyện chặn hành động chuột phải / copy của người dùng
    e.stopPropagation();
  };

  events.forEach((eventName) => {
    win.addEventListener(eventName, handler, { capture: true });
  });

  // Khôi phục user-select cho phép bôi đen chữ trên document
  if (win.document && win.document.documentElement) {
    win.document.documentElement.style.setProperty('user-select', 'auto', 'important');
    win.document.documentElement.style.setProperty('-webkit-user-select', 'auto', 'important');
  }
  if (win.document && win.document.body) {
    win.document.body.style.setProperty('user-select', 'auto', 'important');
    win.document.body.style.setProperty('-webkit-user-select', 'auto', 'important');
  }

  return () => {
    events.forEach((eventName) => {
      win.removeEventListener(eventName, handler, { capture: true });
    });
  };
}
