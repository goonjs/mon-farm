/**
 * Whether the points wizard may create points yet (E01-S09). Re-checks whenever
 * the sync engine reports a change, which includes every completed pull.
 */

import { useEffect, useState } from 'react';

import { store } from '../store/store';
import { onSyncChanged, syncMode } from './changed';
import { firstPullDone } from './first-pull';

export function useFirstPullDone(): boolean {
  // Optimistic only when there is no sync at all; otherwise wait to be told.
  const [done, setDone] = useState(() => syncMode() === 'off');
  useEffect(() => {
    let live = true;
    const check = () => {
      const mode = syncMode();
      if (mode !== 'on') {
        setDone(firstPullDone(mode, 0));
        return;
      }
      store
        .syncCursor()
        .then((cursor) => live && setDone(firstPullDone(mode, cursor)))
        .catch(() => live && setDone(false));
    };
    check();
    const off = onSyncChanged(check);
    return () => {
      live = false;
      off();
    };
  }, []);
  return done;
}
