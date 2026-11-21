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
import { pointChoices, pointWeighed, saleRollup } from '../../core/sale-points';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AlertIcon, AppText, BottomSheet, DotsIcon, cardStyle, ChevronRight, CTA, IconTile, TapperIcon, TextLink, type TileTone, FarmMateArt } from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { signed, useGoToPoint, type Fill } from './move';
import { SaleMenu } from './sale-menu';
import { SaleOptionSheets, type OptionSheet } from './sale-options';
import { BasketBar, Crumbs, IconLine, kgText, RubberKg, ScaleNum, SegOptions, SkewTag, WrapLine, Words, farmTone, useLeaveIfClosed, useSaleView } from './pieces';

export function PointScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ pair?: string; mode?: string; farm?: string; tapper?: string; ask?: string; fill?: string }>();
  const view = useSaleView();
  // A closed sale takes no more weighing (review #2).
  useLeaveIfClosed(view);
  const goTo = useGoToPoint(view);
  const { saleId, events, state, master, day, mode, settings, nameOf, saleTitle } = view;
  const [farmId, setFarmId] = useState<string | null>(params.farm ?? null);
  const [tapperId, setTapperId] = useState<string | null>(params.tapper ?? null);
  const [ask, setAsk] = useState<{ pointId: string; open: OpenBasket } | null>(null);
  // E04-S21: the way chosen on the fill-up sheet; fill up first.
  const [choice, setChoice] = useState<Fill>(params.fill === 'part' ? 'part' : 'full');
  const [menu, setMenu] = useState<'none' | 'menu' | OptionSheet>('none');
  const switching = params.mode === 'switch';
  const backfill = params.mode === 'backfill';
  const title = backfill ? msg('backfill.title') : switching ? msg('rec.switch') : msg('pick.title');
  const fallback = `/v2/sale/${saleId}/counter` as Href;
  // E04-S24: "เปลี่ยนวิธีเติม ›" on the counter opens this sheet again for its point, with the way in use (`fill`).
  const changing: { pointId: string; way: Fill } | null = params.ask && (params.fill === 'full' || params.fill === 'part') ? { pointId: params.ask, way: params.fill as Fill } : null;

  if (!view.ready || !master || !settings) return <FarmScreen title={title} subtitle={saleTitle} fallback={fallback} />;

  const farms = master.properties.filter((f) => !f.deleted);
  const farm = farms.find((f) => f.id === farmId) ?? farms[0] ?? null;
  const choices = farm ? pointChoices(master, farm.id, day) : { byTapper: [], unassigned: [] };
  const group = choices.byTapper.find((g) => g.tapperId === tapperId) ?? choices.byTapper[0] ?? null;
  const rollup = saleRollup(events, master, day);
  // E04-S25: a point holding only a top-up part has 0 baskets of its own but was weighed.
  const status = (pointId: string) => {
    const at = rollup.byPoint.get(pointId);
    if (!at || !pointWeighed(rollup, pointId)) return msg('v2s.notWeighed');
    return at.baskets ? msg('v2s.weighedN', { n: at.baskets }) : msg('v2s.weighedPart', { kg: kgText(at.netG) });
  };
  const allWeighed = master.points.filter((p) => !p.hidden).every((p) => pointWeighed(rollup, p.id));
  const tone: TileTone = farm ? farmTone(master, farm.id) : 'category1';
  // The sheet for a way change is worked out here, not stored: it closes by going back to the counter.
  const changeOpen = changing ? planMove(events, state, master, day, changing.pointId, mode, settings.zeroCheck).ask : null;
  const sheetFor = ask ?? (changing && changeOpen ? { pointId: changing.pointId, open: changeOpen } : null);

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
      <IconTile tone={tileTone} icon={() => <FarmMateArt id="farm.weighPoint" />} />
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
          {sheetFor ? fillSheet(sheetFor) : null}
          <BottomSheet open={menu === 'menu'} onClose={() => setMenu('none')} title={msg('rec.menu')} testID="pick-menu-sheet">
            <SaleMenu view={view} pick={setMenu} close={() => setMenu('none')} backfill={group ? `/v2/sale/${saleId}/backfill?tapper=${group.tapperId}` : undefined} />
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
            wrap
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
            wrap
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
      {/* Arrived late (E04-S19, owner 2026-11-16; also on change-point, E04-S23 JB-2): straight into this tapper's catch-up, no point or empty-scale check first. */}
      {group && !backfill ? (
        <TextLink testID="pick-backfill" onPress={() => router.push(`/v2/sale/${saleId}/backfill?tapper=${group.tapperId}` as Href)}>
          {msg('pick.backfill', { name: nameOf(group.tapperId) })}
        </TextLink>
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
   * E04-S21 (owner 2026-10-11, AC agreed 2026-11-17): choose, then confirm. Every way shows what the scale
   * must read on its right; the chosen one lists its steps; the button says what will be done. The logic is
   * E04-S06/S17's: way 3 only goes on (the basket closes when the next full one is counted).
   */
  function fillSheet(a: { pointId: string; open: OpenBasket }) {
    const o = a.open;
    // Changing the way (E04-S24) goes back to the counter, writing nothing: nothing is written until the hold.
    const backToCounter = (way: Fill) => {
      if (router.canDismiss()) router.dismiss(1);
      router.replace(`/v2/sale/${saleId}/counter?point=${a.pointId}&fill=${way}` as Href);
    };
    const onClose = () => (changing ? backToCounter(changing.way) : setAsk(null));
    const skew = saleSkewG(events);
    const from = master!.points.find((p) => p.id === o.pointId);
    const fromFarm = master!.properties.find((f) => f.id === from?.propertyId);
    const to = master!.points.find((p) => p.id === a.pointId);
    const toFarm = master!.properties.find((f) => f.id === to?.propertyId);
    const tapper = nameOf(group?.tapperId ?? null) || nameOf(choices.byTapper.find((g) => g.points.some((p) => p.id === a.pointId))?.tapperId ?? null);
    const std = o.haveG + o.missingG;
    const fullKg = (std + o.tareG + skew) / 1000;
    const partKg = (o.missingG + o.tareG + skew) / 1000;
    const skewPart = skew ? ` + ${msg('v2s.eqSkew', { n: kgText(skew) })}` : '';
    const where = (farmName?: string, pointName?: string) => `${farmName ?? ''} ${pointName ?? ''}`.trim();
    const confirm = () => (changing ? backToCounter(choice) : go(a.pointId, choice));
    const wayNo: Record<Fill, number> = { full: 1, part: 2, next: 3 };
    const ctaText = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.inkInverse } as const;
    const step = (n: number, body: React.ReactNode, em?: boolean) => (
      <View key={n} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.xs, paddingVertical: t.space.xxs, paddingHorizontal: t.space.xs, borderRadius: t.radius.sm, backgroundColor: em ? t.color.warnSunk : undefined }}>
        <Words strong={em}>{`${n}.`}</Words>
        <View style={{ flex: 1, minWidth: 0 }}>{body}</View>
      </View>
    );
    const readStep = (kg: number, eq: string) => (
      <WrapLine>
        <Words>{msg('v2s.mustRead')}</Words>
        <ScaleNum kg={kg} />
        <Words soft>{eq}</Words>
      </WrapLine>
    );
    const way = (id: Fill, title: string, sub: React.ReactNode, scaleKg: number | null, steps?: React.ReactNode) => {
      const on = choice === id;
      return (
        <Pressable
          key={id}
          testID={`fill-${id}`}
          accessibilityRole="radio"
          accessibilityState={{ selected: on, checked: on }}
          onPress={() => setChoice(id)}
          style={{ gap: t.space.sm, padding: t.space.md, minHeight: t.target.comfortable, borderRadius: t.radius.lg, borderWidth: on ? t.border.thick : t.border.hair, borderColor: on ? t.color.action : t.color.ruleStrong, backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            {/* FX-5: the ways are numbered 1 2 3; the chosen one's number is filled. */}
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: t.border.thick, borderColor: on ? t.color.action : t.color.inkSoft, backgroundColor: on ? t.color.action : undefined, alignItems: 'center', justifyContent: 'center' }}>
              <Text testID={`fill-${id}-num`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.black, color: on ? t.color.inkInverse : t.color.inkSoft }}>{wayNo[id]}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: t.space.xxs }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{title}</AppText>
              {sub}
              {changing?.way === id ? (
                <AppText variant="bodySm" style={{ fontWeight: t.font.weight.bold, color: t.color.accept }}>
                  {'✓ '}
                  <AppText testID="fill-current" variant="bodySm" style={{ fontWeight: t.font.weight.bold, color: t.color.accept }}>{msg('v2s.fillCurrent')}</AppText>
                </AppText>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption">{msg('v2s.optScale')}</AppText>
              {scaleKg === null ? <AppText testID={`fill-${id}-scale`} style={{ fontWeight: t.font.weight.bold, color: t.color.inkSoft }}>—</AppText> : <ScaleNum testID={`fill-${id}-scale`} kg={scaleKg} size="lg" />}
            </View>
          </View>
          {on ? steps : null}
        </Pressable>
      );
    };
    return (
      <BottomSheet open onClose={onClose} title={msg('v2s.fillChoose', { n: o.basketNo })} testID="fill-sheet">
        <View testID="fill-route" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="caption">{msg('v2s.routeFrom')}</AppText>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{where(fromFarm?.name, from?.name)}</AppText>
          </View>
          <ChevronRight color={t.color.ink} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="caption">{msg('v2s.routeTo')}</AppText>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{where(toFarm?.name, to?.name)}</AppText>
          </View>
        </View>
        <IconLine icon={(c) => <TapperIcon color={c} size={14} />}>{msg('v2s.fillSame', { name: tapper })}</IconLine>
        {skew ? <SkewTag label={msg('v2s.skewTag', { skew: signed(kgText(skew)) })} /> : null}
        <BasketBar haveG={o.haveG} addG={o.missingG} addLabel={msg('v2s.barAdd')} />
        <View testID="fill-ways" accessibilityRole="radiogroup" accessibilityLabel={msg('v2s.fillWays', { n: o.basketNo })} style={{ gap: t.space.md }}>
          {way(
            'full',
            msg('v2s.optFull'),
            <WrapLine>
              <Words soft>{msg('v2s.optFullRes', { n: o.basketNo })}</Words>
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
          {way(
            'part',
            msg('v2s.optPart'),
            <WrapLine>
              <Words soft>{msg('v2s.optPartSub')}</Words>
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
          {way(
            'next',
            msg('v2s.optNext'),
            <WrapLine>
              <Words soft>{msg('v2s.optNextSub', { n: o.basketNo })}</Words>
              <RubberKg g={o.haveG} />
              <Words soft>{msg('v2s.optNextThen', { n: o.basketNo + 1 })}</Words>
            </WrapLine>,
            null,
          )}
        </View>
        <Pressable
          testID="fill-go"
          accessibilityRole="button"
          onPress={confirm}
          style={{ minHeight: t.target.comfortable, borderRadius: t.radius.lg, backgroundColor: t.color.action, paddingHorizontal: t.space.md, paddingVertical: t.space.sm, alignItems: 'center', justifyContent: 'center' }}
        >
          {choice === 'next' ? (
            <Text style={ctaText}>{msg('v2s.fillGoNext', { n: o.basketNo + 1 })}</Text>
          ) : (
            <WrapLine>
              <Text style={ctaText}>{changing ? msg('v2s.fillGoWay', { n: wayNo[choice] }) : choice === 'full' ? msg('v2s.fillGoFull', { n: o.basketNo }) : msg('v2s.fillGoPart')}</Text>
              <ScaleNum kg={choice === 'full' ? fullKg : partKg} color={t.color.inkInverse} size="lg" />
            </WrapLine>
          )}
        </Pressable>
      </BottomSheet>
    );
  }
}
