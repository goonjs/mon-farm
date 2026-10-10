/**
 * ตั้งค่าวันขาย (E03-S07, mockup v1.1.0 screen 3): the group's sale settings
 * in one compact screen — scale type, basket numbering mode, net + basket
 * weight pairs with one default, zero check mode, and the duplicate window —
 * plus this device's hold time, labelled "เฉพาะเครื่องนี้" (D-79).
 *
 * Each change saves on its own, offline, as a master-data event; a sale
 * already started keeps the values it began with.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saleSettings, validDupWindow, validHoldMs, type SaleSettings } from '../core/master';
import type { NumberingMode, ZeroCheckMode } from '../core/types';
import { useT } from '../i18n';
import { readHoldMs, writeHoldMs } from '../store/hold-preference';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';
import { Button, Pill } from './chrome';
import { Card, Chip, ChipRow } from './farm-ui';

export function SaleSettingsForm() {
  const t = useTheme();
  const msg = useT();
  const [s, setS] = useState<SaleSettings | null>(null);
  const [holdMs, setHoldMs] = useState(readHoldMs);
  const [adding, setAdding] = useState(false);
  const [netKg, setNetKg] = useState(50);
  const [basketKg, setBasketKg] = useState(2);

  const reload = useCallback(() => {
    master.state().then((st) => setS(saleSettings(st)));
  }, []);
  useEffect(reload, [reload]);

  if (!s) return null;
  const save = async (fn: () => Promise<unknown>) => {
    await fn();
    reload();
  };
  const changeHold = (ms: number) => {
    if (!validHoldMs(ms)) return;
    writeHoldMs(ms);
    setHoldMs(ms);
  };
  const changeDup = (n: number) => {
    if (validDupWindow(n)) void save(() => master.updateSettings({ dupWindowS: n }));
  };

  const heading = (text: string) => (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{text}</Text>
  );
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };

  return (
    <View style={{ gap: t.space.md }}>
      <Card>
        {heading(msg('saleSettings.scale'))}
        <Option testID="scale-whole" on={s.scaleType === 'whole'} title={msg('saleSettings.scaleWhole')} onPress={() => undefined} />
        {/* One decimal is shown but not selectable yet (D-66). */}
        <Option testID="scale-decimal1" on={false} disabled title={msg('saleSettings.scaleDecimal')} onPress={() => undefined} />
      </Card>

      <Card>
        {heading(msg('saleSettings.numbering'))}
        {(['per-tapper', 'per-point'] as NumberingMode[]).map((m) => (
          <Option
            key={m}
            testID={`numbering-${m}`}
            on={s.numbering === m}
            title={msg(m === 'per-tapper' ? 'saleSettings.perTapper' : 'saleSettings.perPoint')}
            help={msg(m === 'per-tapper' ? 'saleSettings.perTapperHelp' : 'saleSettings.perPointHelp')}
            onPress={() => void save(() => master.updateSettings({ numbering: m }))}
          />
        ))}
      </Card>

      <Card>
        {heading(msg('saleSettings.pairs'))}
        {s.pairs.map((p) => (
          <View key={p.pairId} testID={`pair-${p.pairId}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, flexWrap: 'wrap' }}>
            <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
              {msg('saleSettings.pairRow', { net: p.netG / 1000, basket: p.basketG / 1000 })}
            </Text>
            {p.isDefault ? (
              <Pill tone="accept">{`✓ ${msg('saleSettings.default')}`}</Pill>
            ) : (
              <Button testID={`make-default-${p.pairId}`} onPress={() => void save(() => master.setDefaultPair(p.pairId))}>
                {msg('saleSettings.makeDefault')}
              </Button>
            )}
          </View>
        ))}
        {adding ? (
          <View style={{ gap: t.space.sm }}>
            <Stepper testID="new-net" label={msg('saleSettings.net')} value={`${netKg} ${msg('common.kg')}`} onLess={() => setNetKg((n) => Math.max(1, n - 1))} onMore={() => setNetKg((n) => n + 1)} />
            <Stepper testID="new-basket" label={msg('saleSettings.basket')} value={`${basketKg} ${msg('common.kg')}`} onLess={() => setBasketKg((n) => Math.max(0, n - 1))} onMore={() => setBasketKg((n) => n + 1)} />
            <Text style={small}>{msg('saleSettings.scaleShould', { n: netKg + basketKg })}</Text>
            <Button
              testID="save-pair"
              variant="primary"
              onPress={() =>
                void save(async () => {
                  await master.addPair(netKg, basketKg);
                  setAdding(false);
                })
              }
            >
              {msg('saleSettings.savePair')}
            </Button>
          </View>
        ) : (
          <Button testID="add-pair" onPress={() => setAdding(true)}>
            {msg('saleSettings.addPair')}
          </Button>
        )}
      </Card>

      <Card>
        {heading(msg('saleSettings.zero'))}
        <ChipRow>
          {(['every', 'first-per-farm', 'skip'] as ZeroCheckMode[]).map((z) => (
            <Chip
              key={z}
              testID={`zero-${z}`}
              label={msg(z === 'every' ? 'saleSettings.zeroEvery' : z === 'skip' ? 'saleSettings.zeroSkip' : 'saleSettings.zeroFirst')}
              on={s.zeroCheck === z}
              onPress={() => void save(() => master.updateSettings({ zeroCheck: z }))}
            />
          ))}
        </ChipRow>
      </Card>

      <Card>
        {heading(msg('saleSettings.hold'))}
        <Text testID="hold-device-only" style={small}>{msg('saleSettings.deviceOnly')}</Text>
        <Stepper
          testID="hold"
          value={msg('saleSettings.seconds', { n: (holdMs / 1000).toFixed(1) })}
          onLess={() => changeHold(holdMs - 100)}
          onMore={() => changeHold(holdMs + 100)}
        />
      </Card>

      <Card>
        {heading(msg('saleSettings.dup'))}
        <Text style={small}>{msg('saleSettings.dupHelp')}</Text>
        <Stepper
          testID="dup"
          value={msg('saleSettings.seconds', { n: s.dupWindowS })}
          onLess={() => changeDup(s.dupWindowS - 1)}
          onMore={() => changeDup(s.dupWindowS + 1)}
        />
      </Card>
    </View>
  );
}

function Option({
  testID,
  on,
  title,
  help,
  disabled,
  onPress,
}: {
  testID: string;
  on: boolean;
  title: string;
  help?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: t.target.min,
        justifyContent: 'center',
        padding: t.space.md,
        borderRadius: t.radius.md,
        borderWidth: on ? t.border.thick : t.border.hair,
        borderColor: on ? t.color.action : t.color.ruleStrong,
        borderStyle: disabled ? 'dashed' : 'solid',
        backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
        opacity: disabled ? t.opacity.disabled : 1,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
        {on ? `● ${title}` : `○ ${title}`}
      </Text>
      {help ? <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{help}</Text> : null}
    </Pressable>
  );
}

function Stepper({
  testID,
  label,
  value,
  onLess,
  onMore,
}: {
  testID: string;
  label?: string;
  value: string;
  onLess: () => void;
  onMore: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
      {label ? <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>{label}</Text> : null}
      <Button testID={`${testID}-less`} accessibilityLabel={msg('saleSettings.less')} onPress={onLess}>
        −
      </Button>
      <Text testID={`${testID}-value`} style={{ minWidth: 96, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.lead, fontWeight: t.font.weight.bold, color: t.color.ink }}>
        {value}
      </Text>
      <Button testID={`${testID}-more`} accessibilityLabel={msg('saleSettings.more')} onPress={onMore}>
        +
      </Button>
    </View>
  );
}
