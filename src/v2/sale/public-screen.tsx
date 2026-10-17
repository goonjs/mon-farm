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
import { useT } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { ExpandIcon, SyncPill } from '../../ui';
import { countModel } from './count';
import { countKey, HoldStage } from './hold';
import { useLeaveIfClosed, useSaleView } from './pieces';

export function PublicScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const sync = useSyncStatus();
  const { point: pointId = '', fill } = useLocalSearchParams<{ point?: string; fill?: string }>();
  const view = useSaleView();
  useLeaveIfClosed(view);
  const { saleId, master, day, nameOf } = view;
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/v2/sale/${saleId}/counter?point=${pointId}` as Href));
  const point = master?.points.find((p) => p.id === pointId);
  const farm = master?.properties.find((f) => f.id === point?.propertyId);
  // The recorder's own count: a top-up at the next point, nothing while the short basket waits (review #1).
  const model = countModel(view, pointId, fill);
  if (!view.ready || !master || !point || !farm || !model || view.closed) return <View style={{ flex: 1, backgroundColor: t.color.stage }} />;

  const tapper = tapperOn(master, pointId, day);
  const { figs, open, filling, ready } = model;
  const number = (
    <Text
      testID="public-no"
      adjustsFontSizeToFit
      numberOfLines={1}
      style={{ fontFamily: t.font.family.sans, fontSize: 240, lineHeight: 260, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.numeral, textAlign: 'center' }}
    >
      {figs.currentNo}
    </Text>
  );

  return (
    <View testID="public" style={{ flex: 1, backgroundColor: t.color.stage }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: t.color.action, paddingHorizontal: t.space.lg, paddingVertical: t.space.sm, minHeight: t.layout.topBarHeight }}>
        <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.inkInverse }}>
          {[farm.name, point.name, tapper ? nameOf(tapper) : msg('rec.noTapper')].join(' · ')}
        </Text>
        {sync ? <SyncPill status={sync} /> : null}
      </View>
      {!ready ? (
        <View testID="public-wait" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space.md }}>
          {number}
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {msg('v2s.notReady')}
          </Text>
        </View>
      ) : (
        <HoldStage fill testID="public-hold" label={filling && open ? msg('v2s.fillStage', { n: open.basketNo }) : msg(countKey(), { n: figs.currentNo })} onHold={model.count} onEarly={model.early}>
          {number}
        </HoldStage>
      )}
      <Pressable testID="public-exit" accessibilityRole="button" onPress={back} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.sm, backgroundColor: t.color.surfaceSunk }}>
        <ExpandIcon color={t.color.action} size={16} />
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.action }}>{msg('v2s.tapToExit')}</Text>
      </Pressable>
    </View>
  );
}
