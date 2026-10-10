import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SaleSettingsForm } from '../components/SaleSettingsForm';
import { saleSettings } from '../core/master';
import { readHoldMs } from '../store/hold-preference';
import { peopleStore as mockMaster } from '../store/people';
import { wrap } from '../test/render';

jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/master-store');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
}));

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// jest-expo runs without a browser; the device preference needs somewhere to live.
beforeAll(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
    removeItem: (k: string) => m.delete(k),
  };
});

describe('Sale settings — E03-S07', () => {
  it('shows the defaults: whole-kg scale, numbering per tapper, 50 kg + 2 kg default pair, every point, 0.7 s, 8 s', async () => {
    wrap(<SaleSettingsForm />);
    await flush();
    expect(screen.getByTestId('scale-whole').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('scale-decimal1').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('numbering-per-tapper').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('pair-builtin-50')).toHaveTextContent(/ค่าเริ่มต้น/);
    expect(screen.getByTestId('zero-every').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('hold-value')).toHaveTextContent(/0.7/);
    expect(screen.getByTestId('hold-device-only')).toHaveTextContent(/เฉพาะเครื่องนี้/);
    expect(screen.getByTestId('dup-value')).toHaveTextContent(/8/);
  });

  it('each choice is saved for the group and shown', async () => {
    wrap(<SaleSettingsForm />);
    await flush();
    await act(async () => {
      fireEvent.press(screen.getByTestId('zero-first-per-farm'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('numbering-per-point'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('dup-more'));
    });
    await flush();
    expect(saleSettings(await mockMaster.state())).toMatchObject({ zeroCheck: 'first-per-farm', numbering: 'per-point', dupWindowS: 9 });
    expect(screen.getByTestId('zero-first-per-farm').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('the duplicate window stops at 10 and the hold time at 1 s', async () => {
    wrap(<SaleSettingsForm />);
    await flush();
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.press(screen.getByTestId('dup-more'));
      });
      await act(async () => {
        fireEvent.press(screen.getByTestId('hold-more'));
      });
    }
    await flush();
    expect(saleSettings(await mockMaster.state()).dupWindowS).toBe(10);
    expect(screen.getByTestId('hold-value')).toHaveTextContent(/1.0/);
    expect(readHoldMs()).toBe(1000);
  });

  it('adds a net + basket pair in steps of 1 kg and makes it the default', async () => {
    wrap(<SaleSettingsForm />);
    await flush();
    fireEvent.press(screen.getByTestId('add-pair'));
    fireEvent.press(screen.getByTestId('new-net-more')); // 50 → 51
    fireEvent.press(screen.getByTestId('new-basket-more')); // 2 → 3
    await act(async () => {
      fireEvent.press(screen.getByTestId('save-pair'));
    });
    await flush();
    const added = saleSettings(await mockMaster.state()).pairs.find((p) => p.netG === 51_000);
    expect(added).toMatchObject({ basketG: 3_000 });
    await act(async () => {
      fireEvent.press(screen.getByTestId(`make-default-${added!.pairId}`));
    });
    await flush();
    expect(saleSettings(await mockMaster.state()).pairs.find((p) => p.isDefault)?.netG).toBe(51_000);
  });
});
