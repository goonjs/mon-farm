/**
 * /v2/sale/<id>/public?point= — โหมดสาธารณะ (sale mockup v1.1.0 page 9,
 * E04-S07): the current basket number as big as the screen allows, for the
 * buyer to read at a distance. The whole stage is the hold area; a thin bar
 * names the point and tapper with the sync state, and the foot goes back to
 * the recorder.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { tapperOn } from '../../core/master';
import { recorderFigures } from '../../core/sale-points';
import { useT } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { ExpandIcon, SyncPill } from '../../ui';
import { HoldStage } from './hold';
import { useSaleView } from './pieces';

export function PublicScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const sync = useSyncStatus();
  const { point: pointId = '' } = useLocalSearchParams<{ point?: string }>();
  const view = useSaleView();
  const { saleId, events, state, master, day, mode, append, nameOf } = view;
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/v2/sale/${saleId}/counter?point=${pointId}` as Href));
  const point = master?.points.find((p) => p.id === pointId);
  const farm = master?.properties.find((f) => f.id === point?.propertyId);
  const pile = state.piles.find((p) => p.id === pointId);
  if (!view.ready || !master || !point || !farm || !pile) return <View style={{ flex: 1, backgroundColor: t.color.stage }} />;

  const tapper = tapperOn(master, pointId, day);
  const figs = recorderFigures(events, master, day, pointId, mode, null);
  const count = (input: 'hold' | 'hold-kbd') => append({ kind: 'accept', pileId: pointId, pointId, basketNo: figs.currentNo, input, netG: pile.stdNetG, tareG: pile.tareG });

  return (
    <View testID="public" style={{ flex: 1, backgroundColor: t.color.stage }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: t.color.action, paddingHorizontal: t.space.lg, paddingVertical: t.space.sm, minHeight: t.layout.topBarHeight }}>
        <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.inkInverse }}>
          {[farm.name, point.name, tapper ? nameOf(tapper) : msg('rec.noTapper')].join(' · ')}
        </Text>
        {sync ? <SyncPill status={sync} /> : null}
      </View>
      <HoldStage fill testID="public-hold" label={msg('rec.hold')} onHold={count} onEarly={(heldMs) => append({ kind: 'reject', pileId: pointId, input: 'hold', reason: 'released-early', heldMs })}>
        <Text
          testID="public-no"
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{ fontFamily: t.font.family.sans, fontSize: 240, lineHeight: 260, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.numeral, textAlign: 'center' }}
        >
          {figs.currentNo}
        </Text>
      </HoldStage>
      <Pressable testID="public-exit" accessibilityRole="button" onPress={back} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.sm, backgroundColor: t.color.surfaceSunk }}>
        <ExpandIcon color={t.color.action} size={16} />
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.action }}>{msg('v2s.tapToExit')}</Text>
      </Pressable>
    </View>
  );
}
