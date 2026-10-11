import { afterEach, describe, expect, it, vi } from 'vitest';

import { onForeground } from './use-sync';

type Doc = {
  visibilityState: string;
  addEventListener: (t: string, l: () => void) => void;
  removeEventListener: (t: string, l: () => void) => void;
};

function fakeDocument() {
  const listeners = new Set<() => void>();
  const doc: Doc = {
    visibilityState: 'hidden',
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  return { doc, fire: () => listeners.forEach((l) => l()), count: () => listeners.size };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onForeground (web visibilitychange)', () => {
  it('calls back only when the tab became visible, and stops after unsubscribe', () => {
    const d = fakeDocument();
    vi.stubGlobal('document', d.doc);
    const heard = vi.fn();
    const off = onForeground(heard);
    d.fire(); // hidden
    expect(heard).not.toHaveBeenCalled();
    d.doc.visibilityState = 'visible';
    d.fire();
    expect(heard).toHaveBeenCalledTimes(1);
    off();
    expect(d.count()).toBe(0);
    d.fire();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('is a harmless no-op where there is no document (native)', () => {
    vi.stubGlobal('document', undefined);
    expect(() => onForeground(() => undefined)()).not.toThrow();
  });
});
