/**
 * Device settings. Language and theme — nothing about a sale.
 *
 * ── Why this screen exists at all ───────────────────────────────────────────
 *
 * The language switch needed a home, and none of the working screens is one.
 * The counter, setup and settlement are used with a scale in front of you and
 * someone waiting; every control on them competes for space with the count
 * (docs/ux/design-system.md §4), and a language switch is something a person
 * touches roughly once ever. Putting it on the same bar as `ปิดกอง` would be
 * the definition of a control in the wrong register.
 *
 * So it lives here, reached from the sale list — the app's front door, and the
 * one screen nobody is standing at a scale to use.
 *
 * Everything on this screen is a preference of the DEVICE. Nothing here is
 * recorded in the event log, because none of it is a fact about a sale: what
 * language somebody read a number in, or whether their screen was dark, is not
 * something two parties settle against.
 */

import { Link, type Href } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '../components/chrome';
import { FieldLabel, SegmentedControl } from '../components/ui/form';
import { ScreenHeader } from '../components/ui/screen-header';
import { useSyncStatus } from '../sync/use-sync-status';
import { useI18n, useT, type Locale } from '../i18n';
import { useSpeech } from '../speech';
import { useTheme, useThemeControls } from '../theme';
import type { ColorScheme } from '../../design/tokens';

const LIST: Href = '/';

type OnOff = 'on' | 'off';

export default function SettingsScreen() {
  const t = useTheme();
  const msg = useT();
  const { locale, setLocale } = useI18n();
  const { scheme, setScheme } = useThemeControls();
  const { speechOn, setSpeechOn } = useSpeech();
  const sync = useSyncStatus();

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        title={msg('settings.title')}
        back={{ label: msg('settings.back'), testID: 'settings-back', href: LIST }}
        sync={sync}
      />

      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.lg }}>
        <Choice<Locale>
          testID="language"
          label={msg('settings.language')}
          note={msg('settings.languageNote')}
          value={locale}
          onChange={setLocale}
          options={[
            // Each language names itself, in itself. A person looking for
            // Thai is looking for "ไทย", not for whatever the current locale
            // calls Thai — which is the one label on this screen that must
            // stay legible to someone who cannot read the current setting.
            { value: 'th', label: 'ไทย' },
            { value: 'en', label: 'English' },
          ]}
        />

        <Choice<ColorScheme>
          testID="theme"
          label={msg('settings.theme')}
          note={msg('settings.themeNote')}
          value={scheme}
          onChange={setScheme}
          options={[
            { value: 'light', label: msg('common.themeLight') },
            { value: 'dark', label: msg('common.themeDark') },
          ]}
        />

        <Choice<OnOff>
          testID="speech"
          label={msg('settings.speech')}
          note={msg('settings.speechNote')}
          value={speechOn ? 'on' : 'off'}
          onChange={(v) => setSpeechOn(v === 'on')}
          options={[
            { value: 'on', label: msg('common.speechOn') },
            { value: 'off', label: msg('common.speechOff') },
          ]}
        />

        <Link href="/farm-profile" asChild>
          <Button testID="open-farm-profile">{msg('settings.farmProfile')}</Button>
        </Link>
      </ScrollView>
    </View>
  );
}

function Choice<T extends string>({
  testID,
  label,
  note,
  value,
  onChange,
  options,
}: {
  testID: string;
  label: string;
  note: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  const t = useTheme();

  return (
    <View style={{ gap: t.space.xs }}>
      <FieldLabel>{label}</FieldLabel>

      <SegmentedControl testID={testID} value={value} onChange={onChange} options={options} />

      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkFaint }}>
        {note}
      </Text>
    </View>
  );
}
