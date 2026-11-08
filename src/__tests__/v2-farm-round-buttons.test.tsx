import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { PropertyScreen } from '../v2/farm/farms-screens';
import { PointScreen, PointsWizardScreen } from '../v2/farm/points-screens';
import { BuyersScreen } from '../v2/farm/buyers-screen';
import { PersonScreen } from '../v2/farm/people-screens';
import { SaleSettingsScreen } from '../v2/farm/sale-settings-screen';
import { SpeechProvider } from '../speech';
import { V2Device } from '../v2/device-screen';
import { tokens } from '../../design/tokens';
import type { MasterStore } from '../store/master-store';
import { wrap } from '../test/render';

jest.mock('../store/people', () => {
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  const holder = { current: new MemoryPeopleStore() };
  return {
    get peopleStore() {
      return holder.current;
    },
    __reset: () => {
      holder.current = new MemoryPeopleStore();
    },
  };
});
jest.mock('../store/account', () => {
  const { MemoryAccountStore } = jest.requireActual('../store/account-memory');
  return { accountStore: new MemoryAccountStore() };
});
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});

jest.mock('expo-router', () => {
  const params: { current: Record<string, string> } = { current: {} };
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => params.current,
    useRouter: () => router,
    router,
    __params: params,
  };
});

const { __params: mockParams, router: mockRouter } = jest.requireMock('expo-router') as {
  __params: { current: Record<string, string> };
  router: Record<'push' | 'replace' | 'back' | 'setParams', jest.Mock>;
};
const master = () => (jest.requireMock('../store/people') as { peopleStore: MasterStore }).peopleStore;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}


