/**
 * /v2/sale/<id>/counter?point= — นับเข่ง, the recorder (sale mockup v1.1.0
 * pages 8, 8a, 8b, 10, 11, 13 and their skew versions; 12b; E04-S04/S05/S06/S09).
 *
 * Shows the current basket big, the tapper's (or the point's) figures —
 * done or the money so far (D-40, D-41), kg, the open short basket — and the
 * hold stage with what the scale should read (skew on its own line, D-75).
 * Hold = one full basket. "เข่งไม่เต็ม" opens the reading sheet (ruler and
 * ±, net derived, never accepted at or below the basket). A short basket
 * stays open: at its own point it waits ("รอเติม") or is closed as is; at the
 * same tapper's next point the stage fills it up (`?fill=full|part`, D-57).
 * A point deleted while the sale was open must be replaced first (D-65/67).
 * Every action is one event in the local log.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { compactBaht } from '../../core/compact-baht';
import { pointsOf, tapperOn } from '../../core/master';
import { saleSkewG } from '../../core/scale-check';
import { basketNetG } from '../../core/totals';
import { basketList } from '../../core/sale-points';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import {
  AlertIcon,
  AppText,
  BasketIcon,
  BottomSheet,
  Button,
  cardStyle,
  ChevronRight,
  ClockIcon,
  CTA,
  DotsIcon,
  FlagIcon,
  IconTile,
  LeafIcon,
  Minus,
  PinIcon,
  Plus,
  ScaleIcon,
  TapperIcon,
  TextField,
  Undo,
} from '../../ui';
import { FarmScreen } from '../farm/pieces';
import { countModel } from './count';
import { HoldButton, HoldStage } from './hold';
import { signed, useGoToPoint } from './move';
import { Banner, IconLine, Kv, kgText, NumChip, PointBar, farmTone, tapperTone, useLeaveIfClosed, useSaleView } from './pieces';
import { Ruler } from './ruler';
import { SaleOptionRows, SaleOptionSheets, type OptionSheet } from './sale-options';

type Sheet = 'none' | 'partial' | 'menu' | 'new-point' | 'undo-confirm' | OptionSheet;

/** The one-line confirmation under the stage: what a count recorded or an undo took back. */
interface Notice {
  /** A confirmation belongs to the point it was made at. */
  readonly pointId: string;
  readonly kind: 'recorded' | 'undone' | 'undone-part';
  readonly n: number;
  readonly kg?: string;
}

