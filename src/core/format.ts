export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const remain = s % 60;
  return `${m}:${remain.toString().padStart(2, '0')}`;
}