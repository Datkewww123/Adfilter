export interface CanaryResult {
  ok: boolean;
  missing: string[];
}

export function evaluateStructure(
  presence: Record<string, boolean>,
  required: readonly string[],
): CanaryResult {
  const missing = required.filter((k) => presence[k] !== true);
  return { ok: missing.length === 0, missing };
}
