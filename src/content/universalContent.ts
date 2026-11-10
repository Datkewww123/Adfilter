import { initUniversalContent } from './universalEngine';

(function startUniversal() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    initUniversalContent(document);
  }
})();
