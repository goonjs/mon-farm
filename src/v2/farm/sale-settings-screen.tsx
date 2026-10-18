/**
 * /v2/sale-settings — ตั้งค่าวันขาย (E03-S07, farm mockup 3): scale type,
 * basket numbering, net + basket pairs with one default, the empty-scale
 * check and the duplicate window — group settings, each saved on its own as
 * a master event; a sale already started keeps what it began with. The hold
 * time is this device's own and says so (D-79).
 */

import type { Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { saleSettings, validDupWindow, validHoldMs } from '../../core/master';
import type { NumberingMode, ZeroCheckMode } from '../../core/types';
import { useT } from '../../i18n';
import { readCountMode, readHoldMs, writeCountMode, writeHoldMs, type CountMode } from '../../store/hold-preference';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import { AppText, BottomSheet, Button, Card, CardLabel, Chip, FactRow, PersonIcon, Plus, RadioCard, SegmentedControl } from '../../ui';
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
      failed={write.failed && !adding}
      testID="sale-settings"
      overlay={
        <BottomSheet open={adding} onClose={() => setAdding(false)} title={msg('v2f.addPair')} testID="pair-sheet" action={{ label: msg('common.save'), testID: 'save-pair', saving: write.saving, onPress: () => void save(async () => { await peopleStore.addPair(netKg, basketKg); setAdding(false); }) }}>
          <AppText variant="bodySm">{msg('v2f.addPairHint')}</AppText>
          <AppText variant="label">{msg('saleSettings.net')}</AppText>
          <Stepper testID="new-net" label={msg('saleSettings.net')} value={String(netKg)} unit={msg('common.kg')} onLess={() => setNetKg((n) => Math.max(1, n - 1))} onMore={() => setNetKg((n) => n + 1)} />
          <AppText variant="label">{msg('v2f.basketEmpty')}</AppText>
          <Stepper testID="new-basket" label={msg('saleSettings.basket')} value={String(basketKg)} unit={msg('common.kg')} onLess={() => setBasketKg((n) => Math.max(0, n - 1))} onMore={() => setBasketKg((n) => n + 1)} />
          <AppText style={{ fontWeight: t.font.weight.semibold }}>{msg('saleSettings.scaleShould', { n: netKg + basketKg })}</AppText>
          <SaveFailed show={write.failed} />
        </BottomSheet>
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
