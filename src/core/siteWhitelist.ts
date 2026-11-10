/**
 * Quản lý danh sách ngoại lệ (Whitelist) theo từng tên miền (Per-Site Whitelist)
 */
export function isDomainWhitelisted(domain: string, whitelist: string[] = []): boolean {
  if (!domain || !Array.isArray(whitelist)) return false;
  const target = domain.toLowerCase().trim();
  return whitelist.some((item) => {
    const w = item.toLowerCase().trim();
    return target === w || target.endsWith(`.${w}`);
  });
}

/**
 * Thêm hoặc bớt một tên miền khỏi danh sách ngoại lệ
 */
export function toggleDomainWhitelist(domain: string, whitelist: string[] = []): string[] {
  if (!domain) return [...whitelist];
  const target = domain.toLowerCase().trim();
  const list = [...whitelist];
  const index = list.findIndex((item) => item.toLowerCase().trim() === target);

  if (index >= 0) {
    list.splice(index, 1);
  } else {
    list.push(target);
  }

  return list;
}
