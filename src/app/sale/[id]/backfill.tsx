/**
 * Enter a point's weighing afterwards (E04-S10, SALE-18, D-49, mockup v1.1.0
 * sale-23): the same farm → tapper → point flow as weighing, but numbers are
 * typed — full baskets and an optional short one in kg — instead of holding.
 * The preview shows the numbers they will get, on from the sequence's last.
 *
 * Attaching photos (the "แนบหลักฐาน" card) needs a camera/picker dependency
 * and the media queue (E01-S12); it is not here yet.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '../../../components/chrome';
import { Card, FarmScreen, FieldError } from '../../../components/farm-ui';
import { backfillEvents, backfillPlan } from '../../../core/backfill';
import { formatThaiDate, saleSettings, tapperOn, todayIso, type MasterState } from '../../../core/master';
import { parseKgG, saleNumbering } from '../../../core/sale-points';
import { formatKg } from '../../../core/settle';
import { useT } from '../../../i18n';
import { peopleStore } from '../../../store/people';
import { useSale } from '../../../store/SaleProvider';
import { useTheme } from '../../../theme';

export default function BackfillScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { pile: pileId } = useLocalSearchParams<{ pile?: string }>();
  const { saleId, events, state, append, ready } = useSale();
  const [master, setMaster] = useState<MasterState | null>(null);
  const [now] = useState(() => Date.now());
  const [full, setFull] = useState('');
  const [short, setShort] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    peopleStore.state().then(setMaster);
  }, []);

  const pile = state.piles.find((p) => p.id === pileId);
  const day = todayIso(state.startedTs ?? now);
  const mode = master ? saleNumbering(events, saleSettings(master).numbering) : 'per-tapper';
  const tapperId = master && pile ? tapperOn(master, pile.id, day) : null;
  const tapperName = tapperId ? (master?.people.find((p) => p.id === tapperId)?.name ?? '') : '';
  const farmName = state.zones.find((z) => z.id === pile?.zoneId)?.name ?? '';

  const fullCount = full.trim() ? Number(full.trim()) : 0;
  const countBad = full.trim() !== '' && !/^\d+$/.test(full.trim());
  const shortG = short.trim() ? parseKgG(short) : null;
  const shortBad = short.trim() !== '' && shortG === null;
  const plan =
    master && pile && !countBad && !shortBad ? backfillPlan(events, master, day, pile.id, mode, pile, fullCount, shortG) : null;

  const save = () => {
    setTried(true);
    // A finished sale takes no new basket (E04-S11); its baskets are edited from the list.
    if (!plan || !pile || state.saleStatus !== 'draft') return;
    for (const e of backfillEvents(plan, pile.id, pile)) append(e);
    // Back to the counter it came from; never a second copy of it on the stack.
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/sale/[id]/counter', params: { id: saleId, pile: pile.id } });
  };

  const text = (size: number, bold = false, color = t.color.ink) => ({
    fontFamily: t.font.family.sans,
    fontSize: size,
    fontWeight: bold ? t.font.weight.bold : t.font.weight.regular,
    color,
  });
  const input = (testID: string, value: string, onChange: (v: string) => void, bad: boolean, unit?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        style={{
          width: 110,
          minHeight: t.target.comfortable,
          textAlign: 'right',
          paddingHorizontal: t.space.md,
          borderRadius: t.radius.md,
          borderWidth: t.border.thick,
          borderColor: bad ? t.color.reject : t.color.action,
          ...text(t.font.size.headingXl, true),
        }}
      />
      {unit ? <Text style={text(t.font.size.small, false, t.color.inkSoft)}>{unit}</Text> : null}
    </View>
  );
  const row = (label: string, value: string, strong = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={text(t.font.size.body, strong, strong ? t.color.ink : t.color.inkSoft)}>{label}</Text>
      <Text style={text(t.font.size.body, true)}>{value}</Text>
    </View>
  );
  const kg = (g: number) => `${formatKg(g)} ${msg('rec.kgUnit')}`;

  if (!ready) return null;
  return (
    <FarmScreen
      title={msg('backfill.title')}
      subtitle={msg('rec.saleOf', { date: formatThaiDate(state.startedTs ?? now, 'be') })}
      back={{ pathname: '/sale/[id]/counter', params: { id: saleId, ...(pile ? { pile: pile.id } : {}) } } as Href}
      footer={
        <Button testID="bf-save" variant="primary" onPress={save} disabled={state.saleStatus !== 'draft'}>
          {plan ? msg('backfill.save', { n: plan.baskets }) : msg('backfill.saveNone')}
        </Button>
      }
    >
      <Text style={text(t.font.size.small, true, t.color.accept)}>{msg('backfill.crumbs')}</Text>
      {pile ? (
        <Card testID="bf-point">
          <Text style={text(t.font.size.headingMd, true)}>{`⊙ ${farmName} · ${pile.name}`}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <Text style={[text(t.font.size.body, false, t.color.inkSoft), { flex: 1 }]}>{tapperName || `⚠ ${msg('rec.noTapper')}`}</Text>
            <Pressable
              testID="bf-switch"
              accessibilityRole="button"
              onPress={() =>
                router.replace({ pathname: '/sale/[id]/points', params: { id: saleId, switch: '1', mode: 'backfill', farm: pile.zoneId } })
              }
              style={{
                minHeight: t.target.min,
                justifyContent: 'center',
                paddingHorizontal: t.space.lg,
                borderRadius: t.radius.pill,
                borderWidth: t.border.thick,
                borderColor: t.color.action,
              }}
            >
              <Text style={text(t.font.size.body, true, t.color.action)}>{`⇄ ${msg('rec.switch')}`}</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={text(t.font.size.body)}>{msg('backfill.full')}</Text>
            {pile ? <Text style={text(t.font.size.small, false, t.color.inkSoft)}>{msg('backfill.fullHint', { kg: formatKg(pile.stdNetG) })}</Text> : null}
          </View>
          {input('bf-full', full, setFull, tried && countBad)}
        </View>
        {tried && countBad ? <FieldError text={msg('backfill.badCount')} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={text(t.font.size.body)}>{msg('backfill.short')}</Text>
            <Text style={text(t.font.size.small, false, t.color.inkSoft)}>{msg('backfill.optional')}</Text>
          </View>
          {input('bf-short', short, setShort, tried && shortBad, msg('rec.kgUnit'))}
        </View>
        {tried && shortBad ? <FieldError text={msg('backfill.badKg')} /> : null}
        {tried && !countBad && !shortBad && !plan ? <FieldError text={msg('backfill.nothing')} /> : null}
      </Card>

      {plan ? (
        <Card testID="bf-plan">
          <Text style={text(t.font.size.bodyMd, true)}>{msg('backfill.will', { n: plan.baskets })}</Text>
          {plan.fullTo >= plan.fullFrom ? (
            <>
              {row(msg('backfill.fullRow'), msg('backfill.count', { n: plan.fullTo - plan.fullFrom + 1 }))}
              {row(
                plan.fullTo > plan.fullFrom ? msg('backfill.range', { from: plan.fullFrom, to: plan.fullTo }) : msg('backfill.one', { n: plan.fullFrom }),
                kg(plan.fullG),
                true,
              )}
            </>
          ) : null}
          {plan.shortNo !== null && plan.shortG !== null ? (
            <>
              {row(msg('backfill.shortRow'), msg('backfill.count', { n: 1 }))}
              {row(msg('backfill.one', { n: plan.shortNo }), kg(plan.shortG), true)}
            </>
          ) : null}
          <View style={{ borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.xs }}>
            {row(msg('backfill.total'), kg(plan.totalG))}
            <Text style={text(t.font.size.small, false, t.color.inkSoft)}>
              {tapperName && mode === 'per-tapper'
                ? msg('backfill.after', { name: tapperName, n: plan.lastNo })
                : msg('backfill.afterPoint', { n: plan.lastNo })}
            </Text>
          </View>
        </Card>
      ) : null}
    </FarmScreen>
  );
}
