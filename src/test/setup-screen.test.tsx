import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import SetupScreen from '../app/sale/[id]/setup';
import { LogBuilder } from '../core/fixtures';
import { projectSale } from '../core/project';
import type { SaleEvent } from '../core/types';
import { farmProfileStore } from '../store/farmProfile';
import { SaleProvider } from '../store/SaleProvider';
import { store } from '../store/store';
import { wrap } from './render';

/**
 * The setup screen's farm-profile offer (S27), at the component tier.
 *
 * The guarantee these tests exist for is the one the story calls a data-loss
 * shape: accepting, editing or rejecting an offered zone writes to the SALE's
 * log and never to the profile. Every case below asserts the stored profile
 * afterwards, not just what is on screen.
 *
 * Mock instances are built inside their factories, per s16-people-store.md
 * Dev notes #4.
 */

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn() }) }));

jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/people');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});

jest.mock('../store/farmProfile', () => {
  const actual = jest.requireActual('../store/farmProfile');
  const { MemoryFarmProfileStore } = jest.requireActual('../store/farmProfile-memory');
  return { ...actual, farmProfileStore: new MemoryFarmProfileStore() };
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
      listSales: async () => [...new Set(rows.map((e) => e.saleId))],
    },
  };
});

let sale = '';
let n = 0;

beforeEach(async () => {
  sale = `sale-setup-${++n}`;
  for (const z of (await farmProfileStore.get()).zones) await farmProfileStore.removeZone(z.id);
});

/** One profile zone with one pile — the shape the offer is built from. */
async function profileWithOneZone(name = 'โซน A', tareG = 2_000) {
  const zone = await farmProfileStore.addZone(name);
  const pile = await farmProfileStore.addPile(zone.id, { name: 'กอง 1', tareG, stdNetG: 50_000 });
  return { zone, pile: pile! };
}

async function renderSetup(events: readonly SaleEvent[] = []) {
  for (const e of events) await store.append(e);
  const view = wrap(
    <SaleProvider saleId={sale}>
      <SetupScreen />
    </SaleProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('start-blocker')).toBeTruthy());
  return view;
}

/** The sale's own state, read back through the same log the screen writes. */
async function saleState() {
  return projectSale((await store.load(sale)) as SaleEvent[], sale);
}

describe('the farm profile offered as a starting point', () => {
  it('offers the profile’s zones and piles when the sale has none', async () => {
    const { zone, pile } = await profileWithOneZone();
    await renderSetup();

    await waitFor(() => expect(screen.getByTestId('profile-offer')).toBeTruthy());
    expect(screen.getByTestId(`offer-zone-name-${zone.id}`).props.value).toBe('โซน A');
    expect(screen.getByTestId(`offer-pile-${pile.id}`)).toBeTruthy();
    // Offered, not committed: nothing is in the sale's log yet.
    expect((await saleState()).zones).toEqual([]);
  });

  it('is not offered at all when the profile is empty', async () => {
    await renderSetup();
    expect(screen.queryByTestId('profile-offer')).toBeNull();
    expect(screen.getByTestId('new-zone-name')).toBeTruthy();
  });

  it('accepting writes the same events a hand-typed zone writes', async () => {
    await profileWithOneZone();
    await renderSetup();
    await waitFor(() => expect(screen.getByTestId('profile-offer')).toBeTruthy());

    fireEvent.press(screen.getByTestId('offer-accept'));

    await waitFor(async () => expect((await saleState()).zones).toHaveLength(1));
    const state = await saleState();
    expect(state.zones[0].name).toBe('โซน A');
    expect(state.piles[0]).toMatchObject({ name: 'กอง 1', tareG: 2_000, stdNetG: 50_000 });

    // No event says where the zone came from — the payloads carry exactly the
    // fields a manual add carries, and nothing else.
    const events = (await store.load(sale)) as SaleEvent[];
    const added = events.filter((e) => e.kind === 'sys' && e.payload.t === 'zone_added');
    expect(added).toHaveLength(1);
    expect(Object.keys((added[0] as { payload: object }).payload).sort()).toEqual(['name', 't', 'zoneId']);
    const piles = events.filter((e) => e.kind === 'sys' && e.payload.t === 'pile_added');
    expect(Object.keys((piles[0] as { payload: object }).payload).sort()).toEqual(
      ['name', 'pileId', 'stdNetG', 't', 'tareG', 'zoneId'].sort(),
    );
  });

  it('an edited tare goes into the sale and leaves the profile alone', async () => {
    const { pile } = await profileWithOneZone('โซน A', 2_000);
    const before = JSON.stringify(await farmProfileStore.get());
    await renderSetup();
    await waitFor(() => expect(screen.getByTestId('profile-offer')).toBeTruthy());

    fireEvent.press(screen.getByTestId(`offer-edit-pile-${pile.id}`));
    fireEvent.changeText(screen.getByTestId(`pile-edit-tare-${pile.id}`), '2.6');
    fireEvent.press(screen.getByTestId(`pile-edit-save-${pile.id}`));
    fireEvent.press(screen.getByTestId('offer-accept'));

    await waitFor(async () => expect((await saleState()).piles).toHaveLength(1));
    expect((await saleState()).piles[0].tareG).toBe(2_600);
    // The specific no-mutation guarantee: byte-identical before and after.
    expect(JSON.stringify(await farmProfileStore.get())).toBe(before);
  });

  it('rejecting a zone leaves it out of the sale and out of nothing else', async () => {
    const { zone } = await profileWithOneZone();
    const before = JSON.stringify(await farmProfileStore.get());
    await renderSetup();
    await waitFor(() => expect(screen.getByTestId('profile-offer')).toBeTruthy());

    fireEvent.press(screen.getByTestId(`offer-reject-${zone.id}`));

    // Nothing left to offer, so the plain form is what remains.
    await waitFor(() => expect(screen.queryByTestId('profile-offer')).toBeNull());
    expect((await saleState()).zones).toEqual([]);
    expect(JSON.stringify(await farmProfileStore.get())).toBe(before);
  });

  it('will not accept an offered zone whose name has been blanked', async () => {
    // A hand-typed zone can never be nameless (the form returns early and the
    // button is disabled), and the offer writes the same events, so it must
    // not be able to write one either — an append-only log has no way to take
    // a nameless zone back out. Regression for the QA finding of 2026-09-03.
    const { zone } = await profileWithOneZone();
    await renderSetup();
    await waitFor(() => expect(screen.getByTestId('profile-offer')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId(`offer-zone-name-${zone.id}`), '   ');
    fireEvent.press(screen.getByTestId('offer-accept'));

    expect((await saleState()).zones).toEqual([]);
    expect(screen.getByTestId('profile-offer')).toBeTruthy();
  });

  it('is not offered once the sale already has a zone of its own', async () => {
    await profileWithOneZone();
    const events = new LogBuilder(sale)
      .sys({ t: 'zone_added', zoneId: 'zHand', name: 'โซนพิมพ์เอง' })
      .build();
    await renderSetup(events);

    expect(screen.queryByTestId('profile-offer')).toBeNull();
    expect(screen.getByTestId('zone-editor-zHand')).toBeTruthy();
  });
});
