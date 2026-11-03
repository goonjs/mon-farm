/**
 * /v2/sale/<id>/backfill?point= — บันทึกย้อนหลัง (sale mockup v1.1.0 page 14,
 * E04-S10, D-49): the same flow as weighing at a point (farm → tapper → point
 * on the picker), then numbers instead of holds — full baskets and an
 * optional short one in kg of net rubber. Numbers run on from the sequence's
 * last basket by the sale's numbering mode (D-46, D-79); every basket is
 * labelled "บันทึกย้อนหลัง" and counts like any other. No empty-scale check.
 *
 * Both numbers are typed on the app number pad (E01-S20 row 20): whole full
 * baskets (≤ 999), and the short basket in kg of net rubber to 3 decimals
 * (grams, ≤ 9,999.999), optional with "เว้นว่าง". ✓ on the full baskets opens
 * the short-basket pad right away (NP-15).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { backfillEvents, backfillPlan } from '../../core/backfill';
import { tapperOn } from '../../core/master';
import { pairForNewPoint } from '../../core/sale-move';
import { parseKgG, pointSetupPayloads } from '../../core/sale-points';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BasketIcon, Button, cardStyle, CTA, IconTile, LeafIcon, Plus, QuantityField, ScaleIcon, FarmMateArt } from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { Crumbs, IconLine, Kv, kgText, PointBar, farmTone, tapperTone, useLeaveIfClosed, useSaleView } from './pieces';

export function BackfillScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { point: pointId = '' } = useLocalSearchParams<{ point?: string }>();
  const view = useSaleView();
  // A closed sale takes no more weighing (review #2).
  useLeaveIfClosed(view);
  const { saleId, events, state, master, day, mode, settings, append, nameOf, saleTitle } = view;
  const [full, setFull] = useState<number | null>(null);
  /** Grams of net rubber; null = no short basket. */
  const [short, setShort] = useState<number | null>(null);
  const [shortOpen, setShortOpen] = useState(false);
  const base = `/v2/sale/${saleId}`;

  const point = master?.points.find((p) => p.id === pointId);
  const farm = master?.properties.find((f) => f.id === point?.propertyId);
  if (!view.ready || !master || !settings || !point || !farm) return <FarmScreen title={msg('backfill.title')} subtitle={saleTitle} fallback={`${base}/point` as Href} />;

  const tapper = tapperOn(master, pointId, day);
  const pileRec = state.piles.find((p) => p.id === pointId);
  const pair = pileRec ? { stdNetG: pileRec.stdNetG, tareG: pileRec.tareG } : (() => {
    const p = pairForNewPoint(events, settings, null);
    return { stdNetG: p.netG, tareG: p.basketG };
  })();
  const fullN = full ?? 0;
  const plan = backfillPlan(events, master, day, pointId, mode, pair, fullN, short);
  const kg = (g: number) => msg('v2f.kg', { n: kgText(g) });

  const save = () => {
    if (!plan) return;
    for (const payload of pointSetupPayloads(state, master, pointId, { pairId: '', netG: pair.stdNetG, basketG: pair.tareG })) append({ kind: 'sys', payload });
    for (const e of backfillEvents(plan, pointId, pair)) append(e);
    if (router.canDismiss()) router.dismiss(2);
    else router.replace(`${base}/counter?point=${pointId}` as Href);
  };

  const after = tapper && mode === 'per-tapper' ? msg('backfill.after', { name: nameOf(tapper), n: plan?.lastNo ?? 0 }) : msg('backfill.afterPoint', { n: plan?.lastNo ?? 0 });

  return (
    <FarmScreen
      title={msg('backfill.title')}
      subtitle={saleTitle}
      fallback={`${base}/point?mode=backfill` as Href}
      testID="backfill"
      footer={
        <CTA testID="backfill-save" disabled={!plan} onPress={save}>
          {plan ? msg('backfill.save', { n: plan.baskets }) : msg('backfill.saveNone')}
        </CTA>
      }
    >
      <Crumbs done={[msg('pick.farm'), msg('pick.tapper'), msg('v2s.pointStep')]} now={msg('v2s.numbersStep')} />
      <PointBar
        place={msg('v2s.place', { farm: farm.name, point: point.name })}
        farmToneName={farmTone(master, farm.id)}
        tapper={tapper ? nameOf(tapper) : msg('rec.noTapper')}
        tapperToneName={tapperTone(master, tapper)}
        onSwitch={() => router.replace(`${base}/point?mode=backfill&farm=${farm.id}${tapper ? `&tapper=${tapper}` : ''}` as Href)}
      />
      <View style={{ gap: t.space.xs }}>
        <QuantityField
          testID="backfill-full"
          label={msg('backfill.full')}
          value={full}
          onChange={(n) => {
            setFull(n);
            setShortOpen(true);
          }}
          unit={msg('npsale.basket')}
          maxDigits={3}
        />
        <IconLine icon={(c) => <LeafIcon color={c} size={12} />}>{msg('backfill.fullHint', { kg: kgText(pair.stdNetG) })}</IconLine>
      </View>
      <QuantityField
        testID="backfill-short"
        label={msg('backfill.short')}
        hint={msg('backfill.optional')}
        value={short}
        onChange={setShort}
        unit={msg('common.kg')}
        decimals={3}
        maxDigits={4}
        emptyText={msg('backfill.optional')}
        clear={{ label: msg('numpad.clearNoShort'), onClear: () => setShort(null) }}
        // The old parser still decides: more than 0 kg (parseKgG).
        validate={(g) => (parseKgG(String(g / 1000)) === g ? undefined : msg('backfill.badKg'))}
        open={shortOpen}
        onOpenChange={setShortOpen}
      />

      {plan ? (
        <View testID="backfill-plan" style={{ ...cardStyle(t), padding: t.space.md, gap: t.space.xs }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('backfill.will', { n: plan.baskets })}</AppText>
          {plan.fullTo >= plan.fullFrom ? (
            <PlanRow icon={<BasketIcon color={t.color.inkSoft} size={16} />} k={msg('backfill.fullRow')} count={msg('backfill.count', { n: fullN })} range={plan.fullFrom === plan.fullTo ? msg('backfill.one', { n: plan.fullFrom }) : msg('backfill.range', { from: plan.fullFrom, to: plan.fullTo })} kg={kg(plan.fullG)} />
          ) : null}
          {plan.shortNo !== null && plan.shortG !== null ? (
            <PlanRow icon={<ScaleIcon color={t.color.inkSoft} size={16} />} k={msg('backfill.shortRow')} count={msg('backfill.count', { n: 1 })} range={msg('backfill.one', { n: plan.shortNo })} kg={kg(plan.shortG)} />
          ) : null}
          <Kv tone="total" label={msg('backfill.total')} value={kg(plan.totalG)} testID="backfill-total" />
          <AppText variant="bodySm">{after}</AppText>
        </View>
      ) : null}

      <View testID="backfill-proof" style={{ ...cardStyle(t), padding: t.space.md, flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
        <IconTile tone="action" icon={() => <FarmMateArt id="farm.photos" />} />
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.evidence')}</AppText>
          <AppText variant="bodySm">{msg('backfill.optional')}</AppText>
          <AppText variant="bodySm">{msg('v2s.noPhoto')}</AppText>
        </View>
        {/* Photos wait for a camera / file picker and Cloud Storage (D-48). */}
        <Button testID="backfill-photo" disabled icon={(c) => <Plus color={c} size={12} />}>
          {msg('v2s.addPhoto')}
        </Button>
      </View>
    </FarmScreen>
  );
}

function PlanRow({ icon, k, count, range, kg }: { icon: React.ReactNode; k: string; count: string; range: string; kg: string }) {
  const t = useTheme();
  const cell = { fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, color: t.color.ink } as const;
  return (
    <View style={{ gap: t.space.xxs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        {icon}
        <Text style={{ ...cell, flex: 1, fontWeight: t.font.weight.semibold }}>{k}</Text>
        <Text style={{ ...cell, fontWeight: t.font.weight.bold }}>{count}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingLeft: 24 }}>
        <Text style={{ ...cell, flex: 1, color: t.color.inkSoft }}>{range}</Text>
        <Text style={{ ...cell, fontWeight: t.font.weight.bold }}>{kg}</Text>
      </View>
    </View>
  );
}
