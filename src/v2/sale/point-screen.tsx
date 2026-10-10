/**
 * /v2/sale/<id>/point — เลือกจุดชั่ง (sale mockup v1.1.0 page 6), also
 * "เปลี่ยนจุด" from the counter (`?mode=switch`, page 12) and the first steps
 * of บันทึกย้อนหลัง (`?mode=backfill`, page 14 — the same flow, D-49).
 *
 * Farm → tapper → point, each chosen already, so one tap on a point starts
 * (E04-S02). Points with no tapper on the sale day are a separate group with
 * a warning (D-63, D-70 S1). Moving to the same tapper's next point with a
 * short basket still open asks the three ways (D-57); another tapper's point
 * closes it without asking (SALE-12). Then the empty-scale check, when the
 * mode or a skew calls for it (SALE-6, D-76), else straight to the counter.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { OpenBasket } from '../../core/bridge';
import { areaOn, formatRai } from '../../core/master';
import { saleSkewG } from '../../core/scale-check';
import { planMove } from '../../core/sale-move';
import { pointChoices, saleRollup } from '../../core/sale-points';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AlertIcon, AppText, BasketIcon, BottomSheet, cardStyle, ChevronRight, CTA, IconTile, PinIcon, Plus, Scale, TapperIcon, type TileTone } from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { signed, useGoToPoint, type Fill } from './move';
import { Choice, Crumbs, IconLine, kgText, NumChip, SegOptions, SkewTag, farmTone, useSaleView } from './pieces';

export function PointScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ pair?: string; mode?: string; farm?: string; tapper?: string }>();
  const view = useSaleView();
  const goTo = useGoToPoint(view);
  const { saleId, events, state, master, day, mode, settings, append, nameOf, saleTitle } = view;
  const [farmId, setFarmId] = useState<string | null>(params.farm ?? null);
  const [tapperId, setTapperId] = useState<string | null>(params.tapper ?? null);
  const [ask, setAsk] = useState<{ pointId: string; open: OpenBasket } | null>(null);
  const switching = params.mode === 'switch';
  const backfill = params.mode === 'backfill';
  const title = backfill ? msg('backfill.title') : switching ? msg('rec.switch') : msg('pick.title');
  const fallback = `/v2/sale/${saleId}/counter` as Href;

  if (!view.ready || !master || !settings) return <FarmScreen title={title} subtitle={saleTitle} fallback={fallback} />;

  const farms = master.properties.filter((f) => !f.deleted);
  const farm = farms.find((f) => f.id === farmId) ?? farms[0] ?? null;
  const choices = farm ? pointChoices(master, farm.id, day) : { byTapper: [], unassigned: [] };
  const group = choices.byTapper.find((g) => g.tapperId === tapperId) ?? choices.byTapper[0] ?? null;
  const rollup = saleRollup(events, master, day);
  const weighed = (pointId: string) => rollup.byPoint.get(pointId)?.baskets ?? 0;
  const status = (pointId: string) => (weighed(pointId) ? msg('v2s.weighedN', { n: weighed(pointId) }) : msg('v2s.notWeighed'));
  const allWeighed = master.points.filter((p) => !p.hidden).every((p) => weighed(p.id) > 0);
  const tone: TileTone = farm ? farmTone(master, farm.id) : 'category1';

  /** Opens the counter (or backfill) at `pointId`, after writing what the move needs. */
  const go = (pointId: string, fill?: Fill) => {
    if (backfill) return (switching ? router.replace : router.push)(`/v2/sale/${saleId}/backfill?point=${pointId}` as Href);
    goTo(pointId, { fill, fromSwitch: switching, pairId: params.pair });
  };

  const pick = (pointId: string) => {
    if (!backfill) {
      const plan = planMove(events, state, master, day, pointId, mode, settings.zeroCheck);
      if (plan.ask) return setAsk({ pointId, open: plan.ask });
    }
    go(pointId);
  };

  const row = (pointId: string, name: string, lines: React.ReactNode, tileTone: TileTone) => (
    <Pressable key={pointId} testID={`pick-point-${pointId}`} accessibilityRole="button" onPress={() => pick(pointId)} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.sm, minHeight: t.target.min }}>
      <IconTile tone={tileTone} icon={(c) => <PinIcon color={c} size={22} />} />
      <View style={{ flex: 1, gap: t.space.xxs }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{name}</Text>
        {lines}
      </View>
      <ChevronRight color={t.color.inkSoft} />
    </Pressable>
  );
  const rule = (i: number) => (i ? <View key={`r${i}`} style={{ height: t.border.hair, backgroundColor: t.color.ruleFaint }} /> : null);
  const card = { ...cardStyle(t), padding: t.space.lg, gap: t.space.sm };

  return (
    <FarmScreen
      title={title}
      subtitle={saleTitle}
      fallback={fallback}
      testID="pick"
      footer={
        switching && allWeighed && rollup.sale.baskets > 0 ? (
          <CTA testID="pick-finish" onPress={() => router.push(`/v2/sale/${saleId}/check` as Href)}>
            {msg('rec.finish')}
          </CTA>
        ) : null
      }
      overlay={ask ? fillSheet(ask) : null}
    >
      <Crumbs done={[msg('pick.farm'), msg('pick.tapper')]} now={backfill ? msg('v2s.pointStep') : msg('v2s.pointStep')} />
      {farms.length === 0 ? <AppText variant="bodySm">{msg('pick.noFarms')}</AppText> : null}
      {farms.length ? (
        <View style={card}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('pick.farm')}</AppText>
          <SegOptions
            testID="pick-farm"
            value={farm?.id ?? null}
            onChange={(id) => {
              setFarmId(id);
              setTapperId(null);
            }}
            options={farms.map((f) => {
              const area = areaOn(f, day);
              return { value: f.id, label: f.name, detail: area === null ? undefined : msg('v2s.areaRai', { n: formatRai(area) }) };
            })}
          />
        </View>
      ) : null}
      {choices.byTapper.length ? (
        <View style={card}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('pick.tapper')}</AppText>
          <SegOptions
            testID="pick-tapper"
            value={group?.tapperId ?? null}
            onChange={setTapperId}
            options={choices.byTapper.map((g) => ({ value: g.tapperId, label: nameOf(g.tapperId), detail: msg('pick.points', { n: g.points.length }) }))}
          />
        </View>
      ) : null}
      {group ? (
        <View testID="pick-points" style={{ ...cardStyle(t), paddingHorizontal: t.space.lg, paddingVertical: t.space.xs }}>
          {group.points.flatMap((p, i) => [rule(i), row(p.id, p.name, <AppText variant="bodySm">{status(p.id)}</AppText>, tone)])}
        </View>
      ) : null}
      {choices.unassigned.length ? (
        <View testID="pick-unassigned" style={{ ...cardStyle(t), paddingHorizontal: t.space.lg, paddingVertical: t.space.sm }}>
          <AppText variant="label">{msg('pick.unassigned')}</AppText>
          {choices.unassigned.flatMap((p, i) => [
            rule(i),
            row(p.id, p.name, <IconLine icon={(c) => <AlertIcon color={c} size={12} />}>{msg('v2s.assignFirst')}</IconLine>, 'cream'),
          ])}
        </View>
      ) : null}
      {farm && !choices.byTapper.length && !choices.unassigned.length ? <AppText variant="bodySm">{msg('pick.noPoints')}</AppText> : null}
    </FarmScreen>
  );

  function fillSheet(a: { pointId: string; open: OpenBasket }) {
    const o = a.open;
    const onClose = () => setAsk(null);
    const onFill = (f: Fill) => go(a.pointId, f);
    const onNext = () => {
      append({ kind: 'sys', payload: { t: 'basket_closed', basketId: o.rootId, reason: 'next' } });
      go(a.pointId);
    };
    const skew = saleSkewG(events);
    const from = master!.points.find((p) => p.id === o.pointId);
    const fromFarm = master!.properties.find((f) => f.id === from?.propertyId);
    const tapper = nameOf(group?.tapperId ?? null) || nameOf(choices.byTapper.find((g) => g.points.some((p) => p.id === a.pointId))?.tapperId ?? null);
    const std = o.haveG + o.missingG;
    const kg = (g: number) => msg('v2f.kg', { n: kgText(g) });
    const skewKg = signed(kgText(skew));
    return (
      <BottomSheet open onClose={onClose} title={msg('v2s.fillTitle', { n: o.basketNo })} testID="fill-sheet">
        <View style={{ gap: t.space.xs }}>
          <IconLine icon={(c) => <Scale color={c} size={14} />}>
            {msg('v2s.fillHave')} <Text style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{kg(o.haveG)}</Text>
          </IconLine>
          <IconLine icon={(c) => <PinIcon color={c} size={14} />}>{msg('v2s.fillFrom', { place: `${fromFarm?.name ?? ''} ${from?.name ?? ''}` })}</IconLine>
          <IconLine icon={(c) => <TapperIcon color={c} size={14} />}>{msg('v2s.fillSame', { name: tapper })}</IconLine>
          {skew ? <SkewTag label={msg('v2s.skewTag', { skew: signed(skewKg) })} /> : null}
        </View>
        <Choice
          primary
          testID="fill-full"
          icon={(c) => <BasketIcon color={c} size={20} />}
          title={msg('v2s.fillFull')}
          onPress={() => onFill('full')}
          lines={[
            <Text key="a">
              <Text style={{ color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('v2s.fillMore')}</Text> <NumChip tone="warn">{kg(o.missingG)}</NumChip> {msg('v2s.asBasket', { n: o.basketNo })}
            </Text>,
            <Text key="b">
              {msg(skew ? 'rec.shouldRead' : 'v2s.scaleReads')} <NumChip tone="scale">{kg(std + o.tareG + skew)}</NumChip> {msg('v2s.wholeBasket')}
            </Text>,
            ...(skew ? [msg('v2s.fullSumSkew', { std: kgText(std), tare: kgText(o.tareG), skew: skewKg })] : []),
          ]}
        />
        <Choice
          testID="fill-part"
          icon={(c) => <Scale color={c} size={20} />}
          title={msg('v2s.fillPart')}
          onPress={() => onFill('part')}
          lines={[
            <Text key="a">
              {msg('v2s.weighAdded')} <NumChip>{kg(o.missingG)}</NumChip> {msg('v2s.countAs', { n: o.basketNo })}
            </Text>,
            <Text key="b">
              {msg(skew ? 'rec.shouldRead' : 'v2s.scaleReads')} <NumChip tone="scale">{kg(o.missingG + o.tareG + skew)}</NumChip>{' '}
              {skew ? '' : msg('v2s.partSum', { part: kgText(o.missingG), tare: kgText(o.tareG) })}
            </Text>,
            ...(skew ? [msg('v2s.partSumSkew', { part: kgText(o.missingG), tare: kgText(o.tareG), skew: skewKg })] : []),
          ]}
        />
        <Choice
          testID="fill-next"
          icon={(c) => <Plus color={c} size={16} />}
          title={msg('v2s.fillNext')}
          onPress={onNext}
          lines={[
            <Text key="a">
              {msg('v2s.shortOf', { n: o.basketNo })} <NumChip>{kg(o.haveG)}</NumChip>
            </Text>,
            <Text key="b">
              {msg('v2s.nextFull')} <NumChip>{msg('v2s.basketN', { n: o.basketNo + 1 })}</NumChip>
            </Text>,
          ]}
        />
        <AppText variant="caption">{msg('v2s.fillNote', { n: o.basketNo })}</AppText>
      </BottomSheet>
    );
  }
}
