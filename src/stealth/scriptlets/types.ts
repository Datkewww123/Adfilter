export interface ScriptletEntry {
  name: string;
  args: string[];
  raw: string;
}

export interface ScriptletsIndex {
  version: number;
  global: ScriptletEntry[];
  byDomain: Record<string, ScriptletEntry[]>;
}

export type ScriptletHandler = (win: Window, ...args: string[]) => void;

export interface EventListenerRule {
  eventRegex: RegExp;
  bodyRegex: RegExp;
}