export function CounterScreen({ initialSheet = 'none' }: { initialSheet?: Sheet }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ point?: string; fill?: string }>();
  const view = useSaleView();
  const goTo = useGoToPoint(view);
  useLeaveIfClosed(view);
  const { saleId, events, state, master, day, mode, append, nameOf, saleTitle, reloadMaster } = view;
  const pointId = params.point ?? '';
  const [sheet, setSheet] = useState<Sheet>(initialSheet);
  const [readingKg, setReadingKg] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    if (notice === null) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const [newName, setNewName] = useState('');
  const base = `/v2/sale/${saleId}`;

  const point = master?.points.find((p) => p.id === pointId);
  const farm = master?.properties.find((f) => f.id === point?.propertyId);
  const model = countModel(view, pointId, params.fill);
  if (!view.ready || !master || !point || !farm || view.closed) return <FarmScreen title={msg('rec.title')} subtitle={saleTitle} fallback={'/v2/sales' as Href} />;
  if (!model) {
    return (
      <FarmScreen title={msg('rec.title')} subtitle={saleTitle} fallback={'/v2/sales' as Href} footer={<CTA testID="to-pick" onPress={() => router.replace(`${base}/point` as Href)}>{msg('pick.title')}</CTA>} />
    );
  }

  const tapper = tapperOn(master, pointId, day);
  const tapperName = tapper ? nameOf(tapper) : msg('rec.noTapper');
  const price = state.price?.satangPerKg ?? null;
  const { pile, figs, open, filling, waiting, fill, basketTare, ready } = model;
  const skew = saleSkewG(events);
  const std = pile.stdNetG;
  const tare = pile.tareG;
  const kg = (g: number) => msg('v2f.kg', { n: kgText(g) });
  const skewLabel = skew ? msg('v2s.skewTag', { skew: signed(kgText(skew)) }) : null;
  const place = msg('v2s.place', { farm: farm.name, point: point.name });
  const scopeTitle = 'tapperId' in figs.scope ? msg('rec.totalsOf', { name: nameOf(figs.scope.tapperId) }) : msg('rec.totalsOfPoint');

  // ── writes ── (one count path with public mode, review #1)
  const countFull = model.count;
  const early = model.early;
  // Undo needs the same hold as a count (E04-S15): the number comes back, none is skipped.
  const undo = () => {
    const last = events.find((e) => e.id === figs.lastId);
    if (last && (last.kind === 'accept' || last.kind === 'short')) {
      append({ kind: 'correction', pileId: last.pileId, targetId: last.id, mode: 'undo-last', reason: msg('rec.undo') });
      setNotice({ pointId, kind: last.partOf ? 'undone-part' : 'undone', n: last.basketNo ?? figs.currentNo - 1 });
    }
  };
  // The basket the undo would take back, named on the button and in the question.
  const lastBasket = events.find((e) => e.id === figs.lastId);
  const lastNo = lastBasket && (lastBasket.kind === 'accept' || lastBasket.kind === 'short') ? (lastBasket.basketNo ?? null) : null;
  // What the undo removes is exactly this event — a whole basket, or the top-up part of a short one.
  const lastIsPart = !!lastBasket && (lastBasket.kind === 'accept' || lastBasket.kind === 'short') && !!lastBasket.partOf;
  const lastKg = lastBasket && (lastBasket.kind === 'accept' || lastBasket.kind === 'short') ? kgText(basketNetG(lastBasket)) : '';
  const count = (input: 'hold' | 'hold-kbd') => {
    // Say what was written, and only when something was (a refused count announces nothing).
    const written = countFull(input);
    if (written) setNotice({ pointId, kind: 'recorded', n: written.basketNo, kg: kgText(written.netG) });
  };
  const closeOpen = () => open && append({ kind: 'sys', payload: { t: 'basket_closed', basketId: open.rootId, reason: 'scrap' } });

  // ── the short-basket sheet (page 10) ──
  // A whole-basket top-up weighs the open basket with its own tare (review #9).
  const bt = basketTare;
  const fullReadKg = (std + bt + skew) / 1000;
  const mark = filling && open && fill === 'part' ? (open.missingG + bt + skew) / 1000 : fullReadKg;
  const minKg = Math.ceil((bt + skew) / 1000) + 1;
  const maxKg = Math.round((bt + skew + std * 1.5) / 1000);
  const reading = readingKg ?? Math.max(minKg, Math.round(mark - (filling && fill === 'part' ? 5 : std / 1000 * 0.3)));
  const readingG = reading * 1000;
  // What the reading adds: a whole-basket top-up also weighs what was already in it.
  const heldG = filling && open && fill === 'full' ? open.haveG : 0;
  const netG = readingG - bt - skew - heldG;
  const lackG = (filling && open ? open.missingG : std) - netG;
  const tooLow = netG <= 0;
  const saveShort = () => {
    if (tooLow) return;
    const skewPart = skew ? { skewG: skew } : {};
    if (filling && open) {
      append({ kind: 'short', pileId: pointId, pointId, basketNo: open.basketNo, readingG, tareG: bt + heldG, partOf: open.rootId, ...skewPart });
    } else {
      append({ kind: 'short', pileId: pointId, pointId, basketNo: figs.currentNo, readingG, tareG: tare, ...skewPart });
    }
    setReadingKg(null);
    setSheet('none');
  };

  // ── the deleted point (page 12b) ──
  const others = tapper ? pointsOf(master, tapper, day).filter((p) => p.id !== pointId) : [];
  const mine = basketList(events).filter((r) => r.pointId === pointId && r.status === 'live');
  const nos = mine.map((r) => r.basketNo);
  const range = nos.length ? (Math.min(...nos) === Math.max(...nos) ? String(nos[0]) : `${Math.min(...nos)}–${Math.max(...nos)}`) : '';
  const createPoint = async () => {
    if (!newName.trim()) return;
    const p = await peopleStore.addPoint(farm.id, newName);
    if (tapper) await peopleStore.assignTapper(p.id, tapper, null);
    reloadMaster();
    setSheet('none');
    goTo(p.id, { replace: true });
  };

  const card = (child: React.ReactNode, key: string, warn = false) => (
    <View key={key} testID={`card-${key}`} style={{ flex: 1, ...cardStyle(t), padding: t.space.sm, gap: t.space.xxs, backgroundColor: warn ? t.color.warnSunk : t.color.surfaceRaised }}>
      {child}
    </View>
  );
  const figure = (value: string, unit?: string, testID?: string) => (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingXl, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
      {value}
      {unit ? <Text style={{ fontSize: t.font.size.caption, fontWeight: t.font.weight.regular, color: t.color.inkSoft }}> {unit}</Text> : null}
    </Text>
  );
  const smallLine = (text: string, tone: 'plain' | 'warn' = 'plain') => (
    <Text key={text} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: tone === 'warn' ? t.font.weight.bold : t.font.weight.regular, color: tone === 'warn' ? t.color.warn : t.color.ink, textAlign: 'center' }}>
      {text}
    </Text>
  );
  const shouldRead = (g: number) => (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.ink, textAlign: 'center' }}>
      {msg(skew ? 'v2s.eqShould' : 'rec.shouldRead')} <NumChip tone="scale" testID="should-read">{kg(g)}</NumChip>
    </Text>
  );

  const tool = (label: string, icon: (c: string) => React.ReactNode, onPress: () => void, testID: string, disabled?: boolean) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: t.space.xs, borderRadius: t.radius.md, borderWidth: t.border.hair, borderColor: t.color.ruleStrong, backgroundColor: t.color.surfaceRaised, borderStyle: disabled ? 'dashed' : 'solid' }}
    >
      {icon(disabled ? t.color.disabledInk : t.color.ink)}
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.semibold, color: disabled ? t.color.disabledInk : t.color.ink }}>{label}</Text>
    </Pressable>
  );

  const rootReading = (() => {
    const root = open ? events.find((e) => e.id === open.rootId) : undefined;
    return root && root.kind === 'short' ? root.readingG : null;
  })();

  return (
    <FarmScreen
      title={msg('rec.title')}
      subtitle={saleTitle}
      fallback={'/v2/sales' as Href}
      testID="counter"
      right={
        <Pressable testID="counter-menu" accessibilityRole="button" accessibilityLabel={msg('rec.menu')} onPress={() => setSheet('menu')} style={{ minWidth: t.target.min, minHeight: t.target.min, alignItems: 'center', justifyContent: 'center' }}>
          <DotsIcon color={t.color.appBarInk} size={18} />
        </Pressable>
      }
      footer={
        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          <HoldButton testID="tool-undo" label={msg('rec.undo')} a11yLabel={lastNo !== null ? msg('rec.undoA11y', { n: lastNo }) : undefined} hint={lastNo !== null ? msg('rec.undoHint', { n: lastNo }) : msg('rec.undoHold')} icon={(c) => <Undo color={c} size={16} />} onHold={(input) => (input === 'hold-kbd' ? setSheet('undo-confirm') : undo())} disabled={!figs.lastId || !ready} />
          {tool(msg('rec.history'), (c) => <ClockIcon color={c} size={20} />, () => router.push(`${base}/history?point=${pointId}` as Href), 'tool-history')}
          {tool(filling ? msg('fill.short') : msg('rec.short'), (c) => <ScaleIcon color={c} size={20} />, () => setSheet('partial'), 'tool-short', waiting || !ready)}
        </View>
      }
      overlay={
        <>
          <BottomSheet open={sheet === 'partial'} onClose={() => setSheet('none')} title={msg('v2s.shortOf', { n: filling && open ? open.basketNo : figs.currentNo })} testID="short-sheet">
            <View style={{ gap: t.space.xxs }}>
              <IconLine strong icon={(c) => <PinIcon color={c} size={14} />}>{place}</IconLine>
              <IconLine icon={(c) => <TapperIcon color={c} size={14} />}>{msg('v2s.tapperIs', { name: tapperName })}</IconLine>
            </View>
            <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: t.space.xs, borderWidth: t.border.thick, borderColor: t.color.ink, borderRadius: t.radius.md, paddingHorizontal: t.space.sm, paddingVertical: t.space.xxs }}>
              <ScaleIcon color={t.color.ink} size={16} />
              <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.scaleReads')}</AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.lg }}>
              <RoundButton testID="reading-less" label={msg('v2s.less1')} onPress={() => setReadingKg(Math.max(minKg, reading - 1))}>
                <Minus color={t.color.ink} size={20} />
              </RoundButton>
              <Text testID="reading" style={{ minWidth: 110, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: 52, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.ink }}>
                {reading}
                <Text style={{ fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.regular }}> {msg('common.kg')}</Text>
              </Text>
              <RoundButton testID="reading-more" label={msg('v2s.more1')} onPress={() => setReadingKg(Math.min(maxKg, reading + 1))}>
                <Plus color={t.color.ink} size={20} />
              </RoundButton>
            </View>
            <Ruler min={minKg} max={maxKg} mark={mark} value={reading} onChange={setReadingKg} />
            <AppText variant="caption" style={{ textAlign: 'center' }}>
              {msg('v2s.dragHint')}
            </AppText>
            <AppText variant="caption" style={{ textAlign: 'center' }}>
              {msg('v2s.rulerMax', { n: maxKg })}
            </AppText>
            {skew || heldG ? (
              <View style={{ ...cardStyle(t), padding: t.space.md }}>
                <Kv label={msg('v2s.scaleReads')} value={kg(readingG)} />
                <Kv label={msg('v2s.minusBasket')} value={kg(tare)} />
                {heldG ? <Kv label={msg('v2s.minusHave')} value={kg(heldG)} /> : null}
                {skew ? <Kv tone="warn" label={msg('v2s.skewWord')} value={`${signed(kgText(-skew))} ${msg('common.kg')}`} /> : null}
                <Kv tone="total" label={msg('v2s.eqNet')} value={kg(netG)} testID="short-net" />
                <Kv label={msg('v2s.lackingFull', { n: kgText(std) })} value={kg(Math.max(0, lackG))} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                {card(
                  <>
                    <IconLine icon={(c) => <LeafIcon color={c} size={12} />}>{msg('v2s.net')}</IconLine>
                    {figure(kgText(netG), msg('common.kg'), 'short-net')}
                    <AppText variant="caption">{msg('v2s.netLine', { reading, tare: kgText(tare) })}</AppText>
                  </>,
                  'net',
                )}
                {card(
                  <>
                    <AppText variant="bodySm">{msg('v2s.lacking')}</AppText>
                    {figure(kgText(Math.max(0, lackG)), msg('common.kg'))}
                    <AppText variant="caption">{msg('v2s.untilFull', { n: kgText(filling && open ? open.missingG : std) })}</AppText>
                  </>,
                  'lack',
                )}
              </View>
            )}
            {tooLow ? (
              <Banner tone="bad" icon={(c) => <AlertIcon color={c} size={14} />} lines={[msg('v2s.tooLow')]} testID="short-too-low" />
            ) : null}
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID="short-cancel" onPress={() => setSheet('none')}>
                  {msg('common.cancel')}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="short-save" variant="primary" disabled={tooLow} onPress={saveShort}>
                  {msg('common.save')}
                </Button>
              </View>
            </View>
          </BottomSheet>

          <BottomSheet open={sheet === 'menu'} onClose={() => setSheet('none')} title={msg('rec.menu')} testID="menu-sheet">
            <Button variant="row" testID="menu-public" onPress={() => { setSheet('none'); router.push(`${base}/public?point=${pointId}${params.fill ? `&fill=${params.fill}` : ''}` as Href); }}>
              {msg('rec.public')}
            </Button>
            <Button variant="row" testID="menu-backfill" onPress={() => { setSheet('none'); router.push(`${base}/point?mode=backfill&farm=${farm.id}${tapper ? `&tapper=${tapper}` : ''}` as Href); }}>
              {msg('backfill.title')}
            </Button>
            <Button variant="row" testID="menu-finish" onPress={() => { setSheet('none'); router.push(`${base}/check` as Href); }}>
              {msg('rec.finish')}
            </Button>
            <SaleOptionRows view={view} pick={setSheet} />
            <Button variant="row" testID="menu-sales" onPress={() => { setSheet('none'); router.push('/v2/sales' as Href); }}>
              {msg('v2.sales')}
            </Button>
          </BottomSheet>

          <BottomSheet open={sheet === 'undo-confirm' && lastNo !== null} onClose={() => setSheet('none')} title={lastNo !== null ? msg(lastIsPart ? 'rec.undoPartAsk' : 'rec.undoAsk', { n: lastNo }) : undefined} testID="undo-confirm">
            {lastNo !== null ? <AppText>{msg(lastIsPart ? 'rec.undoPartBody' : 'rec.undoAskBody', { n: lastNo, kg: lastKg })}</AppText> : null}
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID="undo-confirm-no" onPress={() => setSheet('none')}>
                  {msg('common.cancel')}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  testID="undo-confirm-yes"
                  variant="primary"
                  onPress={() => {
                    setSheet('none');
                    undo();
                  }}
                >
                  {lastNo !== null ? (lastIsPart ? msg('rec.undoPartDo') : msg('rec.undoDo', { n: lastNo })) : msg('rec.undo')}
                </Button>
              </View>
            </View>
          </BottomSheet>

          <SaleOptionSheets view={view} open={sheet === 'price' || sheet === 'info' || sheet === 'delete' ? sheet : 'none'} onClose={() => setSheet('none')} />

          <BottomSheet open={point.hidden && sheet !== 'new-point'} onClose={() => router.replace('/v2/sales' as Href)} title={msg('v2s.pointGoneTitle', { point: point.name })} testID="point-gone">
            <View style={{ gap: t.space.xxs }}>
              <IconLine icon={(c) => <AlertIcon color={c} size={14} />}>{msg('v2s.pointGoneLock')}</IconLine>
              {nos.length ? (
                <IconLine icon={(c) => <BasketIcon color={c} size={14} />}>
                  {msg('v2s.pointGoneKept', { range, kg: kgText(mine.reduce((s, r) => s + r.netG, 0)), point: point.name })}
                </IconLine>
              ) : null}
            </View>
            <View style={{ ...cardStyle(t), paddingHorizontal: t.space.md }}>
              {others.map((p) => (
                <Pressable key={p.id} testID={`gone-pick-${p.id}`} accessibilityRole="button" onPress={() => goTo(p.id, { replace: true })} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.sm }}>
                  <IconTile tone={farmTone(master, p.propertyId)} icon={(c) => <PinIcon color={c} size={20} />} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: t.font.weight.bold }}>{p.name}</AppText>
                    <AppText variant="bodySm">{msg('v2s.tapperIs', { name: tapperName })}</AppText>
                  </View>
                  <ChevronRight color={t.color.inkSoft} />
                </Pressable>
              ))}
              <Pressable testID="gone-new" accessibilityRole="button" onPress={() => setSheet('new-point')} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.sm }}>
                <IconTile tone="action" icon={(c) => <Plus color={c} size={18} />} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.newPoint')}</AppText>
                  <AppText variant="bodySm">{msg('v2s.newPointIn', { farm: farm.name })}</AppText>
                  <AppText variant="bodySm">{msg('v2s.newPointNow')}</AppText>
                </View>
                <ChevronRight color={t.color.inkSoft} />
              </Pressable>
            </View>
          </BottomSheet>
          <BottomSheet open={sheet === 'new-point'} onClose={() => setSheet('none')} title={msg('v2s.newPoint')} testID="new-point-sheet">
            <TextField testID="new-point-name" label={msg('v2s.newPointName')} value={newName} onChangeText={setNewName} />
            <CTA testID="new-point-save" disabled={!newName.trim()} onPress={() => void createPoint()}>
              {msg('v2s.create')}
            </CTA>
          </BottomSheet>
        </>
      }
    >
      <PointBar
        place={place}
        farmToneName={farmTone(master, farm.id)}
        tapper={tapperName}
        tapperToneName={tapperTone(master, tapper)}
        skew={skewLabel}
        onSwitch={() => router.push(`${base}/point?mode=switch&farm=${farm.id}${tapper ? `&tapper=${tapper}` : ''}` as Href)}
      />
      {!tapper ? (
        <Banner tone="warn" icon={(c) => <AlertIcon color={c} size={14} />} title={msg('v2s.noTapperTitle')} lines={[msg('v2s.noTapperL1'), msg('v2s.assignFirst')]} testID="no-tapper">
          <View style={{ marginTop: t.space.xs }}>
            <Button testID="assign-now" icon={(c) => <TapperIcon color={c} size={14} />} onPress={() => router.push(`/v2/point/${pointId}?plan=1` as Href)}>
              {msg('v2s.assignNow')}
            </Button>
          </View>
        </Banner>
      ) : null}
      <View testID="current" accessibilityLabel={`${msg('rec.current')} ${figs.currentNo}`} style={{ ...cardStyle(t), alignItems: 'center', paddingVertical: t.space.md }}>
        <AppText variant="bodySm">{msg('rec.current')}</AppText>
        <Text testID="current-no" style={{ fontFamily: t.font.family.sans, fontSize: 80, lineHeight: 88, fontWeight: t.font.weight.black, fontVariant: ['tabular-nums'], color: t.color.numeral }}>
          {figs.currentNo}
        </Text>
        {price !== null ? <AppText variant="bodySm">{msg('rec.counted', { n: figs.done })}</AppText> : null}
      </View>
      <IconLine icon={(c) => <TapperIcon color={c} size={13} />}>{scopeTitle}</IconLine>
      <View style={{ flexDirection: 'row', gap: t.space.sm }}>
        {price !== null
          ? card(<><AppText variant="bodySm">{msg('rec.money')}</AppText>{figure(compactBaht(figs.satang ?? 0), '฿', 'fig-money')}</>, 'first')
          : card(<><AppText variant="bodySm">{msg('rec.done')}</AppText>{figure(String(figs.done), msg('rec.baskets'), 'fig-done')}</>, 'first')}
        {card(
          <>
            <IconLine icon={(c) => <LeafIcon color={c} size={12} />}>{msg('rec.kg')}</IconLine>
            {figure(kgText(figs.netG), msg('common.kg'), 'fig-kg')}
          </>,
          'kg',
        )}
        {open
          ? card(
              <>
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodySm, fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('rec.shortOf', { n: open.basketNo })}</Text>
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.caption, fontWeight: t.font.weight.bold, color: t.color.warn }}>{msg('rec.missing')}</Text>
                {figure(kgText(open.missingG), msg('common.kg'), 'fig-missing')}
              </>,
              'short',
              true,
            )
          : card(<><AppText variant="bodySm">{msg('rec.short')}</AppText><AppText style={{ fontWeight: t.font.weight.bold }}>{msg('rec.none')}</AppText></>, 'short')}
      </View>

      {waiting && open ? (
        <View testID="open-card" style={{ ...cardStyle(t), backgroundColor: t.color.warnSunk, padding: t.space.lg, gap: t.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
            <IconTile tone="neutral" icon={(c) => <ScaleIcon color={c} size={18} />} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: t.font.weight.bold }}>{skew ? msg('v2s.openNo', { n: open.basketNo }) : msg('rec.openCard', { n: open.basketNo, kg: kgText(open.haveG) })}</AppText>
              {rootReading !== null ? (
                <AppText variant="bodySm">
                  {skew
                    ? msg('v2s.openReadingSkew', { reading: kgText(rootReading), tare: kgText(tare), skew: signed(kgText(skew)), net: kgText(open.haveG) })
                    : msg('v2s.openReading', { reading: kgText(rootReading), tare: kgText(tare) })}
                </AppText>
              ) : null}
            </View>
          </View>
          <Button testID="close-open" icon={(c) => <FlagIcon color={c} size={14} />} onPress={closeOpen}>
            {msg('rec.closeBasket')}
          </Button>
        </View>
      ) : null}

      {!ready ? (
        <View testID="not-ready" style={{ ...cardStyle(t), borderWidth: t.border.thick, borderColor: t.color.ruleStrong, alignItems: 'center', padding: t.space.lg, gap: t.space.sm }}>
          <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2s.notReady')}</AppText>
          <Button testID="to-check" icon={(c) => <ScaleIcon color={c} size={14} />} onPress={() => router.replace(`${base}/zero-tare?point=${pointId}&net=${std}&basket=${tare}` as Href)}>
            {msg('v2s.startWeigh')}
          </Button>
        </View>
      ) : waiting && open ? (
        <View testID="stage-wait" style={{ ...cardStyle(t), borderWidth: t.border.thick, borderColor: t.color.ruleStrong, alignItems: 'center', padding: t.space.lg, gap: t.space.xs }}>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>{msg('rec.waitFill', { n: open.basketNo })}</Text>
          <AppText variant="bodySm">{tapper && mode === 'per-tapper' ? msg('rec.waitFillHint', { name: tapperName }) : msg('rec.waitFillPoint')}</AppText>
        </View>
      ) : (
        <HoldStage testID="hold" label={filling && open ? msg('v2s.fillStage', { n: open.basketNo }) : msg('rec.hold')} onHold={count} onEarly={early} minHeight={filling ? 150 : 120}>
          {filling && open ? (
            <>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                {msg(fill === 'full' ? 'v2s.fillStage' : 'v2s.fillStagePart', { n: open.basketNo })}
              </Text>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.semibold, color: t.color.ink }}>
                {msg('v2s.fillMore')} <Text style={{ fontSize: 36, fontWeight: t.font.weight.black }}>{kgText(open.missingG)}</Text> {msg('common.kg')}
              </Text>
              {fill === 'full' && skew ? [smallLine(msg('v2s.fullLine', { n: kgText(std) })), smallLine(msg('v2s.lineBasket', { n: kgText(open.tareG) })), smallLine(msg('v2s.lineSkew', { n: signed(kgText(skew)) }), 'warn')] : null}
              {shouldRead(fill === 'full' ? std + open.tareG + skew : open.missingG + tare + skew)}
              <AppText variant="bodySm">{msg('v2s.thenHold')}</AppText>
              {fill === 'full' ? <AppText variant="bodySm">{msg('v2s.fillSum', { have: kgText(open.haveG), add: kgText(open.missingG), total: kgText(open.haveG + open.missingG) })}</AppText> : null}
            </>
          ) : (
            <>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingLg, fontWeight: t.font.weight.bold, color: t.color.ink, textAlign: 'center' }}>{msg('rec.hold')}</Text>
              {skew ? [smallLine(msg('v2s.lineNet', { n: kgText(std) })), smallLine(msg('v2s.lineBasket', { n: kgText(tare) })), smallLine(msg('v2s.lineSkew', { n: signed(kgText(skew)) }), 'warn')] : null}
              {shouldRead(std + tare + skew)}
            </>
          )}
        </HoldStage>
      )}
      {/* Always mounted, only its text changes, so web and TalkBack announce each confirmation. */}
      <View accessibilityLiveRegion="polite" accessibilityRole="alert">
        {notice !== null && notice.pointId === pointId ? (
          notice.kind !== 'recorded' ? (
            <IconLine testID="undo-notice" icon={(c) => <Undo color={c} size={13} />}>
              {msg(notice.kind === 'undone-part' ? 'rec.undonePart' : 'rec.undone', { n: notice.n })}
            </IconLine>
          ) : (
            <IconLine testID="count-notice" icon={(c) => <BasketIcon color={c} size={13} />}>
              {msg('rec.recorded', { n: notice.n, kg: notice.kg ?? '' })}
            </IconLine>
          )
        ) : null}
      </View>
    </FarmScreen>
  );
}

function RoundButton({ children, onPress, label, testID }: { children: React.ReactNode; onPress: () => void; label: string; testID: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 64, height: 64, borderRadius: 32, borderWidth: t.border.thick, borderColor: t.color.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.surfaceRaised }}
    >
      {children}
    </Pressable>
  );
}
