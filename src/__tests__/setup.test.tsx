import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SetupScreen from '../app/sale/[id]/setup';
import { farmStore as mockFarmStore } from '../store/farm';
import { SaleProvider } from '../store/SaleProvider';
import { wrap } from '../test/render';
import { setSessionUser } from '../store/session';

/**
 * Same jest.mock pattern as PeoplePicker.test.tsx — the instance is built
 * INSIDE the factory, not captured from an outer const. See that file's
 * header for why the ordering matters.
 */
jest.mock('../store/farm', () => {
  const actual = jest.requireActual('../store/farm');
  const { MemoryFarmStore } = jest.requireActual('../store/farm-memory');
  return { ...actual, farmStore: new MemoryFarmStore() };
});

// Once prefill appends a zone, ZoneEditor mounts and pulls in PeoplePicker,
// whose bare `../store/people` import would otherwise resolve to the real
// SqlitePeopleStore under jest-expo's platform resolution and blow up with
// no native module present — same jest.mock pattern as PeoplePicker.test.tsx.
jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/people');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});

// The event store this screen writes through — a fresh in-memory map per
// saleId, same shape SaleProvider expects from './store'. See the comment on
// the equivalent mock in farm-profile.test.tsx for why this is hand-rolled
// rather than importing the real MemoryStore under Jest.
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
    },
  };
});

// expo-router pulls in ESM outside jest's transformIgnorePatterns; this
// screen's use of it (back button, start-counting navigation) is not what
// these tests assert on.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderSetup(saleId: string) {
  return wrap(
    <SaleProvider saleId={saleId}>
      <SetupScreen />
    </SaleProvider>,
  );
}

// E02-S01: nothing is recorded without a signed-in user.
beforeAll(() => setSessionUser('user-test'));

describe('setup: use the farm profile', () => {
  beforeEach(async () => {
    for (const z of await mockFarmStore.listZones()) await mockFarmStore.archiveZone(z.id);
  });

  it("does not show the prefill card when the profile is empty", async () => {
    renderSetup('s-empty-profile');
    await flush();
    expect(screen.queryByTestId('use-farm-profile')).toBeNull();
  });

  it('shows the prefill card only when the sale has no zones yet, and appends nothing until pressed', async () => {
    const zone = await mockFarmStore.addZone('โซนบน');
    await mockFarmStore.addPile(zone.id, 'กองที่ 1', 2000, 50000);

    renderSetup('s-prefill');
    await flush();

    expect(screen.getByTestId('use-farm-profile')).toBeTruthy();
    // Nothing appended by merely opening the screen.
    expect(screen.queryByTestId(`zone-editor-${zone.id}`)).toBeNull();
  });

  it('pressing prefill appends one zone_added and one pile_added per zone, carrying the profile ids', async () => {
    const zoneA = await mockFarmStore.addZone('โซนบน');
    await mockFarmStore.addPile(zoneA.id, 'กองที่ 1', 2000, 50000);
    await mockFarmStore.addPile(zoneA.id, 'กองที่ 2', 2500, 45000);
    const zoneB = await mockFarmStore.addZone('โซนล่าง');
    await mockFarmStore.addPile(zoneB.id, 'กองที่ 3', 1800, 48000);

    renderSetup('s-prefill-press');
    await flush();

    await act(async () => {
      fireEvent.press(screen.getByTestId('use-farm-profile'));
      await Promise.resolve();
    });
    await flush();

    expect(screen.getByTestId(`zone-editor-${zoneA.id}`)).toBeTruthy();
    expect(screen.getByTestId(`zone-editor-${zoneB.id}`)).toBeTruthy();
    // start-counting is still gated the same way as any hand-typed sale —
    // the prefill card must not special-case the gate.
    expect(screen.getByTestId('start-blocker')).toBeTruthy();
  });

  it('the prefill card disappears once the sale already has a zone', async () => {
    const zone = await mockFarmStore.addZone('โซนบน');
    await mockFarmStore.addPile(zone.id, 'กองที่ 1', 2000, 50000);

    renderSetup('s-already-has-zone');
    await flush();
    await act(async () => {
      fireEvent.press(screen.getByTestId('use-farm-profile'));
      await Promise.resolve();
    });
    await flush();

    expect(screen.queryByTestId('use-farm-profile')).toBeNull();
  });
});