const c = tokens.color.light;
type Node = { props: Record<string, unknown>; findAll: (f: (n: Node) => boolean) => Node[] };
const flat = (st: unknown) => Object.assign({}, ...[st].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
/** A short word or icon inside an outlined round/near-round box: what the owner banned (2026-11-06). */
const roundOutlined = (n: Node) => {
  const s = flat(n.props.style);
  return Number(s.borderWidth ?? 0) > 0 && Number(s.borderRadius ?? 0) >= 24;
};
const chevronIn = (id: string) => within(screen.getByTestId(id)).getByTestId(`${id}-chevron`, { includeHiddenElements: true });
const underlined = (id: string, ink: string) => {
  const link = screen.getByTestId(id);
  expect(roundOutlined(link as unknown as Node)).toBe(false);
  const txt = (link as unknown as Node).findAll((n) => flat(n.props.style).textDecorationLine === 'underline');
  expect(txt.length).toBeGreaterThan(0);
  expect(flat(txt[0].props.style).color).toBe(ink);
};
const dashedRow = (id: string) => {
  const s = flat(screen.getByTestId(id).props.style);
  expect(s.borderStyle).toBe('dashed');
  expect(s.alignSelf === 'flex-start').toBe(false);
};

beforeEach(() => {
  (jest.requireMock('../store/people') as { __reset: () => void }).__reset();
  mockParams.current = {};
  for (const fn of Object.values(mockRouter)) fn.mockClear();
});

describe('farm screens: no round outlined word buttons (owner per-button answers 2026-11-07)', () => {
  it('สวน: the name card edits (A, no "แก้" in the header), the area row changes it (A), + เพิ่มจุดชั่ง is a dashed row (D), ลบสวน a red link (F)', async () => {
    const m = master();
    const p = await m.addProperty({ name: 'สวนจันทเขลม', crop: 'rubber' });
    mockParams.current = { id: p.id };
    wrap(<PropertyScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).queryByTestId('property-edit')).toBeNull();
    expect(within(screen.getByTestId('property-edit')).getByText('สวนจันทเขลม')).toBeTruthy();
    expect(chevronIn('property-edit')).toBeTruthy();
    expect(screen.queryByText(/แตะเพื่อแก้/)).toBeNull();
    fireEvent.press(screen.getByTestId('property-edit'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/property/${p.id}?edit=1`);

    expect(within(screen.getByTestId('change-area')).getByText('พื้นที่ตอนนี้')).toBeTruthy();
    expect(chevronIn('change-area')).toBeTruthy();
    expect(screen.getByTestId('change-area').props.accessibilityHint).toMatch(/^เปลี่ยนพื้นที่/);
    // the card's content is read, not replaced by a label
    expect(screen.getByTestId('property-edit').props.accessibilityLabel).toBeUndefined();

    dashedRow('add-point');
    underlined('property-delete', c.reject);
  });

  it('คน: the person card edits (A); ลบ is a red link (F)', async () => {
    const p = await master().create('แดง', ['tapper']);
    mockParams.current = { id: p.id };
    wrap(<PersonScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).queryByTestId('person-edit')).toBeNull();
    expect(within(screen.getByTestId('person-edit')).getByText('แดง')).toBeTruthy();
    expect(chevronIn('person-edit')).toBeTruthy();
    fireEvent.press(screen.getByTestId('person-edit'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/person/${p.id}?edit=1`);
    underlined('person-delete', c.reject);
  });

  it('จุดชั่ง: the point card renames (A); ลบจุดชั่ง is a red link (F)', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const pt = await m.addPoint(farm.id, 'จุด 1');
    mockParams.current = { id: pt.id };
    wrap(<PointScreen />);
    await flush();
    expect(within(screen.getByTestId('screen-header')).queryByTestId('point-rename')).toBeNull();
    expect(within(screen.getByTestId('point-rename')).getByText('จุด 1')).toBeTruthy();
    expect(chevronIn('point-rename')).toBeTruthy();
    fireEvent.press(screen.getByTestId('point-rename'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/v2/point/${pt.id}?edit=1`);
    underlined('point-delete', c.reject);
  });

  it('คนรับซื้อยาง: ลบ is a red link (F)', async () => {
    const b = await master().addBuyer('คนรับซื้อยาง ก');
    wrap(<BuyersScreen />);
    await flush();
    fireEvent.press(screen.getByTestId(`buyer-${b.id}`));
    underlined('buyer-delete', c.reject);
  });

  it('ตั้งค่าการขาย: ใช้เป็นค่าเริ่มต้น is a word link with no arrow (B); + เพิ่มคู่น้ำหนัก a dashed row (D); − / + square (G)', async () => {
    wrap(<SaleSettingsScreen />);
    await flush();
    underlined('make-default-builtin-60', c.action);
    expect(screen.getByTestId('make-default-builtin-60')).not.toHaveTextContent(/›/);
    expect(screen.getByTestId('make-default-builtin-60').props.accessibilityLabel).toMatch(/^ใช้เป็นค่าเริ่มต้น .*60/);
    dashedRow('add-pair');
    const less = flat(screen.getByTestId('dup-less').props.style);
    expect(less.borderRadius).toBe(tokens.radius.md);
    expect(flat(screen.getByTestId('hold-more').props.style).borderRadius).toBe(tokens.radius.md);
  });

  it('เครื่องนี้: − / + square (G)', async () => {
    wrap(
      <SpeechProvider initial>
        <V2Device />
      </SpeechProvider>,
    );
    await flush();
    expect(flat(screen.getByTestId('device-hold-less').props.style).borderRadius).toBe(tokens.radius.md);
  });

  it('ตัวช่วยตั้งค่าจุดชั่ง: − / + soft circles, no outline, app colours (J)', async () => {
    const m = master();
    const farm = await m.addProperty({ name: 'สวน', crop: 'rubber' });
    const daeng = await m.create('แดง', ['tapper']);
    wrap(<PointsWizardScreen />);
    await flush();
    fireEvent.press(screen.getByTestId(`wizard-farm-${farm.id}`));
    fireEvent.press(screen.getByTestId(`wizard-tapper-${daeng.id}`));
    const s = flat(screen.getByTestId(`wizard-count-${daeng.id}-less`).props.style);
    expect(Number(s.borderWidth ?? 0)).toBe(0);
    expect(s.backgroundColor).toBe(c.actionSunk);
    expect(s.borderRadius).toBe(tokens.radius.pill);
  });
});
