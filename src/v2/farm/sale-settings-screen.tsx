/**
 * /v2/sale-settings — ตั้งค่าวันขาย (E03-S07, farm mockup 3): scale type,
 * basket numbering, net + basket pairs with one default, the empty-scale
 * check and the duplicate window — group settings, each saved on its own as
 * a master event; a sale already started keeps what it began with. The hold
 * time is this device's own and says so (D-79).
 */

import type { Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { maxInstallments, saleSettings, validDupWindow, validHoldMs } from '../../core/master';
import { MAX_INSTALLMENTS_LIMIT, MIN_INSTALLMENTS } from '../../core/finance/installments';
import type { NumberingMode, ZeroCheckMode } from '../../core/types';
import { useT } from '../../i18n';
import { readCountMode, readHoldMs, writeCountMode, writeHoldMs, type CountMode } from '../../store/hold-preference';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, Card, CardLabel, ChevronRight, Chip, FactRow, PersonIcon, Plus, RadioCard, SegmentedControl } from '../../ui';
import { Choice } from '../sale/closeout/summary-installments';
import { FarmScreen, HelpNote, SaveFailed, Stepper, useMaster, useWrite } from './pieces';

const ZERO: readonly ZeroCheckMode[] = ['every', 'first-per-farm', 'skip'];

