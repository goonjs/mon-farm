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

import { Button, TopBar } from '../components/chrome';
import { useI18n, useT, type Locale } from '../i18n';
import { useSpeech } from '../speech';
import type { TextSize } from '../core/text-scale';
import { useTheme, useThemeControls } from '../theme';
import type { ColorScheme } from '../../design/tokens';

const LIST: Href = '/';

type OnOff = 'on' | 'off';

export default function SettingsScreen() {
  const t = useTheme();
  const msg = useT();
  const { locale, setLocale } = useI18n();
  const { scheme, setScheme, textSize, setTextSize } = useThemeControls();
  const { speechOn, setSpeechOn } = useSpeech();

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={msg('settings.title')}
        right={
          <Link href={LIST} asChild>
            <Button testID="settings-back">{msg('settings.back')}</Button>
          </Link>
        }
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

        {/* E03-S08: device text size; the public counting numeral does not follow it. */}
        <Choice<TextSize>
          testID="text-size"
          label={msg('settings.textSize')}
          note={msg('settings.textSizeNote')}
          value={textSize}
          onChange={setTextSize}
          options={[
            { value: 's', label: 'S' },
            { value: 'm', label: 'M' },
            { value: 'l', label: 'L' },
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

        <Link href="/finance/expenses" asChild>
          <Button testID="settings-open-expenses">{msg('fin.open')}</Button>
        </Link>

        <Link href="/finance/debts" asChild>
          <Button testID="settings-open-debts">{msg('debt.open')}</Button>
        </Link>

        <Link href="/finance/accounts" asChild>
          <Button testID="settings-open-accounts">{msg('acct.open')}</Button>
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
      <Text
        style={{
          fontFamily: t.font.family.mono,
          fontSize: t.font.size.micro,
          letterSpacing: t.font.tracking.wide,
          color: t.color.inkSoft,
        }}
      >
        {label}
      </Text>

      <View style={{ flexDirection: 'row', gap: t.space.xs }}>
        {options.map((o) => (
          <Button
            key={o.value}
            testID={`${testID}-${o.value}`}
            variant={o.value === value ? 'primary' : 'ghost'}
            onPress={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </View>

      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkFaint }}>
        {note}
      </Text>
    </View>
  );
}
