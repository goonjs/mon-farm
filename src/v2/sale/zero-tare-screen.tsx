/**
 * /v2/sale/<id>/zero-tare — ก่อนชั่ง (sale mockup v1.1.0 pages 7, 7a–7c, 8c;
 * E04-S03): does the empty scale read 0, the basket weight, the net weight,
 * and what the scale should read for a full basket.
 *
 * Not 0 → enter what it reads and choose (D-75): wait for another scale
 * (nothing is weighed until a check passes) or accept the skew, which every
 * "ตาชั่งควรอ่าน" then includes on its own line until the next passing check.
 * A sale with a skew checks at every move, with no answer chosen for you
 * (D-76, page 8c). Every answer is an event in the sale log.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { compareEvents } from '../../core/order';
import { saleSkewG } from '../../core/scale-check';
import { tapperOn } from '../../core/master';
import { pointSetupPayloads } from '../../core/sale-points';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import {
  AlertIcon,
  AppText,
  BasketIcon,
  BottomSheet,
  cardStyle,
  Check,
  ClockIcon,
  CTA,
  FlagIcon,
  HourglassIcon,
  IconTile,
  LeafIcon,
  Plus,
  Scale,
  ScaleIcon,
} from '../../ui';
import { FarmScreen, Stepper } from '../farm/pieces';
import { Banner, Choice, IconLine, Kv, kgText, NumChip, SegOptions, SkewTag, useSaleView } from './pieces';
import { signed } from './move';

type Answer = 'zero' | 'not0';

export function ZeroTareScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ point?: string; net?: string; basket?: string; fill?: string }>();
  const view = useSaleView();
  const { saleId, events, state, master, day, settings, append, nameOf, reloadMaster } = view;
  const pointId = params.point ?? '';
  const [phase, setPhase] = useState<'ask' | 'wait' | 'skewed'>('ask');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [sheet, setSheet] = useState<'none' | 'not0' | 'pair'>('none');
  const [readingKg, setReadingKg] = useState(1);
  const [pick, setPick] = useState<{ netG: number; basketG: number } | null>(null);
  const [newNet, setNewNet] = useState(50);
  const [newBasket, setNewBasket] = useState(2);
  const back = `/v2/sale/${saleId}/point` as Href;

  const point = master?.points.find((p) => p.id === pointId);
  const farm = master?.properties.find((f) => f.id === point?.propertyId);
  if (!view.ready || !master || !settings || !point || !farm) return <FarmScreen title={msg('v2s.beforeTitle', { point: '' })} fallback={back} />;

  const tapper = tapperOn(master, pointId, day);
  const pile = state.piles.find((p) => p.id === pointId);
  const pair = pile ? { netG: pile.stdNetG, basketG: pile.tareG } : (pick ?? { netG: Number(params.net) || 50_000, basketG: Number(params.basket) || 2_000 });
  const skew = saleSkewG(events);
  // A skew taken at an earlier point: this is a move check (D-76) — nothing preselected.
  const moveWithSkew = skew !== 0 && phase === 'ask';
  const chosen: Answer | null = answer ?? (moveWithSkew ? null : 'zero');
  const skewFrom = (() => {
    const last = [...events].sort(compareEvents).filter((e) => e.kind === 'sys' && e.payload.t === 'skew_accepted').pop();
    const id = last && last.kind === 'sys' && last.payload.t === 'skew_accepted' ? last.payload.pileId : null;
    return master.points.find((p) => p.id === id)?.name ?? '';
  })();
  const kg = (g: number) => msg('v2f.kg', { n: kgText(g) });

  const ensurePile = () => {
    for (const payload of pointSetupPayloads(state, master, pointId, { pairId: '', netG: pair.netG, basketG: pair.basketG })) append({ kind: 'sys', payload });
  };
  const toCounter = () => router.replace(`/v2/sale/${saleId}/counter?point=${pointId}${params.fill ? `&fill=${params.fill}` : ''}` as Href);
  const start = () => {
    if (phase === 'ask') {
      if (chosen !== 'zero') return;
      ensurePile();
      append({ kind: 'sys', payload: { t: 'zero_check', pileId: pointId, ok: true, readingG: 0 } });
    }
    append({ kind: 'sys', payload: { t: 'tare_confirmed', pileId: pointId, tareG: pair.basketG } });
    append({ kind: 'sys', payload: { t: 'ready', pileId: pointId } });
    toCounter();
  };
  const failed = () => {
    ensurePile();
    append({ kind: 'sys', payload: { t: 'zero_check', pileId: pointId, ok: false, readingG: readingKg * 1000 } });
  };
  const wait = () => {
    failed();
    append({ kind: 'sys', payload: { t: 'scale_wait', pileId: pointId } });
    setSheet('none');
    setPhase('wait');
  };
  const acceptSkew = () => {
    failed();
    append({ kind: 'sys', payload: { t: 'skew_accepted', pileId: pointId, skewG: readingKg * 1000 } });
    setSheet('none');
    setPhase('skewed');
  };
  const choose = (a: Answer) => {
    setAnswer(a);
    if (a === 'not0') setSheet('not0');
  };

  const title = msg('v2s.beforeTitle', { point: point.name });
  const subtitle = msg('v2s.placeSub', { farm: farm.name, tapper: tapper ? nameOf(tapper) : msg('rec.noTapper') });
  const card = { ...cardStyle(t), padding: t.space.lg, gap: t.space.sm };
  const readingText = signed(String(readingKg));

  if (phase === 'wait') {
    return (
      <View testID="scale-wait" style={{ flex: 1, backgroundColor: t.color.surface, padding: t.layout.screenPaddingX }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space.lg }}>
          <HourglassIcon color={t.color.warn} size={72} />
          <Text accessibilityRole="header" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {msg('v2s.waitTitle')}
          </Text>
          <AppText style={{ textAlign: 'center' }}>{msg('v2s.waitL1')}</AppText>
          <AppText style={{ textAlign: 'center' }}>{msg('v2s.waitL2')}</AppText>
        </View>
        <View style={{ gap: t.space.sm, paddingBottom: t.space.md }}>
          <AppText variant="bodySm" style={{ textAlign: 'center' }}>
            {msg('v2s.waitOkHint')}
          </AppText>
          <CTA
            testID="wait-ok"
            onPress={() => {
              setAnswer(null);
              setPhase('ask');
            }}
          >
            {msg('gate.waitingOk')}
          </CTA>
        </View>
      </View>
    );
  }

  const basketRow = (
    <View style={{ ...cardStyle(t), paddingHorizontal: t.space.lg, paddingVertical: t.space.md, flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
      <IconTile tone="action" icon={(c) => <BasketIcon color={c} size={20} />} />
      <View style={{ flex: 1 }}>
        <AppText style={{ fontWeight: t.font.weight.semibold }}>{msg('v2s.basketWeight')}</AppText>
        <AppText variant="bodySm">{msg('v2s.fromSettings')}</AppText>
      </View>
      <Text testID="basket-kg" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
        {kg(pair.basketG)}
      </Text>
    </View>
  );

  return (
    <FarmScreen
      title={title}
      subtitle={subtitle}
      fallback={back}
      testID="zero-tare"
      footer={
        phase === 'skewed' || chosen === 'zero' ? (
          <CTA testID="start-weigh" onPress={start}>
            {msg('v2s.startWeigh')}
          </CTA>
        ) : (
          <CTA testID="start-weigh" disabled onPress={() => undefined}>
            {msg(moveWithSkew ? 'v2s.nextChoose' : 'v2s.startWeigh')}
          </CTA>
        )
      }
      overlay={
        <>
          <BottomSheet open={sheet === 'not0'} onClose={() => setSheet('none')} title={msg('v2s.not0Title')} testID="not0-sheet">
            <IconLine icon={(c) => <AlertIcon color={c} size={14} />}>{msg('v2s.not0Why')}</IconLine>
            <AppText variant="label">{msg('v2s.emptyReads')}</AppText>
            <Stepper
              testID="empty-reading"
              label={msg('v2s.emptyReads')}
              value={readingText}
              unit={msg('common.kg')}
              onLess={() => setReadingKg((n) => (n - 1 === 0 ? -1 : n - 1))}
              onMore={() => setReadingKg((n) => (n + 1 === 0 ? 1 : n + 1))}
            />
            <Choice testID="choose-wait" icon={(c) => <HourglassIcon color={c} size={20} />} title={msg('v2s.wait1')} lines={[msg('v2s.waitL1'), msg('v2s.waitL2')]} onPress={wait} />
            <Choice
              testID="choose-skew"
              icon={(c) => <Scale color={c} size={20} />}
              title={msg('v2s.skew2')}
              lines={[
                <Text key="a">
                  {msg('v2s.skewWord')} <NumChip>{`${readingText} ${msg('common.kg')}`}</NumChip>
                </Text>,
                msg('v2s.skewL2'),
                msg('v2s.skewL3'),
              ]}
              onPress={acceptSkew}
            />
          </BottomSheet>
          <BottomSheet open={sheet === 'pair'} onClose={() => setSheet('none')} title={msg('v2s.addPair')} testID="add-pair-sheet">
            <AppText variant="label">{msg('saleSettings.net')}</AppText>
            <Stepper testID="new-net" label={msg('saleSettings.net')} value={String(newNet)} unit={msg('common.kg')} onLess={() => setNewNet((n) => Math.max(1, n - 1))} onMore={() => setNewNet((n) => n + 1)} />
            <AppText variant="label">{msg('v2s.basketWeight')}</AppText>
            <Stepper testID="new-basket" label={msg('v2s.basketWeight')} value={String(newBasket)} unit={msg('common.kg')} onLess={() => setNewBasket((n) => Math.max(0, n - 1))} onMore={() => setNewBasket((n) => n + 1)} />
            <CTA
              testID="save-pair"
              onPress={() => {
                void peopleStore.addPair(newNet, newBasket).then(() => {
                  setPick({ netG: newNet * 1000, basketG: newBasket * 1000 });
                  reloadMaster();
                  setSheet('none');
                });
              }}
            >
              {msg('saleSettings.savePair')}
            </CTA>
          </BottomSheet>
        </>
      }
    >
      {phase === 'skewed' ? (
        <>
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
              <IconTile tone="cream" icon={(c) => <ScaleIcon color={c} size={20} />} />
              <View style={{ flex: 1, gap: t.space.xxs }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.emptyReadsKg', { skew: signed(kgText(skew)) })}</AppText>
                <SkewTag label={msg('v2s.skewAccepted')} />
              </View>
            </View>
          </View>
          {basketRow}
          <View testID="expect" style={card}>
            <Kv label={msg('v2s.net')} value={kg(pair.netG)} />
            <Kv label={msg('v2s.plusBasket')} value={kg(pair.basketG)} />
            <Kv tone="warn" label={msg('v2s.plusSkew')} value={kg(Math.abs(skew))} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.eqShould')}</AppText>
              <Text testID="expect-kg" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayXl + 8, fontWeight: t.font.weight.bold, color: t.color.action }}>
                {kgText(pair.netG + pair.basketG + skew)}
                <Text style={{ fontSize: t.font.size.bodyLg, color: t.color.inkSoft }}> {msg('common.kg')}</Text>
              </Text>
            </View>
          </View>
          <IconLine icon={(c) => <ClockIcon color={c} size={14} />}>{msg('v2s.skewUntil')}</IconLine>
        </>
      ) : (
        <>
          {moveWithSkew ? (
            <>
              <Banner tone="warn" icon={(c) => <ScaleIcon color={c} size={14} />} title={msg('v2s.moveCheck')} lines={[msg('v2s.moveCheckL1'), msg('v2s.moveCheckL2')]} />
              <View style={{ ...cardStyle(t), paddingHorizontal: t.space.lg, paddingVertical: t.space.md, flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
                <IconTile tone="cream" icon={(c) => <AlertIcon color={c} size={18} />} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: t.font.weight.semibold }}>{msg('v2s.skewInUse')}</AppText>
                  <AppText variant="bodySm">{msg('v2s.skewFrom', { point: skewFrom })}</AppText>
                </View>
                <SkewTag label={`${signed(kgText(skew))} ${msg('common.kg')}`} testID="skew-in-use" />
              </View>
            </>
          ) : null}
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
              <IconTile tone="action" icon={(c) => <ScaleIcon color={c} size={20} />} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingMd }}>{msg(moveWithSkew ? 'v2s.zeroQMove' : 'v2s.zeroQ')}</AppText>
                <AppText variant="bodySm">{msg('v2s.nothingOn')}</AppText>
              </View>
            </View>
            <SegOptions<Answer>
              testID="zero"
              value={chosen}
              onChange={choose}
              options={[
                { value: 'zero', label: msg('v2s.reads0'), icon: (c) => <Check color={c} size={12} /> },
                { value: 'not0', label: msg('v2s.not0'), icon: (c) => <FlagIcon color={c} size={14} /> },
              ]}
            />
          </View>
          {moveWithSkew ? (
            <View style={{ gap: t.space.xs }}>
              <IconLine icon={(c) => <Check color={c} size={10} />}>{msg('v2s.ok0Drops', { skew: kgText(skew) })}</IconLine>
              <IconLine icon={(c) => <FlagIcon color={c} size={12} />}>{msg('v2s.not0Enter')}</IconLine>
              <IconLine>{msg('v2s.not0Then')}</IconLine>
            </View>
          ) : (
            <>
              {basketRow}
              <View style={card}>
                <IconLine icon={(c) => <LeafIcon color={c} size={12} />}>{msg('start.pair')}</IconLine>
                <SegOptions<string>
                  testID="net"
                  value={pile ? String(pile.stdNetG) : `${pair.netG}/${pair.basketG}`}
                  onChange={(v) => {
                    if (v === '+') return setSheet('pair');
                    const [n, b] = v.split('/').map(Number);
                    setPick({ netG: n, basketG: b });
                  }}
                  options={
                    pile
                      ? [{ value: String(pile.stdNetG), label: kg(pile.stdNetG) }]
                      : [
                          ...settings.pairs.map((p) => ({ value: `${p.netG}/${p.basketG}`, label: kg(p.netG) })),
                          { value: '+', label: '', icon: (c: string) => <Plus color={c} size={14} /> },
                        ]
                  }
                />
              </View>
              <View testID="expect" style={{ ...card, alignItems: 'center' }}>
                <IconLine icon={(c) => <ScaleIcon color={c} size={14} />}>{msg('rec.shouldRead')}</IconLine>
                <Text testID="expect-kg" style={{ fontFamily: t.font.family.sans, fontSize: 56, fontWeight: t.font.weight.black, color: t.color.ink, fontVariant: ['tabular-nums'] }}>
                  {kgText(pair.netG + pair.basketG)}
                  <Text style={{ fontSize: t.font.size.headingLg, fontWeight: t.font.weight.semibold }}> {msg('common.kg')}</Text>
                </Text>
                <IconLine icon={(c) => <LeafIcon color={c} size={12} />}>{msg('v2s.expectNet', { kg: kgText(pair.netG) })}</IconLine>
                <AppText variant="bodySm">{msg('v2s.expectBasket', { kg: kgText(pair.basketG) })}</AppText>
              </View>
              <View style={{ gap: t.space.xs }}>
                <IconLine>{msg(`v2s.zeroHelp${settings.zeroCheck}` as 'v2s.zeroHelpevery')}</IconLine>
                <IconLine icon={(c) => <FlagIcon color={c} size={12} />}>{msg('v2s.not0Help')}</IconLine>
              </View>
            </>
          )}
        </>
      )}
    </FarmScreen>
  );
}
