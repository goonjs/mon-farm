import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import FarmProfileScreen from '../app/farm-profile';
import { LogBuilder } from '../core/fixtures';
import type { SaleEvent } from '../core/types';
import * as farmProfileModule from '../store/farmProfile';
import { farmProfileStore } from '../store/farmProfile';
import { store } from '../store/store';
import { wrap } from './render';

/**
 * The farm profile's own screen (S27), at the component tier.
 *
 * Lives under `src/test/` rather than beside the screen for the reason
 * `counter-screen.test.tsx` records: everything in `src/app/` is a route, so
 * a test file next to it would be exported as a page in the web build.
 *
 * Both stores are mocked, each with its instance built INSIDE the mock
 * factory rather than captured from an outer `const` — the ordering lesson
 * from s16-people-store.md Dev notes #4: `jest.mock` is hoisted above the
 * imports that trigger the factory, so an outer const would still be
 * undefined when the factory runs.
 */

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

jest.mock('../store/farmProfile', () => {
  const actual = jest.requireActual('../store/farmProfile');
  const { MemoryFarmProfileStore } = jest.requireActual('../store/farmProfile-memory');
  // One instance (import sites bind it once), plus a way to put it back to a
  // genuinely untouched document between tests. `establishedTs` is not
  // resettable through the port by design — that is the whole point of it — so
  // emptying the zones is NOT a reset, and a test that must start from a
  // never-established profile has to reach past the port to get one.
  const instance = new MemoryFarmProfileStore();
  return {
    ...actual,
    farmProfileStore: instance,
    __resetProfileStore: () => {
      (instance as unknown as { doc: unknown }).doc = { zones: [], establishedTs: null };
    },
  };
});

jest.mock('../store/store', () => {
  const rows: { saleId: string }[] = [];
  return {
    store: {
      append: async (e: { saleId: string }) => void rows.push(e),
      appendAll: async (batch: { saleId: string }[]) => void rows.push(...batch),
      load: async (saleId: string) => rows.filter((e) => e.saleId === saleId),
      pending: async () => [],
      markSynced: async () => {},
      // Deliberately oldest-first: "the last sale" must be decided by
      // `startedTs`, not by whatever order an adapter happens to list in.
      listSales: async () => [...new Set(rows.map((e) => e.saleId))],
    },
  };
});

/**
 * A brand-new profile store between tests. Emptying the old one is not enough:
 * `establishedTs` deliberately outlives the zones, so a store another test has
 * added a zone to would refuse to seed — which is the behaviour under test one
 * describe below, and would otherwise pass or fail on test ORDER.
 */
function resetProfile() {
  (farmProfileModule as unknown as { __resetProfileStore: () => void }).__resetProfileStore();
}

function saleLog(saleId: string, dayOffset: number, zoneName: string): SaleEvent[] {
  return new LogBuilder(saleId)
    .sys({
      t: 'sale_started',
      farmName: 'ไร่คุณพ่อ',
      buyer: 'ล้งเจริญทรัพย์',
      manager: 'สมชาย',
      workerLead: 'ประยุทธ',
      where: 'farm',
    })
    .sys({ t: 'zone_added', zoneId: 'zA', name: zoneName })
    .sys({ t: 'pile_added', pileId: 'p1', zoneId: 'zA', name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'zone_contract_set', zoneId: 'zA', personId: 'per1', workerName: 'สมหญิง', ownerPct: 60 })
    .build()
    .map((e) => ({ ...e, ts: e.ts + dayOffset * 86_400_000 }));
}

async function seedSale(events: readonly SaleEvent[]) {
  for (const e of events) await store.append(e);
}

async function renderScreen() {
  const view = wrap(<FarmProfileScreen />);
  await waitFor(() => expect(screen.getByTestId('farm-profile')).toBeTruthy());
  return view;
}

beforeEach(() => {
  resetProfile();
});

