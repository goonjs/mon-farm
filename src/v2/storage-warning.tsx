/**
 * E01-S03, on the v2 design system: shown on every screen when the event
 * store cannot keep anything — a browser without IndexedDB, or storage that
 * failed after it opened. The app keeps working; this only makes sure nobody
 * believes a record is safe when a reload will erase it. Warn ground and a
 * worded message, never colour alone.
 */

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '../i18n';
import { durabilityLost, onDurabilityLost } from '../store/durability';
import { store } from '../store/store';
import { useTheme } from '../theme';
import { AppText } from '../ui';

export function StorageWarning() {
  const t = useTheme();
  const msg = useT();
  const [durable, setDurable] = useState(() => !durabilityLost());

  useEffect(() => {
    let live = true;
    store
      .isDurable()
      .then((d) => live && !d && setDurable(false))
      // Not knowing is not the same as safe.
      .catch(() => live && setDurable(false));
    const stop = onDurabilityLost(() => live && setDurable(false));
    return () => {
      live = false;
      stop();
    };
  }, []);

  if (durable) return null;
  return (
    <View
      testID="storage-warning"
      accessibilityRole="alert"
      style={{
        backgroundColor: t.color.warnSunk,
        borderBottomWidth: t.border.hair,
        borderBottomColor: t.color.warn,
        paddingHorizontal: t.layout.screenPaddingX,
        paddingVertical: t.space.sm,
      }}
    >
      <AppText variant="body" style={{ color: t.color.warn, fontWeight: t.font.weight.semibold }}>
        {msg('storage.notDurable')}
      </AppText>
    </View>
  );
}
