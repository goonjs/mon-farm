/**
 * E03-S10: the "ไอคอนบนแท็บเบราว์เซอร์" card on เครื่องนี้, and the start-up
 * hook that puts the remembered icon back. Web only — Android / iOS have no
 * browser tab, so on native the card renders nothing and start-up does
 * nothing (FV-5).
 *
 * On the web the choice is read after mount, never during render: the web
 * build is static-rendered (see `deviceSettings.readDuringRender`).
 */

import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';

import { useT } from '../../i18n';
import { deviceSettings } from '../../store/device-settings';
import { useTheme } from '../../theme';
import { AppText } from '../type';
import { Card, CardLabel } from '../card';
import { FarmMateIcon } from '../farmmate-icons';
import { getFarmMateIcon } from '../farmmate-icons/registry';
import { applyFavicon } from './apply';
import { FAVICON_CHOICES, FAVICON_DEFAULT } from './choices';
import { readFavicon, writeFavicon } from './preference';

const SHIPPED_FAVICON = require('../../../assets/images/favicon.png');

const isWeb = () => Platform.OS === 'web';

/** Mount once near the root: re-applies this device's tab icon on start (FV-3). */
export function FaviconOnStart() {
  useEffect(() => {
    if (!isWeb()) return;
    const id = readFavicon();
    if (id !== FAVICON_DEFAULT) void applyFavicon(id);
  }, []);
  return null;
}

/** The card on เครื่องนี้; nothing at all on Android / iOS (FV-5). */
export function FaviconCard() {
  return isWeb() ? <FaviconPicker /> : null;
}

function FaviconPicker() {
  const t = useTheme();
  const msg = useT();
  const [chosen, setChosen] = useState(() => (deviceSettings.readDuringRender ? readFavicon() : FAVICON_DEFAULT));
  useEffect(() => {
    if (deviceSettings.readDuringRender) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setChosen(readFavicon());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = (id: string) => {
    writeFavicon(id);
    setChosen(id);
    void applyFavicon(id);
  };
  const box = t.target.comfortable;
  const glyph = Math.round(box * 0.6);

  const option = (id: string, label: string, art: React.ReactNode) => {
    const on = id === chosen;
    return (
      <Pressable
        key={id}
        testID={`device-favicon-${id}`}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: on }}
        aria-checked={on}
        onPress={() => choose(id)}
        style={{
          width: box,
          height: box,
          borderRadius: t.radius.md,
          borderWidth: on ? t.border.thick * 2 : t.border.hair,
          borderColor: on ? t.color.action : t.color.rule,
          backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {art}
      </Pressable>
    );
  };

  return (
    <Card testID="device-favicon">
      <CardLabel>{msg('settings.favicon')}</CardLabel>
      <View style={{ gap: t.space.sm }}>
        <View accessibilityRole="radiogroup" accessibilityLabel={msg('settings.favicon')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
          {option(
            FAVICON_DEFAULT,
            msg('settings.faviconDefault'),
            <Image source={SHIPPED_FAVICON} style={{ width: glyph, height: glyph }} accessibilityIgnoresInvertColors />,
          )}
          {FAVICON_CHOICES.map((id) => option(id, getFarmMateIcon(id)?.labelTh ?? id, <FarmMateIcon id={id} size={glyph} />))}
        </View>
        <AppText variant="bodySm">{msg('settings.faviconNote')}</AppText>
      </View>
    </Card>
  );
}
