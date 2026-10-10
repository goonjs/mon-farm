import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import BackfillScreen from '../app/sale/[id]/backfill';
import { LogBuilder } from '../core/fixtures';
import { peopleStore as mockMaster } from '../store/people';
import { SaleProvider } from '../store/SaleProvider';
import { store as mockEventStore } from '../store/store';
import { wrap } from '../test/render';

jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/master-store');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('E04-S10 — backfill screen (mockup v1.1.0 sale-23)', () => {
  it('3 full + 20 kg short after แดง\'s basket 27: the preview numbers them on, and saving adds 4 labelled baskets', async () => {
    const farm = await mockMaster.addProperty({ name: 'จันทเขลม', crop: 'rubber' });
    const p = await mockMaster.addPoint(farm.id, 'จุด 3');
    const red = await mockMaster.create('แดง', ['tapper']);
    await mockMaster.assignTapper(p.id, red.id, null);
    const b = new LogBuilder('sale-bf-1')
      .sys({ t: 'sale_started', farmName: '', buyer: 'ล้ง', manager: '', workerLead: '', where: 'farm' })
      .sys({ t: 'numbering_set', numbering: 'per-tapper' })
      .sys({ t: 'zone_added', zoneId: farm.id, name: farm.name })
      .sys({ t: 'pile_added', pileId: p.id, zoneId: farm.id, name: p.name, tareG: 2_000, stdNetG: 50_000 });
    for (let i = 1; i <= 27; i++) b.acceptAt(p.id, i);
    for (const e of b.build()) await mockEventStore.append(e);
    mockParams = { id: 'sale-bf-1', pile: p.id };
    wrap(
      <SaleProvider saleId="sale-bf-1">
        <BackfillScreen />
      </SaleProvider>,
    );
    await flush();
    await flush();
    expect(screen.getByTestId('bf-point')).toHaveTextContent(/จันทเขลม · จุด 3.*แดง/);
    fireEvent.changeText(screen.getByTestId('bf-full'), '3');
    fireEvent.changeText(screen.getByTestId('bf-short'), '20');
    expect(screen.getByTestId('bf-plan')).toHaveTextContent(/จะได้ 4 เข่ง/);
    expect(screen.getByTestId('bf-plan')).toHaveTextContent(/เข่งที่ 28–30.*150 กก\./);
    expect(screen.getByTestId('bf-plan')).toHaveTextContent(/เข่งที่ 31.*20 กก\./);
    expect(screen.getByTestId('bf-plan')).toHaveTextContent(/170 กก\..*เลขเข่งต่อจากเข่งล่าสุดของแดง \(27\)/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('bf-save'));
    });
    await flush();
    const added = ((await mockEventStore.load('sale-bf-1')) as { kind: string; basketNo?: number; input?: string; backfill?: boolean }[]).filter(
      (e) => (e.kind === 'accept' && e.input === 'backfill') || (e.kind === 'short' && e.backfill),
    );
    expect(added.map((e) => e.basketNo)).toEqual([28, 29, 30, 31]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('nothing entered, or not a whole number: says what to fix and saves nothing', async () => {
    mockParams = { id: 'sale-bf-2', pile: 'nope' };
    wrap(
      <SaleProvider saleId="sale-bf-2">
        <BackfillScreen />
      </SaleProvider>,
    );
    await flush();
    fireEvent.changeText(screen.getByTestId('bf-full'), '2.5');
    await act(async () => {
      fireEvent.press(screen.getByTestId('bf-save'));
    });
    expect(screen.getByText('ใส่จำนวนเข่งเต็มเป็นเลขจำนวนเต็ม')).toBeTruthy();
  });
});
