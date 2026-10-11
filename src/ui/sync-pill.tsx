/**
 * SyncPill — the overall sync state at the right of every screen header
 * (v1.1.0 mockups: "ซิงก์แล้ว" / "รอส่ง N" / "ขัดกัน N").
 *
 * Always shape + word + colour (NFR-4, §7): synced = full disc, pending = half
 * disc, conflict = diamond. Shapes are drawn with Views — no icon font, no
 * new dependency. Colours are the story's sync-badge recipe:
 * `{accept,warn,reject}Sunk` ground with `status*` ink.
 */

import { Text, View } from 'react-native';

import { useT } from '../i18n';
import { syncWordId, type SyncState, type SyncStatus } from '../sync/status';
import { useTheme, type Theme } from '../theme';

const SHAPE = 10;

function tone(t: Theme, state: SyncState) {
  return {
    synced: { bg: t.color.acceptSunk, fg: t.color.statusSynced },
    pending: { bg: t.color.warnSunk, fg: t.color.statusPending },
    error: { bg: t.color.rejectSunk, fg: t.color.statusConflict },
    conflict: { bg: t.color.rejectSunk, fg: t.color.statusConflict },
  }[state];
}

function Shape({ state, color }: { state: SyncState; color: string }) {
  const testID = `sync-shape-${state}`;
  if (state === 'conflict' || state === 'error') {
    return (
      <View
        testID={testID}
        aria-hidden
        style={{ width: SHAPE - 2, height: SHAPE - 2, backgroundColor: color, transform: [{ rotate: '45deg' }] }}
      />
    );
  }
  return (
    <View
      testID={testID}
      aria-hidden
      style={{
        width: SHAPE,
        height: SHAPE,
        borderRadius: SHAPE / 2,
        borderWidth: 1.5,
        borderColor: color,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      <View style={{ flex: 1, backgroundColor: color }} />
      <View style={{ flex: 1, backgroundColor: state === 'synced' ? color : 'transparent' }} />
    </View>
  );
}

export function SyncPill({ status }: { status: SyncStatus }) {
  const t = useTheme();
  const msg = useT();
  const { bg, fg } = tone(t, status.state);
  const word = msg(syncWordId(status.state), { n: status.count });

  return (
    <View
      testID="sync-pill"
      accessible
      accessibilityRole="text"
      accessibilityLabel={msg('sync.label', { status: word })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.xs,
        backgroundColor: bg,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.space.md,
        paddingVertical: t.space.xs,
      }}
    >
      <Shape state={status.state} color={fg} />
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.caption,
          fontWeight: t.font.weight.bold,
          color: fg,
        }}
      >
        {word}
      </Text>
    </View>
  );
}
