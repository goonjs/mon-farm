/**
 * The recorder's counting screen at a weighing point (E04-S05, mockup v1.1.0
 * screen 8): portrait, one hand, the six values that keep basket numbers
 * straight (SALE-14, D-40).
 *
 * - Top bar: back, "นับเข่ง", the sale's date, sync state, ⋯ menu.
 * - Point card: farm · point and its tapper — only here (owner ?10) — with
 *   "เปลี่ยนจุด" one tap away.
 * - Big card: the basket being weighed now; with a price set it also says how
 *   many are done, because the first small card turns into money (D-40).
 * - Three cards: done (or money, compact ฿ D-41) · kg so far · short basket.
 * - Hold area: the words only — no number in it (D-40) — and what the scale
 *   should read.
 * - Bottom row: short basket, undo, public mode. "ชั่งครบแล้ว → ตรวจยอด"
 *   sits in the ⋯ menu, far from the hold area.
 *
 * Presentational: the counter screen owns the log and passes figures in.
 */

import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { compactBaht } from '../core/compact-baht';
import { formatKg } from '../core/settle';
import type { RecorderFigures } from '../core/sale-points';
import type { SaleStatus } from '../core/types';
import { useT } from '../i18n';
import { useTheme } from '../theme';
import { HoldStage, type HoldStageProps } from './HoldStage';

export interface RecorderBasket {
  readonly id: string;
  readonly basketNo: number;
  readonly pointName: string;
  readonly netG: number;
  readonly short: boolean;
  /** Voided rows stay, struck through ✗ (E04-S09). */
  readonly status: 'live' | 'voided';
  readonly edited: boolean;
}

export interface RecorderViewProps {
  readonly saleDate: string;
  /** Events of this sale not sent yet (SYNC-3). */
  readonly pending: number;
  readonly farmName: string;
  readonly pointName: string;
  readonly tapperName: string | null;
  readonly figures: RecorderFigures;
  readonly expectedKg: string;
  readonly hold: Pick<HoldStageProps, 'onCount' | 'onReject' | 'enabled' | 'holdMs'>;
  readonly baskets: readonly RecorderBasket[];
  readonly onBack: () => void;
  readonly onSwitch: () => void;
  readonly onShort: () => void;
  readonly onUndo: () => void;
  readonly onPublic: () => void;
  readonly onFinish: () => void;
  readonly canUndo: boolean;
  /** Shown under the hold area instead of the bottom row (undo confirm, short basket panel). */
  readonly below?: ReactNode;
  /** A live row was tapped in the list: edit or void it (E04-S09). */
  readonly onRowPress?: (id: string) => void;
  /** The row editor, shown in the list sheet in place of the rows while open. */
  readonly editor?: ReactNode;
  /** The sale's business status (E04-S11), as a chip under the title. */
  readonly status?: SaleStatus;
  /** More ⋯ menu entries (E04-S11: complete / cancel the sale). */
  readonly menuItems?: readonly { testID: string; label: string; onPress: () => void; disabled?: boolean; hint?: string }[];
  /** Over everything: a prompt that must be answered first (E04-S11 money reason, cancel confirm). */
  readonly overlay?: ReactNode;
}