export function SaleSettingsScreen() {
  const t = useTheme();
  const msg = useT();
  const { state, reload } = useMaster();
  const [holdMs, setHoldMs] = useState(readHoldMs);
  const [countMode, setCountMode] = useState<CountMode>(readCountMode);
  const [adding, setAdding] = useState(false);
  const [netKg, setNetKg] = useState(50);
  const [basketKg, setBasketKg] = useState(2);
  /** E06-S09 IP-21: the "ผ่อนหนี้ได้สูงสุด" sheet's pick (null = closed); no default inside — the current value is shown picked. */
  const [maxPick, setMaxPick] = useState<number | null>(null);

  const s = state ? saleSettings(state) : null;
  const write = useWrite();
  const save = async (fn: () => Promise<unknown>) => {
    if (await write.run(fn)) reload();
  };
  const changeHold = (ms: number) => {
    if (!validHoldMs(ms)) return;
    writeHoldMs(ms);
    setHoldMs(ms);
  };
  const changeDup = (n: number) => {
    if (validDupWindow(n)) void save(() => peopleStore.updateSettings({ dupWindowS: n }));
  };

  const example = (later: string) => (
    <View style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.sm, gap: t.space.xxs, alignSelf: 'flex-start' }}>
      <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{msg('v2f.example')}</FactRow>
      <View style={{ flexDirection: 'row', gap: t.space.md }}>
        <AppText variant="caption">{msg('v2f.exPoint1')}</AppText>
        <AppText variant="caption" style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {msg('v2f.exFirst')}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: t.space.md }}>
        <AppText variant="caption">{msg('v2f.exPoint2')}</AppText>
        <AppText variant="caption" style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {later}
        </AppText>
      </View>
    </View>
  );
  const weight = (label: string, kg: number) => (
    <View style={{ flex: 1 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{msg('v2f.kg', { n: kg })}</AppText>
    </View>
  );

  return (
    <FarmScreen
      title={msg('saleSettings.title')}
      subtitle={msg('saleSettings.subtitle')}
      fallback={'/v2/farm' as Href}
      failed={write.failed && !adding && maxPick === null}
      testID="sale-settings"
      overlay={
        <>
        <BottomSheet open={adding} onClose={() => setAdding(false)} title={msg('v2f.addPair')} testID="pair-sheet" action={{ label: msg('common.save'), testID: 'save-pair', saving: write.saving, onPress: () => void save(async () => { await peopleStore.addPair(netKg, basketKg); setAdding(false); }) }}>
          <AppText variant="bodySm">{msg('v2f.addPairHint')}</AppText>
          <AppText variant="label">{msg('saleSettings.net')}</AppText>
          <Stepper testID="new-net" label={msg('saleSettings.net')} value={String(netKg)} unit={msg('common.kg')} onLess={() => setNetKg((n) => Math.max(1, n - 1))} onMore={() => setNetKg((n) => n + 1)} />
          <AppText variant="label">{msg('v2f.basketEmpty')}</AppText>
          <Stepper testID="new-basket" label={msg('saleSettings.basket')} value={String(basketKg)} unit={msg('common.kg')} onLess={() => setBasketKg((n) => Math.max(0, n - 1))} onMore={() => setBasketKg((n) => n + 1)} />
          <AppText style={{ fontWeight: t.font.weight.semibold }}>{msg('saleSettings.scaleShould', { n: netKg + basketKg })}</AppText>
          <SaveFailed show={write.failed} />
        </BottomSheet>
        {maxPick !== null ? (
          <BottomSheet open onClose={() => setMaxPick(null)} title={msg('saleSettings.maxInstAsk')} testID="max-inst-sheet" action={{ label: msg('common.save'), testID: 'save-max-inst', saving: write.saving, onPress: () => void save(async () => { await peopleStore.updateSettings({ maxInstallments: maxPick }); setMaxPick(null); }) }}>
            <AppText variant="bodySm">{msg('saleSettings.maxInstHelp')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm }}>
              {Array.from({ length: MAX_INSTALLMENTS_LIMIT - MIN_INSTALLMENTS + 1 }, (_, k) => k + MIN_INSTALLMENTS).map((n) => (
                <Choice key={n} basis={56} grow={false} testID={`max-inst-${n}`} selected={maxPick === n} onPress={() => setMaxPick(n)}>
                  <AppText style={{ fontWeight: t.font.weight.bold, color: t.color.ink }}>{String(n)}</AppText>
                </Choice>
              ))}
            </View>
            <SaveFailed show={write.failed} />
          </BottomSheet>
        ) : null}
        </>
      }
    >
      {s ? (
        <>
          <Card>
            <CardLabel>{msg('saleSettings.scale')}</CardLabel>
            <RadioCard testID="scale-whole" selected={s.scaleType === 'whole'} title={msg('v2f.scaleWhole')} detail={msg('v2f.scaleWholeHint')} onPress={() => undefined} />
            {/* One decimal is shown but not selectable yet (D-66). */}
            <RadioCard testID="scale-decimal1" selected={false} disabled title={msg('v2f.scaleDecimal')} detail={msg('v2f.notReady')} onPress={() => undefined} />
          </Card>

          <Card>
            <CardLabel>{msg('saleSettings.numbering')}</CardLabel>
            {(['per-tapper', 'per-point'] as NumberingMode[]).map((m) => (
              <RadioCard
                key={m}
                testID={`numbering-${m}`}
                selected={s.numbering === m}
                title={msg(m === 'per-tapper' ? 'saleSettings.perTapper' : 'saleSettings.perPoint')}
                detail={msg(m === 'per-tapper' ? 'saleSettings.perTapperHelp' : 'saleSettings.perPointHelp')}
                onPress={() => void save(() => peopleStore.updateSettings({ numbering: m }))}
              >
                {example(msg(m === 'per-tapper' ? 'v2f.exPerTapper' : 'v2f.exPerPoint'))}
              </RadioCard>
            ))}
          </Card>

          <Card testID="pairs">
            <CardLabel>{msg('saleSettings.pairs')}</CardLabel>
            {s.pairs.map((p, i) => (
              <View
                key={p.pairId}
                testID={`pair-${p.pairId}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.space.sm,
                  paddingTop: i ? t.space.sm : 0,
                  borderTopWidth: i ? t.border.hair : 0,
                  borderTopColor: t.color.ruleFaint,
                }}
              >
                {weight(msg('saleSettings.net'), p.netG / 1000)}
                {weight(msg('v2f.basketEmpty'), p.basketG / 1000)}
                {p.isDefault ? (
                  <Chip tone="accept" label={msg('saleSettings.default')} />
                ) : (
                  <Button testID={`make-default-${p.pairId}`} onPress={() => void save(() => peopleStore.setDefaultPair(p.pairId))}>
                    {msg('saleSettings.makeDefault')}
                  </Button>
                )}
              </View>
            ))}
            <View style={{ alignSelf: 'flex-start' }}>
              <Button testID="add-pair" icon={(c) => <Plus color={c} size={14} />} onPress={() => setAdding(true)}>
                {msg('v2f.addPair')}
              </Button>
            </View>
          </Card>

          <Card>
            <CardLabel>{msg('saleSettings.zero')}</CardLabel>
            <SegmentedControl<ZeroCheckMode>
              testID="zero"
              value={s.zeroCheck}
              onChange={(z) => void save(() => peopleStore.updateSettings({ zeroCheck: z }))}
              options={ZERO.map((z) => ({ value: z, label: msg(z === 'every' ? 'saleSettings.zeroEvery' : z === 'skip' ? 'saleSettings.zeroSkip' : 'saleSettings.zeroFirst') }))}
            />
          </Card>

          <Card>
            <CardLabel>{msg('saleSettings.countMode')}</CardLabel>
            <FactRow testID="hold-device-only" icon={(c) => <PersonIcon color={c} size={12} />}>
              {msg('saleSettings.deviceOnly')}
            </FactRow>
            <SegmentedControl<CountMode>
              testID="count-mode"
              value={countMode}
              onChange={(m) => {
                writeCountMode(m);
                setCountMode(m);
              }}
              options={[
                { value: 'hold', label: msg('saleSettings.countHold') },
                { value: 'tap', label: msg('saleSettings.countTap') },
              ]}
            />
            {countMode === 'hold' ? <Stepper testID="hold" label={msg('saleSettings.hold')} value={(holdMs / 1000).toFixed(1)} unit={msg('v2f.secondsUnit')} onLess={() => changeHold(holdMs - 100)} onMore={() => changeHold(holdMs + 100)} /> : null}
          </Card>

          {/* E06-S09 IP-21: synced to every device (master settings_set); the whole row opens the choice (rule 11) */}
          <Card>
            <Pressable testID="max-inst-row" accessibilityRole="button" onPress={() => state && setMaxPick(maxInstallments(state))} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, minHeight: t.target.min }}>
              <AppText style={{ flex: 1, fontWeight: t.font.weight.bold }}>{msg('saleSettings.maxInst')}</AppText>
              <AppText testID="max-inst-value" style={{ fontWeight: t.font.weight.bold, color: t.color.inkSoft }}>{state ? msg('saleSettings.maxInstValue', { n: maxInstallments(state) }) : ''}</AppText>
              <ChevronRight color={t.color.inkSoft} size={12} />
            </Pressable>
          </Card>

          <Card>
            <CardLabel>{msg('saleSettings.dup')}</CardLabel>
            <HelpNote lines={[msg('saleSettings.dupHelp')]} />
            <Stepper testID="dup" label={msg('saleSettings.dup')} value={String(s.dupWindowS)} unit={msg('v2f.secondsUnit')} onLess={() => changeDup(s.dupWindowS - 1)} onMore={() => changeDup(s.dupWindowS + 1)} />
          </Card>
        </>
      ) : null}
    </FarmScreen>
  );
}
