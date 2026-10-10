/**
 * /v2/device — เครื่องนี้ (farm mockup 1, the drawer's device group):
 * settings of THIS device only, never synced and never in the event log —
 * screen theme, the hold time to count a basket (D-79), the spoken count,
 * the date era (D-74 F14) and the language. Each is remembered on the device
 * by its own provider or preference store.
 */

import { useState } from 'react';
import { View } from 'react-native';

import type { ColorScheme } from '../../design/tokens';
import { validHoldMs } from '../core/master';
import type { Era } from '../core/thai-date';
import { useI18n, useT, type Locale } from '../i18n';
import { useSpeech } from '../speech';
import { readHoldMs, writeHoldMs } from '../store/hold-preference';
import { useThemeControls, useTheme } from '../theme';
import { AppText, Card, CardLabel, SegmentedControl } from '../ui';
import { FarmScreen, Stepper } from './farm/pieces';
import { V2_HOME } from './routes';

export function V2Device() {
  const t = useTheme();
  const msg = useT();
  const { scheme, setScheme } = useThemeControls();
  const { locale, setLocale, era, toggleEra } = useI18n();
  const { speechOn, setSpeechOn } = useSpeech();
  const [holdMs, setHoldMs] = useState(readHoldMs);

  const changeHold = (ms: number) => {
    if (!validHoldMs(ms)) return;
    writeHoldMs(ms);
    setHoldMs(ms);
  };
  const section = (label: string, control: React.ReactNode, note?: string) => (
    <Card>
      <CardLabel>{label}</CardLabel>
      <View style={{ gap: t.space.sm }}>
        {control}
        {note ? <AppText variant="bodySm">{note}</AppText> : null}
      </View>
    </Card>
  );

  return (
    <FarmScreen title={msg('v2.device')} subtitle={msg('menu.device')} fallback={V2_HOME} testID="device">
      {section(
        msg('settings.theme'),
        <SegmentedControl<ColorScheme>
          testID="device-theme"
          value={scheme}
          onChange={setScheme}
          options={[
            { value: 'light', label: msg('common.themeLight') },
            { value: 'dark', label: msg('common.themeDark') },
          ]}
        />,
        msg('settings.themeNote'),
      )}
      {section(
        msg('saleSettings.hold'),
        <Stepper
          testID="device-hold"
          label={msg('saleSettings.hold')}
          value={(holdMs / 1000).toFixed(1)}
          unit={msg('v2f.secondsUnit')}
          onLess={() => changeHold(holdMs - 100)}
          onMore={() => changeHold(holdMs + 100)}
        />,
      )}
      {section(
        msg('settings.speech'),
        <SegmentedControl<'on' | 'off'>
          testID="device-speech"
          value={speechOn ? 'on' : 'off'}
          onChange={(v) => setSpeechOn(v === 'on')}
          options={[
            { value: 'on', label: msg('common.speechOn') },
            { value: 'off', label: msg('common.speechOff') },
          ]}
        />,
        msg('settings.speechNote'),
      )}
      {section(
        msg('v2f.era'),
        <SegmentedControl<Era>
          testID="device-era"
          value={era}
          onChange={(e) => e !== era && toggleEra()}
          options={[
            { value: 'be', label: msg('date.eraBe') },
            { value: 'ce', label: msg('date.eraCe') },
          ]}
        />,
        msg('v2f.eraNote'),
      )}
      {section(
        msg('settings.language'),
        <SegmentedControl<Locale>
          testID="device-language"
          value={locale}
          onChange={setLocale}
          // Each language names itself, in itself.
          options={[
            { value: 'th', label: 'ไทย' },
            { value: 'en', label: 'English' },
          ]}
        />,
        msg('settings.languageNote'),
      )}
    </FarmScreen>
  );
}
