import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import SettingsScreen from '../app/settings';
import { I18nProvider } from '../i18n';
import { SpeechProvider } from '../speech';
import { ThemeProvider, tokens, useTheme } from '../theme';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  // Settings shows the sync pill (E01-S17), which refreshes on focus.
  useFocusEffect: () => undefined,
}));

beforeAll(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => m.set(k, v),
    removeItem: (k: string) => m.delete(k),
  };
});

function Probe() {
  const t = useTheme();
  return (
    <Text testID="probe">
      {t.font.size.body}|{t.publicNumeral.stageHeightRatio}
    </Text>
  );
}

function app() {
  return (
    <ThemeProvider>
      <I18nProvider initial="th">
        <SpeechProvider initial>
          <SettingsScreen />
          <Probe />
        </SpeechProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

describe('text size S / M / L — E03-S08', () => {
  it('M by default; L scales text to 18, leaves the public numeral alone, and survives a remount', async () => {
    const first = render(app());
    await act(async () => {});
    expect(screen.getByTestId('probe')).toHaveTextContent(`16|${tokens.publicNumeral.stageHeightRatio}`);
    await act(async () => {
      fireEvent.press(screen.getByTestId('text-size-l'));
    });
    expect(screen.getByTestId('probe')).toHaveTextContent(`18|${tokens.publicNumeral.stageHeightRatio}`);
    first.unmount();

    render(app());
    await act(async () => {});
    expect(screen.getByTestId('probe')).toHaveTextContent(/^18\|/);
  });
});
