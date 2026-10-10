import { act, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SaleListScreen from '../app/index';
import { LogBuilder } from '../core/fixtures';
import { peopleStore as mockMaster } from '../store/people';
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
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('Sale list cards — mockup v1.1.0 sale-00', () => {
  it('date in พ.ศ., buyer, baskets, total kg, status, and kg per tapper', async () => {
    const f = await mockMaster.addProperty({ name: 'จันทเขลม', crop: 'rubber' });
    const p1 = await mockMaster.addPoint(f.id, 'จุด 1');
    const red = await mockMaster.create('แดง', ['tapper']);
    await mockMaster.assignTapper(p1.id, red.id, null);
    const b = new LogBuilder('sale-card-1')
      .sys({ t: 'sale_started', farmName: '', buyer: 'คนรับซื้อยาง ก', manager: '', workerLead: '', where: 'farm' })
      .acceptAt(p1.id, 1)
      .acceptAt(p1.id, 2, 40_000);
    for (const e of b.build()) await mockEventStore.append(e);
    wrap(<SaleListScreen />);
    await flush();
    await flush();
    const card = screen.getByTestId('sale-sale-card-1');
    expect(card).toHaveTextContent(/2569/);
    expect(card).toHaveTextContent(/คนรับซื้อยาง ก/);
    expect(card).toHaveTextContent(/2 เข่ง/);
    expect(card).toHaveTextContent(/90 กก\./);
    expect(card).toHaveTextContent(/กำลังชั่ง/);
    expect(card).toHaveTextContent(/แดง\s*90 กก\./);
  });
});