export function RecorderView(props: RecorderViewProps) {
  const t = useT();
  const th = useTheme();
  const [menu, setMenu] = useState(false);
  const [list, setList] = useState(false);
  const f = props.figures;
  const money = f.satang !== null;

  const text = (size: number, weight: 'regular' | 'bold' | 'black' = 'regular', color = th.color.ink) => ({
    fontFamily: th.font.family.sans,
    fontSize: size,
    fontWeight: th.font.weight[weight],
    color,
  });
  const card = {
    backgroundColor: th.color.surfaceRaised,
    borderRadius: th.radius.lg,
    borderWidth: th.border.hair,
    borderColor: th.color.ruleFaint,
    padding: th.space.md,
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.color.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: th.space.sm, paddingHorizontal: th.space.md, paddingVertical: th.space.sm }}>
        <Pressable
          testID="rec-back"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={props.onBack}
          style={{ minWidth: th.target.min, minHeight: th.target.min, justifyContent: 'center' }}
        >
          <Text style={text(th.font.size.headingLg)}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={text(th.font.size.headingLg, 'bold')}>{t('rec.title')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: th.space.xs }}>
            <Text style={text(th.font.size.caption, 'regular', th.color.inkSoft)}>{t('rec.saleOf', { date: props.saleDate })}</Text>
            {props.status ? (
              <Text
                testID="rec-status"
                style={[
                  text(th.font.size.caption, 'bold', props.status === 'cancelled' ? th.color.reject : props.status === 'completed' ? th.color.accept : th.color.inkSoft),
                  { paddingHorizontal: th.space.xs, borderRadius: th.radius.sm, borderWidth: th.border.hair, borderColor: th.color.rule },
                ]}
              >
                {t(`status.${props.status}`)}
              </Text>
            ) : null}
          </View>
        </View>
        <View
          testID="rec-sync"
          style={{
            paddingHorizontal: th.space.sm,
            paddingVertical: th.space.xs,
            borderRadius: th.radius.pill,
            backgroundColor: props.pending ? th.color.warnSunk : th.color.acceptSunk,
          }}
        >
          <Text style={text(th.font.size.small, 'bold', props.pending ? th.color.warn : th.color.accept)}>
            {props.pending ? `◑ ${t('rec.pending', { n: props.pending })}` : `✓ ${t('rec.synced')}`}
          </Text>
        </View>
        <Pressable
          testID="rec-menu"
          accessibilityRole="button"
          accessibilityLabel={t('rec.menu')}
          onPress={() => setMenu((m) => !m)}
          style={{ minWidth: th.target.min, minHeight: th.target.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={text(th.font.size.headingLg, 'bold')}>⋯</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: th.space.md, gap: th.space.sm }}>
        <View style={[card, { gap: th.space.xs }]}>
          <Text testID="rec-point" style={text(th.font.size.headingMd, 'bold')}>
            {`⊙ ${props.farmName} · ${props.pointName}`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: th.space.sm }}>
            <Text testID="rec-tapper" style={[text(th.font.size.body, 'regular', props.tapperName ? th.color.inkSoft : th.color.warn), { flex: 1 }]}>
              {props.tapperName ?? `⚠ ${t('rec.noTapper')}`}
            </Text>
            <Pressable
              testID="rec-switch"
              accessibilityRole="button"
              onPress={props.onSwitch}
              style={{
                minHeight: th.target.min,
                justifyContent: 'center',
                paddingHorizontal: th.space.lg,
                borderRadius: th.radius.pill,
                borderWidth: th.border.thick,
                borderColor: th.color.action,
              }}
            >
              <Text style={text(th.font.size.body, 'bold', th.color.action)}>{`⇄ ${t('rec.switch')}`}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[card, { alignItems: 'center' }]}>
          <Text style={text(th.font.size.small, 'regular', th.color.inkSoft)}>{t('rec.current')}</Text>
          <Text
            testID="rec-current"
            accessibilityLiveRegion="polite"
            style={[text(th.font.size.figure * 1.4, 'black', th.color.numeral), { fontVariant: ['tabular-nums'] }]}
          >
            {f.currentNo}
          </Text>
          {money ? (
            <Text testID="rec-counted" style={text(th.font.size.small, 'regular', th.color.inkSoft)}>
              {t('rec.counted', { n: f.done })}
            </Text>
          ) : null}
        </View>

        <Text testID="rec-totals-of" style={text(th.font.size.small, 'regular', th.color.inkSoft)}>
          {'tapperId' in f.scope && props.tapperName ? t('rec.totalsOf', { name: props.tapperName }) : t('rec.totalsOfPoint')}
        </Text>
        <View style={{ flexDirection: 'row', gap: th.space.sm }}>
          <SmallCard
            testID="rec-card-1"
            label={money ? t('rec.money') : t('rec.done')}
            value={money ? compactBaht(f.satang!) : String(f.done)}
            unit={money ? '฿' : t('rec.baskets')}
          />
          <SmallCard testID="rec-card-kg" label={t('rec.kg')} value={formatKg(f.netG)} unit={t('rec.kgUnit')} />
          <SmallCard
            testID="rec-card-short"
            label={t('rec.short')}
            value={f.openShortG === null ? t('rec.none') : formatKg(f.openShortG)}
            unit={f.openShortG === null ? '' : t('rec.kgUnit')}
          />
        </View>

        <View style={{ flex: 1, minHeight: 160, borderRadius: th.radius.lg, overflow: 'hidden', borderWidth: th.border.thick, borderColor: th.color.ruleStrong }}>
          <HoldStage
            count={f.currentNo}
            {...props.hold}
            label={t('rec.hold')}
            caption={`${t('rec.shouldRead')} ${props.expectedKg} ${t('rec.kgUnit')}`}
          />
        </View>
      </View>

      {props.below ?? (
        <View style={{ flexDirection: 'row', gap: th.space.sm, padding: th.space.md }}>
          <BottomButton testID="rec-short" icon="⚖" label={t('rec.short')} onPress={props.onShort} enabled={props.hold.enabled !== false} />
          <BottomButton testID="rec-undo" icon="↺" label={t('rec.undo')} onPress={props.onUndo} enabled={props.canUndo} />
          <BottomButton testID="rec-public" icon="⛶" label={t('rec.public')} onPress={props.onPublic} />
        </View>
      )}

      {menu ? (
        <View
          testID="rec-menu-sheet"
          style={[card, { position: 'absolute', top: th.target.min + th.space.lg, right: th.space.md, gap: th.space.xs, minWidth: 240 }]}
        >
          <MenuItem testID="rec-menu-list" label={t('rec.list')} onPress={() => { setMenu(false); setList(true); }} />
          <MenuItem testID="rec-menu-finish" label={t('rec.finish')} onPress={() => { setMenu(false); props.onFinish(); }} />
          {(props.menuItems ?? []).map((m) => (
            <View key={m.testID}>
              <MenuItem testID={m.testID} label={m.label} disabled={m.disabled} onPress={() => { setMenu(false); m.onPress(); }} />
              {m.hint ? <Text style={[text(th.font.size.small, 'regular', th.color.inkSoft), { paddingHorizontal: th.space.sm }]}>{m.hint}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {list ? (
        // A sheet over the lower half: the point card and the big number stay in view.
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '50%',
            backgroundColor: th.color.surfaceRaised,
            borderTopLeftRadius: th.radius.xxl,
            borderTopRightRadius: th.radius.xxl,
            borderTopWidth: th.border.hair,
            borderColor: th.color.rule,
            padding: th.space.md,
            gap: th.space.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[text(th.font.size.headingMd, 'bold'), { flex: 1 }]}>{t('rec.list')}</Text>
            <MenuItem testID="rec-list-close" label={t('rec.listClose')} onPress={() => setList(false)} />
          </View>
          <ScrollView testID="rec-list">
            {props.editor ?? null}
            {!props.editor && props.baskets.length === 0 ? (
              <Text style={text(th.font.size.body, 'regular', th.color.inkSoft)}>{t('rec.listEmpty')}</Text>
            ) : null}
            {props.editor
              ? null
              : props.baskets.map((b) => {
                  const voided = b.status === 'voided';
                  const struck = voided ? ({ textDecorationLine: 'line-through', color: th.color.inkSoft } as const) : null;
                  return (
                    <Pressable
                      key={b.id}
                      testID={`rec-row-${b.basketNo}`}
                      accessibilityRole="button"
                      disabled={voided || !props.onRowPress}
                      onPress={() => props.onRowPress?.(b.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: th.space.sm,
                        minHeight: th.target.min,
                        borderBottomWidth: th.border.hair,
                        borderColor: th.color.ruleFaint,
                      }}
                    >
                      <Text style={[text(th.font.size.body, 'bold'), { minWidth: 48, fontVariant: ['tabular-nums'] }, struck]}>
                        {voided ? `✗ #${b.basketNo}` : `#${b.basketNo}`}
                      </Text>
                      <Text style={[text(th.font.size.body), { flex: 1 }, struck]}>{b.short ? `${b.pointName} · ${t('rec.short')}` : b.pointName}</Text>
                      <Text style={[text(th.font.size.body), { fontVariant: ['tabular-nums'] }, struck]}>{`${formatKg(b.netG)} ${t('rec.kgUnit')}`}</Text>
                      {b.edited || voided ? (
                        <Text style={text(th.font.size.small, 'bold', voided ? th.color.reject : th.color.warn)}>
                          {voided ? t('rec.voided') : t('rec.edited')}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
          </ScrollView>
        </View>
      ) : null}

      {props.overlay ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: th.space.md }}>{props.overlay}</View>
      ) : null}
    </View>
  );
}

function SmallCard({ testID, label, value, unit }: { testID: string; label: string; value: string; unit: string }) {
  const th = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: th.color.surfaceRaised,
        borderRadius: th.radius.md,
        borderWidth: th.border.hair,
        borderColor: th.color.ruleFaint,
        padding: th.space.sm,
      }}
    >
      <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.small, color: th.color.inkSoft }}>{label}</Text>
      <Text style={{ fontFamily: th.font.family.sans, color: th.color.ink }}>
        {/* A word ("ไม่มี") reads at heading size; only figures get the big weight. */}
        <Text style={{ fontSize: unit ? th.font.size.headingXl : th.font.size.headingLg, fontWeight: unit ? th.font.weight.black : th.font.weight.bold, fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        {unit ? <Text style={{ fontSize: th.font.size.small }}>{` ${unit}`}</Text> : null}
      </Text>
    </View>
  );
}

function BottomButton({ testID, icon, label, onPress, enabled = true }: { testID: string; icon: string; label: string; onPress: () => void; enabled?: boolean }) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: th.target.comfortable,
        alignItems: 'center',
        justifyContent: 'center',
        gap: th.space.xxs,
        borderRadius: th.radius.md,
        borderWidth: th.border.hair,
        borderColor: th.color.ruleStrong,
        backgroundColor: th.color.surfaceRaised,
        opacity: enabled ? 1 : 0.45,
      }}
    >
      <Text style={{ fontSize: th.font.size.headingMd, color: th.color.ink }}>{icon}</Text>
      <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.small, fontWeight: th.font.weight.bold, color: th.color.ink }}>{label}</Text>
    </Pressable>
  );
}

function MenuItem({ testID, label, onPress, disabled = false }: { testID: string; label: string; onPress: () => void; disabled?: boolean }) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: th.target.min, justifyContent: 'center', paddingHorizontal: th.space.sm }}
    >
      <Text style={{ fontFamily: th.font.family.sans, fontSize: th.font.size.body, fontWeight: th.font.weight.bold, color: disabled ? th.color.inkFaint : th.color.action }}>{label}</Text>
    </Pressable>
  );
}
