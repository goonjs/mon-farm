import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import FarmProfileScreen from '../app/farm-profile';
import { farmStore as mockFarmStore } from '../store/farm';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';

/**
 * Same jest.mock pattern as PeoplePicker.test.tsx — see that file's header
 * for why the instance is built INSIDE the factory rather than captured from
 * an outer const.
 */
jest.mock('../store/farm', () => {
  const actual = jest.requireActual('../store/farm');
  const { MemoryFarmStore } = jest.requireActual('../store/farm-memory');
  return { ...actual, farmStore: new MemoryFarmStore() };
});

// `MemoryStore` lives in store.ts itself (unlike the people/farm stores, it
// has no separate ...-memory.ts to sidestep Jest's platform resolution — see
// the comment on `farm-memory.ts` for why that resolution is the problem).
// requireActual('../store/store') under Jest resolves to store.native.ts,
// which doesn't export it, so this hand-rolls the same minimal shape rather
// than fighting the resolver for a class this test only needs two methods
// of.
jest.mock('../store/store', () => {
  const rows = new Map<string, unknown[]>();
  return {
    store: {
      async append(event: { saleId: string; seq: number }) {
        const list = (rows.get(event.saleId) ?? []) as { seq: number }[];
        list.push(event);
        rows.set(event.saleId, list);
      },
      async load(saleId: string) {
        return [...((rows.get(saleId) ?? []) as { seq: number }[])].sort((a, b) => a.seq - b.seq);
      },
      async listSales() {
        return [...rows.keys()];
      },
      async pending() {
        return [];
      },
      async markSynced() {},
      async device() {
        return { deviceId: 'dev-test', nextDeviceSeq: 1 };
      },
      async isDurable() {
        return true;
      },
      // Test-only: same instance across the file (the factory only runs
      // once), so each test clears it rather than getting a fresh one.
      __clear() {
        rows.clear();
      },
    },
  };
});

// expo-router pulls in ESM that jest's transformIgnorePatterns doesn't cover
// (see jest.config.js) — this screen's only use of it is the back Link, which
// nothing here asserts on, so a bare pass-through stub is enough.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  // The header's sync pill reads the store on focus; not under test here.
  useFocusEffect: () => undefined,
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('FarmProfileScreen', () => {
  beforeEach(async () => {
    // Same store instances across the whole file (jest.mock's factories only
    // run once and are memoised), so tests clear them rather than recreate
    // them — same pattern as PeoplePicker.test.tsx.
    for (const z of await mockFarmStore.listZones()) await mockFarmStore.archiveZone(z.id);
    (mockStore as unknown as { __clear: () => void }).__clear();
  });

  it('adds a zone and a pile, converting kg to grams', async () => {
    wrap(<FarmProfileScreen />);
    await flush();

    expect(screen.getByTestId('farm-profile-empty')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('new-zone-name'), 'โซนบน');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-zone'));
      await Promise.resolve();
    });
    await flush();

    const zones = await mockFarmStore.listZones();
    expect(zones).toHaveLength(1);
    const zone = zones[0];
    expect(screen.getByTestId(`zone-${zone.id}`)).toBeTruthy();

    fireEvent.changeText(screen.getByTestId(`pile-name-${zone.id}`), 'กองที่ 1');
    fireEvent.changeText(screen.getByTestId(`pile-tare-${zone.id}`), '2.5');
    fireEvent.changeText(screen.getByTestId(`pile-std-${zone.id}`), '50');
    await act(async () => {
      fireEvent.press(screen.getByTestId(`add-pile-${zone.id}`));
      await Promise.resolve();
    });
    await flush();

    const after = await mockFarmStore.getZone(zone.id);
    expect(after?.piles).toHaveLength(1);
    expect(after?.piles[0]).toMatchObject({ name: 'กองที่ 1', tareG: 2500, stdNetG: 50000 });
  });

  it('archiving a zone removes it from the list', async () => {
    const zone = await mockFarmStore.addZone('โซนล่าง');
    wrap(<FarmProfileScreen />);
    await flush();

    expect(screen.getByTestId(`zone-${zone.id}`)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId(`archive-zone-${zone.id}`));
      await Promise.resolve();
    });
    await flush();

    expect(screen.queryByTestId(`zone-${zone.id}`)).toBeNull();
    const still = await mockFarmStore.getZone(zone.id);
    expect(still?.archivedTs).not.toBeNull();
  });

  it('offers to seed from the most recent sale when the profile is empty and a sale exists', async () => {
    await mockStore.append({
      id: 'past-sale/1',
      saleId: 'past-sale',
      seq: 1,
      deviceSeq: 1,
      ts: Date.now(),
      mono: 1,
      actor: { userId: 'user-test', deviceId: 'dev-old' },
      source: 'app',
      kind: 'sys',
      payload: { t: 'zone_added', zoneId: 'zone-x', name: 'โซนเก่า' },
    });
    await mockStore.append({
      id: 'past-sale/2',
      saleId: 'past-sale',
      seq: 2,
      deviceSeq: 2,
      ts: Date.now(),
      mono: 2,
      actor: { userId: 'user-test', deviceId: 'dev-old' },
      source: 'app',
      kind: 'sys',
      payload: { t: 'pile_added', pileId: 'pile-x', zoneId: 'zone-x', name: 'กองเก่า', tareG: 2000, stdNetG: 50000 },
    });

    wrap(<FarmProfileScreen />);
    await flush();
    await flush();

    expect(screen.getByTestId('seed-from-last-sale')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('seed-from-last-sale'));
      await Promise.resolve();
    });
    await flush();

    const zones = await mockFarmStore.listZones();
    expect(zones).toHaveLength(1);
    expect(zones[0].name).toBe('โซนเก่า');
    expect(zones[0].piles).toHaveLength(1);
    expect(zones[0].piles[0]).toMatchObject({ name: 'กองเก่า', tareG: 2000, stdNetG: 50000 });
    // Seeding mints its own ids — it does not reuse the past sale's, which
    // stays associated with that sale's own log.
    expect(zones[0].id).not.toBe('zone-x');
  });
});
