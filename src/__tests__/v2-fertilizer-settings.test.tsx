import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fertOptionId, projectFinance } from '../core/finance/ledger';
import type { FinanceEvent } from '../core/finance/types';
import { FertilizerSettingsScreen } from '../v2/money/fertilizer-settings';
import { financeStore as mockFinance } from '../store/finance';
import { wrap } from '../test/render';

jest.mock('../store/finance', () => {
  const { MemoryFinanceStore } = jest.requireActual('../store/finance-memory');
  return { financeStore: new MemoryFinanceStore() };
});
jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { peopleStore: new MemoryPeopleStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

let seq = 0;
async function seed(targetId: string, payload: FinanceEvent['payload'], base: string | null = null) {
  seq += 1;
  const id = `seed-${String(seq).padStart(3, '0')}`;
  await mockFinance.append({ id, groupId: 'group-1', deviceSeq: seq, ts: seq, actor: { userId: 'u', deviceId: 'dev-other' }, source: 'app', targetId, baseEventId: base, payload });
  return id;
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const type = (id: string, v: string) => fireEvent.changeText(screen.getByTestId(id), v);

const YELLOW = fertOptionId('reason', 'ใบเหลือง');

beforeAll(async () => {
  await seed(YELLOW, { t: 'fert_option_set', kind: 'reason', name: 'ใบเหลือง', description: 'ใบเหลืองทั้งแปลง เริ่มจากใบล่างแล้วลามขึ้น มักเห็นหลังฝนตกชุก', hidden: false });
});

describe('fertilizer settings (21h)', () => {
  it('adds a reason with a description, renames it on the same record, hides and shows it', async () => {
    wrap(<FertilizerSettingsScreen />);
    await flush();
    press('fert-set-add');
    type('fert-set-name', 'เร่งน้ำยาง');
    type('fert-set-desc', 'ช่วงก่อนเปิดกรีด');
    await act(async () => press('fert-set-save'));
    await flush();
    const id = fertOptionId('reason', 'เร่งน้ำยาง');
    expect(screen.getByTestId(`fert-set-row-${id}`)).toHaveTextContent(/ช่วงก่อนเปิดกรีด/);

    press(`fert-set-edit-${id}`);
    type('fert-set-name', 'เร่งน้ำยางก่อนเปิดกรีด');
    await act(async () => press('fert-set-save'));
    await flush();
    press(`fert-set-hide-${id}`);
    await flush();
    expect(screen.getByTestId(`fert-set-row-${id}`)).toHaveTextContent(/ซ่อนอยู่/);

    const events = (await mockFinance.load()).filter((e) => e.targetId === id);
    expect(events).toHaveLength(3);
    expect(events[1].baseEventId).toBe(events[0].id);
    expect(events[2].baseEventId).toBe(events[1].id);
    expect(projectFinance(await mockFinance.load()).fertOptions.find((o) => o.id === id)).toMatchObject({ name: 'เร่งน้ำยางก่อนเปิดกรีด', hidden: true });

    press(`fert-set-hide-${id}`);
    await flush();
    expect(projectFinance(await mockFinance.load()).fertOptions.find((o) => o.id === id)?.hidden).toBe(false);
  });

  it('tabs list each kind; search narrows', async () => {
    await seed(fertOptionId('brand', 'ตราใบไม้'), { t: 'fert_option_set', kind: 'brand', name: 'ตราใบไม้', description: '', hidden: false });
    wrap(<FertilizerSettingsScreen />);
    await flush();
    press('fert-set-tab-brand');
    expect(screen.getByText('ตราใบไม้')).toBeTruthy();
    expect(screen.queryByText('ใบเหลือง')).toBeNull();
    press('fert-set-tab-reason');
    type('fert-set-search', 'เหลือง');
    expect(screen.getByText('ใบเหลือง')).toBeTruthy();
    expect(screen.queryByText('บำรุงต้น')).toBeNull();
  });

  it('the % for fertilizer is set here, naming the head it saw', async () => {
    wrap(<FertilizerSettingsScreen />);
    await flush();
    type('fert-set-pct', '40');
    await act(async () => press('fert-set-pct-save'));
    await flush();
    type('fert-set-pct', '45');
    await act(async () => press('fert-set-pct-save'));
    await flush();
    const evs = (await mockFinance.load()).filter((e) => e.targetId === 'cat-fertilizer' && e.payload.t === 'category_share_set');
    expect(evs).toHaveLength(2);
    expect(evs[1].baseEventId).toBe(evs[0].id);
    expect(projectFinance(await mockFinance.load()).categories.find((c) => c.id === 'cat-fertilizer')?.workerPct).toBe(45);
  });
});

