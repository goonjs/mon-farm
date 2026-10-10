/**
 * /v2/device — "เครื่องนี้" (farm mockup menu: device-only settings, not
 * synced). Only the theme choice is live so far, reusing the shared theme
 * state; the rest of the screen is still a placeholder.
 */

import { View } from 'react-native';

import { Placeholder } from './placeholder-screen';
import type { ColorScheme } from '../../design/tokens';
import { useT } from '../i18n';
import { useThemeControls, useTheme } from '../theme';
import { AppText, Card, SegmentedControl } from '../ui';

export function V2Device() {
  const t = useTheme();
  const msg = useT();
  const { scheme, setScheme } = useThemeControls();
  return (
    <Placeholder titleId="v2.device">
      <Card>
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label">{msg('settings.theme')}</AppText>
          <SegmentedControl<ColorScheme>
            testID="device-theme"
            value={scheme}
            onChange={setScheme}
            options={[
              { value: 'light', label: msg('common.themeLight') },
              { value: 'dark', label: msg('common.themeDark') },
            ]}
          />
          <AppText variant="bodySm">{msg('settings.themeNote')}</AppText>
        </View>
      </Card>
    </Placeholder>
  );
}
