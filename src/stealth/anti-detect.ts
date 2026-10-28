/**
 * Anti-Detection — Che giấu các dấu vết can thiệp API.
 * Đảm bảo các hàm bẫy (fetch, JSON.parse, XHR) khi bị YouTube kiểm tra
 * bằng .toString(), .name, .length đều trông giống hệt hàm gốc của trình duyệt.
 */

export function disguise<T extends (...args: any[]) => any>(
  wrapped: T,
  original: T,
): T {
  try {
    Object.defineProperty(wrapped, 'toString', {
      value: () => original.toString(),
      configurable: true,
      writable: true,
    });
  } catch {}

  try {
    Object.defineProperty(wrapped, 'name', {
      value: original.name,
      configurable: true,
    });
  } catch {}

  try {
    Object.defineProperty(wrapped, 'length', {
      value: original.length,
      configurable: true,
    });
  } catch {}

  return wrapped;
}