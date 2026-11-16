type G = typeof globalThis & { browser?: typeof chrome; chrome?: typeof chrome };
export const ext: typeof chrome =
  (globalThis as G).browser ?? (globalThis as G).chrome ?? ({} as typeof chrome);