describe('the farm profile screen', () => {
  it('shows an empty state when there is no profile and no past sale', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('profile-empty')).toBeTruthy());
    expect(screen.getByText('ยังไม่มีโซนที่บันทึกไว้')).toBeTruthy();
  });

  it('adds, renames and removes a zone by hand', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('profile-empty')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('profile-new-zone-name'), 'โซน มือ');
    fireEvent.press(screen.getByTestId('profile-add-zone'));

    await waitFor(() => expect(screen.getByText('โซน มือ')).toBeTruthy());
    const zone = (await farmProfileStore.get()).zones[0];

    fireEvent.press(screen.getByTestId(`profile-rename-zone-${zone.id}`));
    fireEvent.changeText(screen.getByTestId(`profile-zone-name-${zone.id}`), 'โซน ก');
    fireEvent.press(screen.getByTestId(`profile-zone-name-save-${zone.id}`));
    await waitFor(async () => expect((await farmProfileStore.get()).zones[0].name).toBe('โซน ก'));
    // The rename keeps the zone's identity — it is the same row, corrected.
    expect((await farmProfileStore.get()).zones[0].id).toBe(zone.id);

    fireEvent.press(screen.getByTestId(`profile-remove-zone-${zone.id}`));
    fireEvent.press(screen.getByTestId(`profile-remove-zone-${zone.id}-confirm`));
    await waitFor(async () => expect((await farmProfileStore.get()).zones).toEqual([]));
  });

  it('adds, edits and removes a pile inside a zone', async () => {
    const zone = await farmProfileStore.addZone('โซน A');
    await renderScreen();
    await waitFor(() => expect(screen.getByText('โซน A')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId(`profile-pile-name-${zone.id}`), 'กอง 1');
    fireEvent.changeText(screen.getByTestId(`profile-pile-tare-${zone.id}`), '2.4');
    fireEvent.changeText(screen.getByTestId(`profile-pile-std-${zone.id}`), '50');
    fireEvent.press(screen.getByTestId(`profile-add-pile-${zone.id}`));

    await waitFor(async () => expect((await farmProfileStore.get()).zones[0].piles).toHaveLength(1));
    const pile = (await farmProfileStore.get()).zones[0].piles[0];
    expect(pile).toMatchObject({ name: 'กอง 1', tareG: 2_400, stdNetG: 50_000 });

    fireEvent.press(screen.getByTestId(`profile-edit-pile-${pile.id}`));
    fireEvent.changeText(screen.getByTestId(`pile-edit-tare-${pile.id}`), '2.6');
    fireEvent.press(screen.getByTestId(`pile-edit-save-${pile.id}`));
    await waitFor(async () =>
      expect((await farmProfileStore.get()).zones[0].piles[0]).toMatchObject({
        id: pile.id,
        tareG: 2_600,
        stdNetG: 50_000,
      }),
    );

    fireEvent.press(screen.getByTestId(`profile-remove-pile-${pile.id}`));
    fireEvent.press(screen.getByTestId(`profile-remove-pile-${pile.id}-confirm`));
    await waitFor(async () => expect((await farmProfileStore.get()).zones[0].piles).toEqual([]));
  });
});

describe('seeding the profile from a past sale', () => {
  it('seeds once, from the most recently STARTED sale, and never re-seeds', async () => {
    // The older sale is listed FIRST by the mocked adapter, so a screen that
    // took "the first sale it was handed" would seed the wrong one.
    await seedSale(saleLog('sale-old', 0, 'โซนเก่า'));
    await seedSale(saleLog('sale-new', 1, 'โซนใหม่'));

    const first = await renderScreen();
    await waitFor(async () => expect((await farmProfileStore.get()).zones).toHaveLength(1));

    const seeded = await farmProfileStore.get();
    expect(seeded.zones.map((z) => z.name)).toEqual(['โซนใหม่']);
    expect(seeded.zones[0].piles.map((p) => p.name)).toEqual(['กอง 1']);
    // Tares came across; the worker/split contract deliberately did not.
    expect(seeded.zones[0].piles[0]).toMatchObject({ tareG: 2_000, stdNetG: 50_000 });
    expect(JSON.stringify(seeded)).not.toContain('สมหญิง');
    expect(seeded.establishedTs).not.toBeNull();

    // Emptied by the owner, then re-opened: it stays empty.
    for (const z of seeded.zones) await farmProfileStore.removeZone(z.id);
    first.unmount();
    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('profile-empty')).toBeTruthy());
    expect((await farmProfileStore.get()).zones).toEqual([]);
  });

  it('does not seed over a HAND-BUILT profile the owner has since emptied', async () => {
    // The other half of "an intentionally emptied profile stays empty": a
    // profile that was never seeded because the owner typed it themselves,
    // then cleared it out, with a past sale sitting there to seed from.
    // Regression for the QA finding of 2026-09-03 — this screen used to
    // re-seed it from that sale on the next visit, silently.
    await seedSale(saleLog('sale-x', 0, 'โซนจากการขาย'));

    const zone = await farmProfileStore.addZone('โซนมือ');
    await farmProfileStore.removeZone(zone.id);
    expect((await farmProfileStore.get()).zones).toEqual([]);

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('profile-empty')).toBeTruthy());
    expect((await farmProfileStore.get()).zones).toEqual([]);
    expect(screen.queryByText('โซนจากการขาย')).toBeNull();
  });
});
