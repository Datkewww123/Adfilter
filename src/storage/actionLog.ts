import { ext } from '../platform/api';
import { pushRing } from '../core/ring';

export interface ActionRecord {
  at: number;
  action: string;
  dryRun: boolean;
  ok?: boolean;
  verified?: boolean;
  latencyMs?: number;
  error?: string;
}

const KEY = 'actions';
const CAP = 500;
let buffer: ActionRecord[] = [];
let timer: number | undefined;

export function recordAction(rec: ActionRecord): void {
  buffer.push(rec);
  if (timer !== undefined) return;
  timer = window.setTimeout(() => {
    timer = undefined;
    const batch = buffer;
    buffer = [];

    ext.storage.local
      .get(KEY)
      .then((r) => {
        let items: ActionRecord[] = Array.isArray(r[KEY]) ? (r[KEY] as ActionRecord[]) : [];
        for (const record of batch) items = pushRing(items, record, CAP);
        return ext.storage.local.set({ [KEY]: items });
      })
      .catch(() => undefined);
  }, 2000);
}