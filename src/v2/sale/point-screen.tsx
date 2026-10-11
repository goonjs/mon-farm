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
import { AlertIcon, AppText, BottomSheet, DotsIcon, cardStyle, ChevronRight, CTA, IconTile, PinIcon, TapperIcon, type TileTone } from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { signed, useGoToPoint, type Fill } from './move';
import { SaleOptionRows, SaleOptionSheets, type OptionSheet } from './sale-options';
import { BasketBar, Crumbs, IconLine, kgText, RubberKg, ScaleNum, SegOptions, SkewTag, WrapLine, Words, farmTone, useLeaveIfClosed, useSaleView } from './pieces';

export function PointScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ pair?: string; mode?: string; farm?: string; tapper?: string }>();
  const view = useSaleView();
  // A closed sale takes no more weighing (review #2).
  useLeaveIfClosed(view);
  const goTo = useGoToPoint(view);
  const { saleId, events, state, master, day, mode, settings, append, nameOf, saleTitle } = view;
  const [farmId, setFarmId] = useState<string | null>(params.farm ?? null);
  const [tapperId, setTapperId] = useState<string | null>(params.tapper ?? null);
  const [ask, setAsk] = useState<{ pointId: string; open: OpenBasket } | null>(null);
  const [choice, setChoice] = useState<Fill | 'next'>('full');
  const [menu, setMenu] = useState<'none' | 'menu' | OptionSheet>('none');
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
      if (plan.ask) {
        setChoice('full');
        return setAsk({ pointId, open: plan.ask });
      }
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
      right={
        backfill ? undefined : (
          <Pressable testID="pick-menu" accessibilityRole="button" accessibilityLabel={msg('rec.menu')} onPress={() => setMenu('menu')} style={{ minWidth: t.target.min, minHeight: t.target.min, alignItems: 'center', justifyContent: 'center' }}>
            <DotsIcon color={t.color.appBarInk} size={18} />
          </Pressable>
        )
      }
      footer={
        switching && allWeighed && rollup.sale.baskets > 0 ? (
          <CTA testID="pick-finish" onPress={() => router.push(`/v2/sale/${saleId}/check` as Href)}>
            {msg('rec.finish')}
          </CTA>
        ) : null
      }
      overlay={
        <>
          {ask ? fillSheet(ask) : null}
          <BottomSheet open={menu === 'menu'} onClose={() => setMenu('none')} title={msg('rec.menu')} testID="pick-menu-sheet">
            <SaleOptionRows view={view} pick={setMenu} />
          </BottomSheet>
          <SaleOptionSheets view={view} open={menu === 'price' || menu === 'info' || menu === 'delete' ? menu : 'none'} onClose={() => setMenu('none')} />
        </>
      }
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

  /**
   * Choose, then confirm (owner 2026-10-11, mockup fill-sheet v2): every way
   * shows what the scale must read at its right; the chosen one lists its
   * steps; the button repeats what will be done.
   */
  function fillSheet(a: { pointId: string; open: OpenBasket }) {
    const o = a.open;
    const onClose = () => setAsk(null);
    const skew = saleSkewG(events);
    const from = master!.points.find((p) => p.id === o.pointId);
    const fromFarm = master!.properties.find((f) => f.id === from?.propertyId);
    const to = master!.points.find((p) => p.id === a.pointId);
    const toFarm = master!.properties.find((f) => f.id === to?.propertyId);
    const tapper = nameOf(group?.tapperId ?? null) || nameOf(choices.byTapper.find((g) => g.points.some((p) => p.id === a.pointId))?.tapperId ?? null);
    const std = o.haveG + o.missingG;
    const fullKg = (std + o.tareG + skew) / 1000;
    const partKg = (o.missingG + o.tareG + skew) / 1000;
    const skewPart = skew ? ` + ${msg('v2s.skewWord')} ${kgText(skew)}` : '';
    const go = () => {
      if (choice === 'next') {
        append({ kind: 'sys', payload: { t: 'basket_closed', basketId: o.rootId, reason: 'next' } });
        return go2(a.pointId);
      }
      go2(a.pointId, choice);
    };
    function go2(pointId: string, f?: Fill) {
      setAsk(null);
      goTo(pointId, { fill: f, fromSwitch: switching, pairId: params.pair });
    }
    const ctaText = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.inkInverse } as const;
    const where = (farmName?: string, pointName?: string) => `${farmName ?? ''} ${pointName ?? ''}`.trim();
    const cta = choice === 'full' ? (
      <WrapLine>
        <Text style={ctaText}>{msg('v2s.fillGoFull', { n: o.basketNo })}</Text>
        <ScaleNum kg={fullKg} color={t.color.inkInverse} size="lg" />
      </WrapLine>
    ) : choice === 'part' ? (
      <WrapLine>
        <Text style={ctaText}>{msg('v2s.fillGoPart')}</Text>
        <ScaleNum kg={partKg} color={t.color.inkInverse} size="lg" />
      </WrapLine>
    ) : (
      <Text style={ctaText}>{msg('v2s.fillGoNext', { n: o.basketNo + 1 })}</Text>
    );
    const row = (id: Fill | 'next', title: string, sub: React.ReactNode, scaleKg: number | null, steps?: React.ReactNode) => {
      const on = choice === id;
      return (
        <Pressable
          key={id}
          testID={`fill-${id === 'next' ? 'next' : id}`}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          onPress={() => setChoice(id)}
          style={{ gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.lg, borderWidth: on ? t.border.thick : t.border.hair, borderColor: on ? t.color.action : t.color.ruleStrong, backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: t.border.thick, borderColor: on ? t.color.action : t.color.inkSoft, alignItems: 'center', justifyContent: 'center' }}>
              {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color.action }} /> : null}
            </View>
            <View style={{ flex: 1, gap: t.space.xxs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{title}</AppText>
              {sub}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption">{msg('v2s.optScale')}</AppText>
              {scaleKg === null ? <AppText style={{ fontWeight: t.font.weight.bold }}>—</AppText> : <ScaleNum kg={scaleKg} size="lg" />}
            </View>
          </View>
          {on ? steps : null}
        </Pressable>
      );
    };
    const step = (n: number, body: React.ReactNode, em?: boolean) => (
      <View key={n} style={{ flexDirection: 'row', gap: t.space.xs, paddingVertical: t.space.xxs, paddingHorizontal: t.space.xs, borderRadius: t.radius.sm, backgroundColor: em ? t.color.warnSunk : undefined }}>
        <Words strong={em}>{n}.</Words>
        {body}
      </View>
    );
    const readStep = (kg: number, eq: string) => (
      <WrapLine>
        <Words>{msg('v2s.stepRead')}</Words>
        <ScaleNum kg={kg} />
        <Words>{eq}</Words>
      </WrapLine>
    );
    return (
      <BottomSheet open onClose={onClose} title={msg('v2s.fillChoose', { n: o.basketNo })} testID="fill-sheet">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.sm }}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption">{msg('v2s.routeFrom')}</AppText>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{where(fromFarm?.name, from?.name)}</AppText>
          </View>
          <ChevronRight color={t.color.ink} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption">{msg('v2s.routeTo')}</AppText>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{where(toFarm?.name, to?.name)}</AppText>
          </View>
        </View>
        <IconLine icon={(c) => <TapperIcon color={c} size={14} />}>{msg('v2s.fillSame', { name: tapper })}</IconLine>
        {skew ? <SkewTag label={msg('v2s.skewTag', { skew: signed(kgText(skew)) })} /> : null}
        <BasketBar haveG={o.haveG} addG={o.missingG} stdG={std} addLabel={msg('v2s.barAdd')} />
        {row(
          'full',
          msg('v2s.optFull'),
          <WrapLine>
            <Words>{msg('v2s.optFullRes', { n: o.basketNo })}</Words>
            <RubberKg g={std} />
          </WrapLine>,
          fullKg,
          <View testID="fill-steps" style={{ gap: t.space.xxs }}>
            {step(1, (
              <WrapLine>
                <Words strong>{msg('v2s.stepPour')}</Words>
                <RubberKg g={o.missingG} />
                <Words strong>{msg('v2s.stepIntoOld', { n: o.basketNo })}</Words>
              </WrapLine>
            ), true)}
            {step(2, readStep(fullKg, `(${kgText(std)} + ${msg('v2s.eqBasket', { n: kgText(o.tareG) })}${skewPart})`))}
          </View>,
        )}
        {row(
          'part',
          msg('v2s.optPart'),
          <WrapLine>
            <Words>{msg('v2s.optPartSub')}</Words>
            <RubberKg g={o.missingG} />
          </WrapLine>,
          partKg,
          <View testID="fill-steps" style={{ gap: t.space.xxs }}>
            {step(1, (
              <WrapLine>
                <Words strong>{msg('v2s.stepWeighIn')}</Words>
                <RubberKg g={o.missingG} />
                <Words strong>{msg('v2s.stepEmptyNew')}</Words>
              </WrapLine>
            ), true)}
            {step(2, readStep(partKg, `(${kgText(o.missingG)} + ${msg('v2s.eqBasket', { n: kgText(o.tareG) })}${skewPart})`))}
          </View>,
        )}
        {row(
          'next',
          msg('v2s.optNext'),
          <WrapLine>
            <Words>{msg('v2s.optNextSub', { n: o.basketNo })}</Words>
            <RubberKg g={o.haveG} />
            <Words>{msg('v2s.optNextThen', { n: o.basketNo + 1 })}</Words>
          </WrapLine>,
          null,
        )}
        <Pressable
          testID="fill-go"
          accessibilityRole="button"
          onPress={go}
          style={{ minHeight: t.target.comfortable, paddingHorizontal: t.space.xl, borderRadius: t.radius.pill, borderWidth: t.border.thick, borderColor: t.color.action, backgroundColor: t.color.action, alignItems: 'center', justifyContent: 'center' }}
        >
          {cta}
        </Pressable>
        <AppText variant="caption">{msg('v2s.fillNote', { n: o.basketNo })}</AppText>
      </BottomSheet>
    );
  }
}
