/**
 * การดูแลสวน (E16-S01): the garden care done, newest first. One kind for now, fertilizing; mowing and
 * spraying join later on the same list. Each row is the tap target with › (rule 11); the main button
 * records a fertilizing directly (one kind: nothing to pick). Deleted ones sit apart and can be restored.
 * Read-only from the local log except the restore.
 */

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { projectFertilizing, splitBadge, type Fertilizing } from '../../core/finance/fertilizing';
import { projectFinance } from '../../core/finance/ledger';
import { formatDate } from '../../core/finance/money';
import type { FinanceEvent, FinancePayload } from '../../core/finance/types';
import type { EventId } from '../../core/types';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { useSyncStatus } from '../../sync/use-sync-status';
import { useTheme } from '../../theme';
import { AppText, ChevronRight, CTA, FarmMateArt, PinnedActions, Plus, ScreenHeader, TextLink } from '../../ui';
import { FERTILIZING_NEW, fertilizingHref } from './fertilizing/routes';

export function CareListScreen() {
  const fin = useFinance();
  const sync = useSyncStatus();
  const msg = useT();
  const t = useTheme();
  if (!fin.events) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface }}>
        <ScreenHeader title={msg('care.title')} back={{ label: msg('v2.back'), onPress: leave, testID: 'care-back' }} sync={sync} />
        <AppText variant="bodySm" style={{ padding: t.space.lg }}>{msg('fz.loading')}</AppText>
      </View>
    );
  }
  return <CareListView events={fin.events} write={fin.write} sync={sync} onOpen={(id) => router.push(fertilizingHref(id))} onNew={() => router.push(FERTILIZING_NEW)} onBack={leave} />;
}

export function CareListView({
  events,
  write,
  sync,
  onOpen,
  onNew,
  onBack,
}: {
  events: readonly FinanceEvent[];
  write: (targetId: string, base: EventId | null, payload: FinancePayload) => Promise<unknown>;
  sync?: ReturnType<typeof useSyncStatus>;
  onOpen: (id: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const inFlight = useInFlight();
  const records = useMemo(() => projectFertilizing(events, projectFinance(events).expenses).records, [events]);
  const live = records.filter((r) => !r.deleted);
  const gone = records.filter((r) => r.deleted);
  const restore = (r: Fertilizing) =>
    inFlight.run(async () => {
      try {
        await write(r.id, r.headEventId, { t: 'fertilizing_changed', patch: { deleted: false } });
      } catch (err) {
        console.error('Fertilizing could not be restored.', err);
      }
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('care.title')} back={{ label: msg('v2.back'), onPress: onBack, testID: 'care-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        {live.length === 0 ? (
          <View testID="care-empty" style={{ alignItems: 'center', gap: t.space.sm, padding: t.space.xl, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised }}>
            <FarmMateArt id="farmwork.maintenance" size={56} />
            <AppText variant="heading" style={{ textAlign: 'center' }}>{msg('care.empty.title')}</AppText>
            <AppText variant="bodySm" style={{ textAlign: 'center' }}>{msg('care.empty.body')}</AppText>
          </View>
        ) : null}
        {live.map((r) => (
          <Row key={r.id} r={r} onPress={() => onOpen(r.id)} />
        ))}
        {gone.length ? (
          <View testID="care-deleted" style={{ gap: t.space.sm }}>
            <AppText variant="label">{msg('care.deleted', { n: gone.length })}</AppText>
            {gone.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space.md, padding: t.space.md, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceSunk }}>
                <AppText style={{ flex: 1, minWidth: 0 }}>{`${formatDate(r.date)} · ${summary(r, msg('fz.unit'))}`}</AppText>
                <TextLink testID={`care-restore-${r.id}`} onPress={() => void restore(r)}>{msg('care.restore')}</TextLink>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <PinnedActions>
        <CTA testID="care-new" icon={(c) => <Plus color={c} />} onPress={onNew}>{msg('care.new')}</CTA>
      </PinnedActions>
    </View>
  );
}

/** "ดีเกลือ 10 · 46-0-0 5 ถุง": what and how much, short. */
const summary = (r: Fertilizing, unit: string) => `${r.lines.map((l) => `${l.label} ${l.sacks}`).join(' · ')} ${unit}`;

function Row({ r, onPress }: { r: Fertilizing; onPress: () => void }) {
  const t = useTheme();
  const msg = useT();
  const badge = splitBadge(r);
  return (
    <Pressable
      testID={`care-row-${r.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, padding: t.space.md, minHeight: t.target.comfortable, borderRadius: t.radius.xl, backgroundColor: t.color.surfaceRaised, borderWidth: t.border.hair, borderColor: t.color.rule }}
    >
      <View style={{ width: 52, height: 52, borderRadius: t.radius.lg, backgroundColor: t.color.surfaceSunk, alignItems: 'center', justifyContent: 'center' }}>
        <FarmMateArt id="farmwork.fertilize" size={40} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="bodySm">{`${formatDate(r.date).split(' ').slice(0, 2).join(' ')} · ${msg('fz.title')}`}</AppText>
        <AppText style={{ fontWeight: t.font.weight.bold }}>{summary(r, msg('fz.unit'))}</AppText>
        {r.zones.length ? <AppText variant="bodySm">{r.zones.map((z) => z.zoneName).join(' · ')}</AppText> : null}
        {r.over > 0 ? (
          <View testID={`care-row-${r.id}-over`} style={{ alignSelf: 'flex-start', paddingHorizontal: t.space.sm, borderRadius: t.radius.pill, backgroundColor: t.color.warnSunk }}>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('fz.over', { n: r.over })}</Text>
          </View>
        ) : null}
        {badge ? (
          <View testID={`care-row-${r.id}-badge`} style={{ alignSelf: 'flex-start', paddingHorizontal: t.space.sm, borderRadius: t.radius.pill, backgroundColor: t.color.warnSunk }}>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg(`fz.status.${badge}`)}</Text>
          </View>
        ) : null}
      </View>
      <ChevronRight color={t.color.ink} />
    </Pressable>
  );
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2');
}
