/**
 * Picks a zone and pile to make current on the counter screen. Needed once a
 * sale has more than one pile — closing one has to lead somewhere the
 * operator explicitly chose, not wherever `.find()` happens to land next.
 */

import { ScrollView, Text, View } from 'react-native';

import { Button } from './chrome';
import type { PileId, PileStatus, SaleState } from '../core/types';
import { useT, type MessageId } from '../i18n';
import { useTheme } from '../theme';

export interface ZonePileSwitcherProps {
  state: SaleState;
  /**
   * Piles whose numbers were entered in bulk (S23) — derived from the log by
   * `bulkEnteredPileIds`, not from `state`, because the marker is a fact
   * about the log rather than a projected pile field.
   */
  bulkPileIds: ReadonlySet<PileId>;
  onPick: (pileId: string) => void;
  onClose: () => void;
}

/**
 * Status → message id, not status → Thai. Typed as `PileStatus` rather than
 * `string` so a status added to the model without a label here fails to
 * compile, instead of rendering an empty cell in the switcher.
 */
const STATUS_LABEL: Record<PileStatus, MessageId> = {
  'not-started': 'status.notStarted',
  counting: 'status.counting',
  closed: 'status.closed',
};

export function ZonePileSwitcher({ state, bulkPileIds, onPick, onClose }: ZonePileSwitcherProps) {
  const t = useTheme();
  const msg = useT();

  return (
    <View
      testID="zone-pile-switcher"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.color.stage,
        zIndex: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: t.space.sm,
          borderBottomWidth: t.border.hair,
          borderBottomColor: t.color.rule,
        }}
      >
        <Text style={{ flex: 1, fontFamily: t.font.family.mono, fontSize: t.font.size.micro, letterSpacing: t.font.tracking.wide, color: t.color.inkSoft }}>
          {msg('switcher.title')}
        </Text>
        <Button testID="switcher-close" onPress={onClose}>
          ✕
        </Button>
      </View>

      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        {state.zones.map((zone) => (
          <View key={zone.id}>
            <Text style={{ fontFamily: t.font.family.sans, fontWeight: t.font.weight.bold, fontSize: t.font.size.small, color: t.color.ink, marginBottom: t.space.xs }}>
              {msg('switcher.zoneRow', {
                name: zone.name,
                status: msg(zone.status === 'closed' ? 'status.closed' : 'status.open'),
              })}
            </Text>
            <View style={{ gap: t.space.xs }}>
              {state.piles
                .filter((p) => p.zoneId === zone.id)
                .map((pile) => (
                  <Button key={pile.id} testID={`switcher-pile-${pile.id}`} onPress={() => onPick(pile.id)}>
                    {msg('switcher.pileRow', {
                      name: pile.name,
                      // One entry with a placeholder rather than two strings
                      // joined here — a closed pile and a bulk-entered one
                      // must not read the same, and the catalogue is where
                      // that sentence is allowed to be assembled.
                      status: bulkPileIds.has(pile.id)
                        ? msg('pile.bulkStatus', { status: msg(STATUS_LABEL[pile.status]) })
                        : msg(STATUS_LABEL[pile.status]),
                    })}
                  </Button>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
