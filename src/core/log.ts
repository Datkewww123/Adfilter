const PREFIX = '[AdFilter]';

export const log = {
  info: (...args: unknown[]) => console.log(PREFIX, ...args),
  warn: (...args: unknown[]) => console.info(PREFIX, '[WARN]', ...args),
  error: (...args: unknown[]) => console.info(PREFIX, '[ERROR]', ...args),
};