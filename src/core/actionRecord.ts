export interface ActionRecord {
  at: number;
  action: string;
  dryRun: boolean;
  ok?: boolean;
  verified?: boolean;
  latencyMs?: number;
  error?: string;
}