import { ext } from '../platform/api';
import { normalizeBreaker, type Breaker } from '../core/circuitBreaker';

const KEY = 'breaker';

export async function loadBreaker(): Promise<Breaker> {
  const r = await ext.storage.local.get(KEY);
  return normalizeBreaker(r[KEY]);
}

export async function saveBreaker(b: Breaker): Promise<void> {
  await ext.storage.local.set({ [KEY]: b });
}