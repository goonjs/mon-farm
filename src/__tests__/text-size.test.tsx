/**
 * E03-S08 ขนาดตัวอักษร S / M / L. The theme's font sizes follow the stored
 * device choice (TS-2, TS-3); the public counting numeral does not (TS-4);
 * the setting lives on "เครื่องนี้" (TS-1).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { tokens } from '../../design/tokens';
import { ThemeProvider, useTheme, useThemeControls } from '../theme';
import { readTextSize } from '../theme/text-size-preference';
import { SpeechProvider } from '../speech';
import { V2Device } from '../v2/device-screen';
import { SplashScreen } from '../v2/splash-screen';
import { I18nProvider } from '../i18n';
import { wrap } from '../test/render';

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
beforeEach(() => stored.clear());

function Probe() {
  const t = useTheme();
  const { textSize } = useThemeControls();
  return (
    <Text testID="probe">
      {textSize}/{t.font.size.body}/{t.font.size.figure}/{t.textScale}/
    </Text>
  );
}
const probe = () => String((screen.getByTestId('probe').props.children as unknown[]).join(''));

describe('theme font sizes follow the text size', () => {
  it('defaults to M: every size is the token value', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toMatch(/^m\/16\/44\/1\//);
  });

  it('M is the token set exactly — every font token, no multiplier (owner 2026-11-02: no pixel change at the default)', () => {
    const seen: unknown[] = [];
    function Fonts() {
      const t = useTheme();
      seen.push({ font: t.font, textScale: t.textScale });
      return null;
    }
    render(
      <ThemeProvider>
        <Fonts />
      </ThemeProvider>,
    );
    expect(seen[0]).toEqual({ font: tokens.font, textScale: 1 });
  });

  it('reads a stored L from the first frame (native) and scales every size by 1.125', () => {
    stored.set('mon-farm:text-size', 'l');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toMatch(/^l\/18\/50\/1\.125\//);
  });

  it('S scales down by 0.875; an unknown stored value reads as M', () => {
    stored.set('mon-farm:text-size', 's');
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toMatch(/^s\/14\/39\/0\.875\//);
    unmount();
    stored.set('mon-farm:text-size', 'xl');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(probe()).toMatch(/^m\/16\//);
  });

  it('the public counting numeral is not a font size: it is the same at every text size', () => {
    const seen: string[] = [];
    function Numeral() {
      seen.push(JSON.stringify(useTheme().publicNumeral));
      return null;
    }
    for (const size of ['s', 'm', 'l']) {
      stored.set('mon-farm:text-size', size);
      const { unmount } = render(
        <ThemeProvider>
          <Numeral />
        </ThemeProvider>,
      );
      unmount();
    }
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBe(JSON.stringify(tokens.publicNumeral));
  });
});

describe('เครื่องนี้ → ขนาดตัวอักษร', () => {
  it('starts on กลาง, changes the whole app at once and is remembered on the device', async () => {
    wrap(
      <SpeechProvider initial>
        <V2Device />
        <Probe />
      </SpeechProvider>,
    );
    expect(screen.getByText('ขนาดตัวอักษร')).toBeTruthy();
    expect(screen.getByText('เฉพาะเครื่องนี้ · ตัวเลขนับบนจอสาธารณะไม่เปลี่ยน')).toBeTruthy();
    expect(screen.getByTestId('device-text-size-m').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('device-text-size-s')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('device-text-size-l')));
    expect(screen.getByTestId('device-text-size-l').props.accessibilityState).toMatchObject({ checked: true });
    expect(readTextSize()).toBe('l');
    expect(probe()).toMatch(/^l\/18\//);
    expect(stored.get('mon-farm:text-size')).toBe('l');
  });
});

describe('the splash name follows the text size (2026-11-07: it was a fixed 38 the guard did not see)', () => {
  const nameSize = () => {
    const name = screen.getByText('FarmMate');
    const style = Object.assign({}, ...[name.props.style].flat(3).filter(Boolean)) as { fontSize: number; lineHeight: number };
    return `${style.fontSize}/${style.lineHeight}`;
  };
  it('M keeps the drawn 38 (line 42); L is 38 × 1.125 (line 47)', () => {
    const { unmount } = render(
      <ThemeProvider>
        <I18nProvider>
          <SplashScreen />
        </I18nProvider>
      </ThemeProvider>,
    );
    expect(nameSize()).toBe('38/42');
    unmount();
    stored.set('mon-farm:text-size', 'l');
    render(
      <ThemeProvider>
        <I18nProvider>
          <SplashScreen />
        </I18nProvider>
      </ThemeProvider>,
    );
    expect(nameSize()).toBe('43/47');
  });
});
