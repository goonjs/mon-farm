import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import CounterScreen from '../app/sale/[id]/counter';
import { LogBuilder } from '../core/fixtures';
import { peopleStore as mockMaster } from '../store/people';
import { SpeechProvider } from '../speech';
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
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Farm จันทเขลม: จุด 1, จุด 2 → แดง. A sale weighing at จุด 1, with or without a price. */
async function setup(saleId: string, price: number | null) {
  await mockMaster.updateSettings({ zeroCheck: 'skip' });
  const farm = await mockMaster.addProperty({ name: 'จันทเขลม', crop: 'rubber' });
  const p1 = await mockMaster.addPoint(farm.id, `จุด 1 ${saleId}`);
  const p2 = await mockMaster.addPoint(farm.id, `จุด 2 ${saleId}`);
  const red = await mockMaster.create('แดง', ['tapper']);
  await mockMaster.assignTapper(p1.id, red.id, null);
  await mockMaster.assignTapper(p2.id, red.id, null);
  const b = new LogBuilder(saleId)
    .sys({ t: 'sale_started', farmName: '', buyer: 'ล้ง', manager: '', workerLead: '', where: 'farm' })
    .sys({ t: 'numbering_set', numbering: 'per-tapper' });
  if (price !== null) b.sys({ t: 'price_set', satangPerKg: price, indexRef: '' });
  b.sys({ t: 'zone_added', zoneId: farm.id, name: farm.name })
    .sys({ t: 'pile_added', pileId: p1.id, zoneId: farm.id, name: p1.name, tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'pile_added', pileId: p2.id, zoneId: farm.id, name: p2.name, tareG: 2_000, stdNetG: 50_000 })
    .sys({ t: 'ready', pileId: p1.id })
    .sys({ t: 'ready', pileId: p2.id })
    .acceptAt(p2.id, 1)
    .shortAt(p1.id, 2, 37_000);
  for (const e of b.build()) await mockEventStore.append(e);
  mockParams = { pile: p1.id };
  return { farm, p1, p2, red };
}

function render(saleId: string) {
  wrap(
    <SpeechProvider initial={false}>
      <SaleProvider saleId={saleId}>
        <CounterScreen />
      </SaleProvider>
    </SpeechProvider>,
  );
}

describe('E04-S05 — recorder mode at a weighing point', () => {
  it('shows the six values: point + tapper, current number, done, kg, open short basket', async () => {
    const { p1 } = await setup('sale-rec-1', null);
    render('sale-rec-1');
    await flush();
    await flush();
    expect(screen.getByTestId('rec-point')).toHaveTextContent(new RegExp(`จันทเขลม · ${p1.name}`));
    expect(screen.getByTestId('rec-tapper')).toHaveTextContent(/แดง/);
    expect(screen.getByTestId('rec-current')).toHaveTextContent('3');
    expect(screen.getByTestId('rec-totals-of')).toHaveTextContent('ยอดของแดง');
    expect(screen.getByTestId('rec-card-1')).toHaveTextContent(/เสร็จแล้ว\s*2\s*เข่ง/);
    expect(screen.getByTestId('rec-card-kg')).toHaveTextContent(/85\s*กก\./);
    expect(screen.getByTestId('rec-card-short')).toHaveTextContent(/35\s*กก\./);
    expect(screen.getByTestId('hold-label')).toHaveTextContent('กดค้างเพื่อบันทึกเข่งเต็ม');
    expect(screen.queryByTestId('count')).toBeNull();
    expect(screen.getByTestId('caption')).toHaveTextContent(/ตาชั่งควรอ่าน 52 กก\./);
    expect(screen.getByTestId('rec-sync')).toHaveTextContent(/รอส่ง \d+/);
  });

  it('with a price, the first card is the compact total and the big card says how many are done (D-40, D-41)', async () => {
    await setup('sale-rec-2', 4_850);
    render('sale-rec-2');
    await flush();
    await flush();
    // 85 kg × 48.50 = 4,122.50 ฿
    expect(screen.getByTestId('rec-card-1')).toHaveTextContent(/ราคารวม\s*4.12 พัน/);
    expect(screen.getByTestId('rec-counted')).toHaveTextContent('นับแล้ว 2 เข่ง');
  });

  it('the ⋯ menu holds the basket list and "ชั่งครบแล้ว → ตรวจยอด"; the big number stays in view', async () => {
    const { p2 } = await setup('sale-rec-3', null);
    render('sale-rec-3');
    await flush();
    await flush();
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-list'));
    expect(screen.getByTestId('rec-list')).toHaveTextContent(new RegExp(`#1.*${p2.name}.*50 กก\\.`));
    expect(screen.getByTestId('rec-current')).toHaveTextContent('3');
    fireEvent.press(screen.getByTestId('rec-list-close'));
    fireEvent.press(screen.getByTestId('rec-menu'));
    fireEvent.press(screen.getByTestId('rec-menu-finish'));
    expect(screen.getByTestId('close-sale-detail')).toBeTruthy();
  });

  it('switching point is one tap to the point picker, which then opens the counter on the pick', async () => {
    await setup('sale-rec-4', null);
    render('sale-rec-4');
    await flush();
    await flush();
    fireEvent.press(screen.getByTestId('rec-switch'));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/sale/[id]/points', params: expect.objectContaining({ id: 'sale-rec-4', switch: '1' }) }),
    );
  });
});
