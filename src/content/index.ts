import { ext } from '../platform/api';
import { log } from '../core/log';
import { emptyStatus, type Msg, type TabStatus } from '../core/messages';
import type { AdPhase, Signals } from '../core/types';
import { PlayerObserver } from './playerObserver';

let currentStatus: TabStatus = emptyStatus();
let lastPhase: AdPhase = currentStatus.phase;
let adStartedAt = 0;

function send(msg: Msg): void {
  try {
    void ext.runtime.sendMessage(msg).catch(() => undefined);
  } catch {
    log.warn('extension context invalidated, stop observing');
    observer.stop();
  }
}

function handle(s: Signals): void {
  const phase: AdPhase = !s.playerFound ? 'UNKNOWN' : s.adShowing ? 'AD' : 'NORMAL';
  if (phase === lastPhase) return;

  if (phase === 'AD') adStartedAt = s.t;
  if (lastPhase === 'AD') {
    currentStatus = {
      ...currentStatus,
      adsDetected: currentStatus.adsDetected + 1,
      adSeconds: currentStatus.adSeconds + (s.t - adStartedAt) / 1000,
    };
  }

  log.info(new Date(s.t).toISOString().slice(11, 19), lastPhase, '->', phase);
  lastPhase = phase;
  currentStatus = { ...currentStatus, phase, updatedAt: s.t };
  send({ kind: 'STATUS_UPDATE', status: currentStatus });
}

const observer = new PlayerObserver(handle);
observer.start();
send({ kind: 'STATUS_UPDATE', status: currentStatus });