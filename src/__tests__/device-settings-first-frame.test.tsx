/**
 * E01-S19 DS-4: on native a stored language / year system / speech choice is
 * there from the very first render — no frame of the default first. Jest runs
 * as native (jest-expo, ios); `jest.setup.js` backs `device-settings` with the
 * web adapter over a localStorage stub but keeps native's `readDuringRender`.
 */
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { I18nProvider, useI18n } from '../i18n';
import { SpeechProvider, useSpeech } from '../speech';

const stored = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
  },
});

beforeEach(() => stored.clear());

it('renders the stored language and era from the first frame', () => {
  stored.set('mon-farm:locale', 'en');
  stored.set('mon-farm:era', 'ce');
  const seen: string[] = [];
  function Probe() {
    const { locale, era } = useI18n();
    seen.push(`${locale}/${era}`);
    return <Text>{locale}</Text>;
  }
  render(
    <I18nProvider>
      <Probe />
    </I18nProvider>,
  );
  expect(seen[0]).toBe('en/ce');
});

it('renders the stored speech choice from the first frame', () => {
  stored.set('mon-farm:speech-on', 'false');
  const seen: boolean[] = [];
  function Probe() {
    const { speechOn } = useSpeech();
    seen.push(speechOn);
    return <Text>{String(speechOn)}</Text>;
  }
  render(
    <SpeechProvider>
      <Probe />
    </SpeechProvider>,
  );
  expect(seen[0]).toBe(false);
});

it('falls back to the defaults with nothing stored', () => {
  const seen: string[] = [];
  function Probe() {
    const { locale, era } = useI18n();
    seen.push(`${locale}/${era}`);
    return null;
  }
  render(
    <I18nProvider>
      <Probe />
    </I18nProvider>,
  );
  expect(seen[0]).toBe('th/be');
});
