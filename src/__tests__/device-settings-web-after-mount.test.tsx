/**
 * E01-S19 DS-4, web side: the web build static-renders, so a stored language,
 * era or speech choice must NOT be read in the first render (the server HTML
 * has the defaults) — it arrives right after mount. jest.setup.js runs the
 * providers as native; this file switches them to web's `readDuringRender`.
 */
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { I18nProvider, useI18n } from '../i18n';
import { SpeechProvider, useSpeech } from '../speech';
import { ThemeProvider, useTheme } from '../theme';

jest.mock('../store/device-settings', () => ({
  deviceSettings: { ...jest.requireActual('../store/device-settings.web').deviceSettings, readDuringRender: false },
}));

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
  },
});

beforeEach(() => stored.clear());

it('renders the defaults first, then the stored language, era and speech after mount', async () => {
  stored.set('mon-farm:locale', 'en');
  stored.set('mon-farm:era', 'ce');
  stored.set('mon-farm:speech-on', 'false');
  const seen: string[] = [];
  function Probe() {
    const { locale, era } = useI18n();
    const { speechOn } = useSpeech();
    seen.push(`${locale}/${era}/${speechOn}`);
    return <Text>{locale}</Text>;
  }
  render(
    <I18nProvider>
      <SpeechProvider>
        <Probe />
      </SpeechProvider>
    </I18nProvider>,
  );
  expect(seen[0]).toBe('th/be/true');
  await waitFor(() => expect(seen[seen.length - 1]).toBe('en/ce/false'));
});

it('E03-S08: renders text size M first, then the stored L after mount', async () => {
  stored.set('mon-farm:text-size', 'l');
  const seen: number[] = [];
  function Probe() {
    const size = useTheme().font.size.body;
    seen.push(size);
    return <Text>{size}</Text>;
  }
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
  expect(seen[0]).toBe(16);
  await waitFor(() => expect(seen[seen.length - 1]).toBe(18));
});
