/**
 * E03-S10 เลือกไอคอนบนแท็บเบราว์เซอร์. The card on "เครื่องนี้" (FV-1) writes
 * the device setting and changes the tab icon at once (FV-2, FV-3); the app
 * puts the stored choice back on start (FV-3); none of it exists on Android /
 * iOS (FV-5). The DOM side is `src/ui/favicon/apply.web.test.tsx`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { SpeechProvider } from '../speech';
import { wrap } from '../test/render';
import { applyFavicon } from '../ui/favicon/apply';
import { FAVICON_CHOICES } from '../ui/favicon/choices';
import { FaviconCard, FaviconOnStart } from '../ui/favicon/FaviconCard';
import { V2Device } from '../v2/device-screen';

jest.mock('../ui/favicon/apply', () => ({ applyFavicon: jest.fn(async () => undefined) }));

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    Link: ({ children }: { children: ReactNode }) => children,
    useFocusEffect: () => undefined,
    useLocalSearchParams: () => ({}),
    useRouter: () => router,
    router,
  };
});

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
  },
});

const realOS = Platform.OS;
const onWeb = () => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
beforeEach(() => {
  stored.clear();
  jest.mocked(applyFavicon).mockClear();
});
afterEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => realOS }));

describe('on the web', () => {
  beforeEach(onWeb);

  it('shows เดิม + 20 icons, เดิม chosen, each named in Thai (FV-1)', async () => {
    wrap(<FaviconCard />);
    expect(await screen.findByText('ไอคอนบนแท็บเบราว์เซอร์')).toBeTruthy();
    const def = screen.getByTestId('device-favicon-default');
    expect(def.props.accessibilityState).toMatchObject({ checked: true });
    expect(def.props.accessibilityLabel).toBe('เดิม');
    for (const id of FAVICON_CHOICES) expect(screen.getByTestId(`device-favicon-${id}`)).toBeTruthy();
    expect(screen.getByTestId('device-favicon-sale.weigh').props.accessibilityLabel).toBe('ชั่งน้ำหนัก');
    expect(screen.getByLabelText('ไอคอนบนแท็บเบราว์เซอร์').props.accessibilityRole).toBe('radiogroup');
    expect(applyFavicon).not.toHaveBeenCalled();
  });

  it('a tap changes the tab icon at once and remembers it on the device (FV-2, FV-3)', async () => {
    wrap(<FaviconCard />);
    await act(async () => fireEvent.press(await screen.findByTestId('device-favicon-sale.weigh')));
    expect(applyFavicon).toHaveBeenLastCalledWith('sale.weigh');
    expect(stored.get('mon-farm:favicon')).toBe('sale.weigh');
    expect(screen.getByTestId('device-favicon-sale.weigh').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('device-favicon-default').props.accessibilityState).toMatchObject({ checked: false });

    await act(async () => fireEvent.press(screen.getByTestId('device-favicon-default')));
    expect(applyFavicon).toHaveBeenLastCalledWith('default');
    expect(stored.get('mon-farm:favicon')).toBe('default');
  });

  it('shows the stored choice when the screen opens', async () => {
    stored.set('mon-farm:favicon', 'nav.home');
    wrap(<FaviconCard />);
    expect((await screen.findByTestId('device-favicon-nav.home')).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('puts the stored icon back when the app starts (FV-3)', async () => {
    stored.set('mon-farm:favicon', 'nav.home');
    render(
      <View>
        <FaviconOnStart />
      </View>,
    );
    expect(applyFavicon).toHaveBeenCalledWith('nav.home');
  });

  it('touches nothing on start when nothing was chosen (FV-4)', async () => {
    render(
      <View>
        <FaviconOnStart />
      </View>,
    );
    expect(applyFavicon).not.toHaveBeenCalled();
  });

  it('sits on the เครื่องนี้ screen', async () => {
    wrap(
      <SpeechProvider initial>
        <V2Device />
      </SpeechProvider>,
    );
    expect(await screen.findByText('ไอคอนบนแท็บเบราว์เซอร์')).toBeTruthy();
  });
});

describe('on Android / iOS (FV-5)', () => {
  it('has no favicon card on เครื่องนี้ and does nothing on start', async () => {
    stored.set('mon-farm:favicon', 'nav.home');
    wrap(
      <SpeechProvider initial>
        <V2Device />
      </SpeechProvider>,
    );
    expect(screen.queryByText('ไอคอนบนแท็บเบราว์เซอร์')).toBeNull();
    expect(screen.queryByTestId('device-favicon-default')).toBeNull();
    render(
      <View>
        <FaviconOnStart />
      </View>,
    );
    expect(applyFavicon).not.toHaveBeenCalled();
  });
});
