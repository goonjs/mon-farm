import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useT } from '../i18n';
import { durabilityLost, onDurabilityLost } from '../store/durability';
import { store } from '../store/store';
import { useTheme } from '../theme';

/**
 * E01-S03: shown on every screen when the event store cannot keep anything —
 * a browser without IndexedDB, or storage that failed after it opened. Counting still works — this only makes sure
 * nobody believes a sale is safe when a reload will erase it. Amber and a
 * worded message, never colour alone (design-system rules).
 */
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
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.sm,
      }}
    >
      <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.body, color: t.color.warn }}>
        {msg('storage.notDurable')}
      </Text>
    </View>
  );
}
