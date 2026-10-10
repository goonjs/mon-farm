/**
 * Settlement — the screen the MVP exists for.
 *
 * FR-7.4 forbids a single opaque total, so this renders the derivation
 * `settle()` produces: each line is one arithmetic operation, so a
 * disagreement can be localised to a step rather than to "the app".
 *
 * Workers are per zone, so there is no single "owner N% / worker N%" card —
 * the leading figure is an aggregate owner total, the per-zone card carries
 * each zone's own worker and percentage, and the per-worker card (S18) sums
 * across zones for whoever gets paid, which is the number a worker actually
 * wants to see: not "what did zone A make" but "what do I get, total".
 */

import { useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { Button, TopBar } from '../../../components/chrome';
import { DeductionForm, type DeductionFormInput } from '../../../components/DeductionForm';
import { DebtDeductionCard } from '../../../components/finance/DebtDeductionCard';
import { ScreenHeader } from '../../../components/finance/parts';
import { RoundingCard } from '../../../components/finance/RoundingCard';
import { SaleAccountCard } from '../../../components/finance/SaleAccountCard';
import { useSaleRounding, type SaleRounding } from '../../../finance/use-sale-rounding';
import { ReopenPrompt } from '../../../components/ReopenPrompt';
import { WorkerPayoutCard } from '../../../components/WorkerPayoutCard';
import { formatBaht, formatKg, settle, SettlementUnavailable, type Settlement } from '../../../core/settle';
import { newId } from '../../../lib/id';
import { useSale } from '../../../store/SaleProvider';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';

export default function SettlementScreen() {
  const t = useTheme();
  // A phone held upright has no room for two columns (v1.1.0 is portrait-first).
  const narrow = useWindowDimensions().width < 600;
  const msg = useT();
  const { events, state, append } = useSale();
  const router = useRouter();
  const [reopening, setReopening] = useState(false);

  /**
   * Reopening IS "back to counting" — there is nothing else to do with a
   * closed sale on this screen, so a separate "back to counting" button next
   * to "reopen" was two names for paths that only make sense together (a
   * closed sale can't actually be counted into until it's reopened). One
   * action, doing both: write `sale_reopened`, then land on the counter.
   *
   * `router.back()`, not a push to the counter route — this screen was
   * reached BY pushing from the counter (`doCloseSale` in counter.tsx), so
   * the counter screen is already the previous entry on the stack. Pushing
   * again here would stack a second, new instance of it on top of the first
   * rather than returning to it — the same duplicate-screen trap documented
   * on `backToCounting` just below.
   */
  const reopenSale = (reason: string) => {
    append({ kind: 'sys', payload: { t: 'sale_reopened', reason } });
    setReopening(false);
    router.back();
  };
  /**
   * router.back(), not a Link to the counter route. This screen is reached
   * two ways: pushed from the counter screen ("close sale"), or resumed
   * directly from the sale list for an already-closed sale. Either way, the
   * screen the user actually came from is already on the navigation stack —
   * a Link (even with `replace`) would add or swap in a NEW entry on top of
   * it rather than reusing it, so toggling settlement <-> counter repeatedly
   * would leave a hidden screen instance behind on every round trip.
   *
   * Only used from the "cannot settle yet" error branch below — once a sale
   * has actually closed and settled, the only way back into counting is
   * through reopening it (see `reopenSale` above).
   */
  const backToCounting = () => router.back();

  /** Money leaving one worker's own share (S29) — see the comment on `deduction_added` in types.ts. */
  const addDeduction = (input: DeductionFormInput) => {
    append({
      kind: 'sys',
      payload: {
        t: 'deduction_added',
        deductionId: newId('deduction-'),
        personId: input.personId,
        personName: input.personName,
        satang: input.satang,
        reason: input.reason,
        agreedBy: input.agreedBy,
      },
    });
  };

  /** Append-only: a void marks the deduction, it never edits or removes it. */
  const voidDeduction = (deductionId: string, reason: string) => {
    append({ kind: 'sys', payload: { t: 'deduction_voided', deductionId, reason } });
  };

  let result;
  try {
    result = settle(events, state);
  } catch (err) {
    const why =
      err instanceof SettlementUnavailable
        ? err.message
        : 'Something in the log could not be settled.';
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface }}>
        <TopBar
          crumb={msg('settle.title')}
          right={
            <Link href="/" asChild>
              <Button testID="to-sale-list">{msg('settle.list')}</Button>
            </Link>
          }
        />
        <View style={{ flex: 1, padding: t.space.xl, justifyContent: 'center' }}>
          <Text
            style={{
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.lead,
              color: t.color.reject,
              marginBottom: t.space.sm,
            }}
          >
            {msg('settle.cannotSettle')}
          </Text>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
            {why}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: t.space.lg }}>
            <Button variant="primary" onPress={backToCounting}>{msg('settle.backToCounting')}</Button>
          </View>
        </View>
        {reopening ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.color.stage, zIndex: 10 }}>
            <ReopenPrompt
              targetLabel="การขาย"
              consequence={msg('settle.saleConsequence')}
              onConfirm={reopenSale}
              onCancel={() => setReopening(false)}
            />
          </View>
        ) : null}
      </View>
    );
  }

  const s = result;
  // The derivation sits under the money on a phone; rendered in that order so screen readers and Tab follow what is seen.
  const derivation = (
    <View style={[card(t), narrow ? null : { flex: 1.1 }]}>
      <CardTitle>{msg('settle.derivation')}</CardTitle>
      {s.steps.slice(0, 6).map((step) => (
        <View
          key={step.key}
          testID={`step-${step.key}`}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: t.space.md,
            paddingVertical: t.space.sm,
            borderBottomWidth: step.key === 'gross' ? 0 : t.border.hair,
            borderBottomColor: t.color.ruleFaint,
            borderTopWidth: step.key === 'gross' ? t.border.thick : 0,
            borderTopColor: t.color.ink,
          }}
        >
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
            {step.thai}
          </Text>
          <Text
            style={{
              fontFamily: t.font.family.sans,
              fontSize: step.key === 'gross' ? t.font.size.lead : t.font.size.small,
              fontWeight: t.font.weight.bold,
              color: t.color.ink,
              fontVariant: ['tabular-nums'],
            }}
          >
            {step.value}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader
        testID="settle"
        title={msg('settle.title')}
        subtitle={state.parties?.farmName ?? undefined}
        onBack={() => router.replace('/')}
        right={
          <Link href="/" asChild>
            <Button testID="to-sale-list">{msg('settle.list')}</Button>
          </Link>
        }
      />

      {/* alignItems: 'flex-start' so each column is as tall as its own content.
          The row's default is 'stretch', which sized the short derivation card
          to the tall right-hand column — once a sale has three zones and a few
          deductions, that left half a screen of empty bordered box next to the
          money, which reads as a broken screen rather than a finished one. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: t.space.md,
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'flex-start',
          gap: t.space.md,
        }}
      >
        {narrow ? null : derivation}

        {/* ---- owner total, leading ---- */}
        <View style={{ flex: narrow ? undefined : 1, gap: t.space.md }}>
          <View style={card(t)}>
            <CardTitle>{msg('settle.ownerTotal')}</CardTitle>
            <Figure testID="owner-share" colour={t.color.action}>{formatBaht(s.ownerSatang)}</Figure>
            <ShareLabel>{msg('settle.ownerNote')}</ShareLabel>
          </View>

          <View style={card(t)}>
            <CardTitle>{msg('settle.perZone')}</CardTitle>
            {s.perZone.map((z) => (
              <View key={z.zoneId} testID={`zone-${z.zoneId}`} style={{ marginBottom: t.space.sm }}>
                <Row
                  label={msg('settle.zoneRow', {
                    name: z.zoneName,
                    baskets: z.totals.baskets,
                    weight: formatKg(z.totals.netG),
                  })}
                  value={formatBaht(z.grossSatang)}
                  bold
                />
                <Row
                  label={msg('settle.zoneOwnerRow', { pct: z.ownerPct })}
                  value={formatBaht(z.ownerSatang)}
                  colour={t.color.action}
                />
                <Row
                  label={msg('settle.zoneWorkerRow', {
                    name: z.workerName ?? msg('settle.zoneWorkerDefaultName'),
                    pct: 100 - z.ownerPct,
                  })}
                  value={formatBaht(z.workerSatang)}
                />
              </View>
            ))}
            <View style={{ borderTopWidth: t.border.hair, borderTopColor: t.color.rule, paddingTop: t.space.sm }}>
              <Row label={msg('settle.total')} value={formatBaht(s.grossSatang)} bold />
            </View>
          </View>

          <View style={card(t)}>
            <CardTitle>{msg('settle.perWorker')}</CardTitle>
            {s.perWorker.length === 0 ? (
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
                {msg('settle.noWorker')}
              </Text>
            ) : (
              s.perWorker.map((w) => {
                const zoneNames = w.zoneIds
                  .map((zoneId) => s.perZone.find((z) => z.zoneId === zoneId)?.zoneName ?? zoneId)
                  .join(', ');
                return (
                  <View key={w.personId} style={{ marginBottom: t.space.sm }}>
                    <WorkerPayoutCard worker={w} onVoidDeduction={voidDeduction} zoneNames={zoneNames} />
                    {/* E06-S04: debt from the worker's ledger, deducted at this sale. Capped by what is left after any old S29 deduction, so the two cannot take the same money twice. */}
                    <DebtDeductionCard saleId={state.id} worker={{ id: w.personId, name: w.workerName }} shareSatang={Math.max(0, w.payoutSatang)} />
                  </View>
                );
              })
            )}
          </View>

          <MoneyCards saleId={state.id} settlement={s} />

          <View style={card(t)}>
            <CardTitle>{msg('settle.deductionAdd')}</CardTitle>
            <DeductionForm onAdd={addDeduction} />
          </View>
        </View>
        {narrow ? derivation : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          padding: t.space.xs,
          paddingHorizontal: t.space.sm,
          borderTopWidth: t.border.hair,
          borderTopColor: t.color.rule,
        }}
      >
        <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft, flex: 1 }}>
          สรุปนี้คำนวณจากบันทึกทั้งหมด — ไม่ได้เก็บเป็นตัวเลขตายตัว
        </Text>
        {state.status === 'closed' ? (
          <Button variant="primary" testID="reopen-sale" onPress={() => setReopening(true)}>
            {msg('settle.reopen')}
          </Button>
        ) : (
          // Unreachable through normal navigation — settlement is only ever
          // pushed to after `sale_closed`, or resumed for an already-closed
          // sale. Kept as a safe fallback rather than assumed away.
          <Button variant="primary" testID="back-to-count" onPress={backToCounting}>
            {msg('settle.backToCounting')}
          </Button>
        )}
      </View>

      {reopening ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.color.stage, zIndex: 10 }}>
          <ReopenPrompt
            targetLabel="การขาย"
            consequence={msg('settle.saleConsequence')}
            onConfirm={reopenSale}
            onCancel={() => setReopening(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

const card = (t: ReturnType<typeof useTheme>) => ({
  borderWidth: t.border.hair,
  borderColor: t.color.ruleFaint,
  borderRadius: t.radius.lg,
  backgroundColor: t.color.surfaceRaised,
  padding: t.space.md,
});

function CardTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      style={{
        fontFamily: t.font.family.mono,
        fontSize: t.font.size.micro,
        letterSpacing: t.font.tracking.wide,
        color: t.color.inkSoft,
        marginBottom: t.space.sm,
      }}
    >
      {children}
    </Text>
  );
}

function ShareLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
      {children}
    </Text>
  );
}

function Figure({ children, colour, testID }: { children: React.ReactNode; colour: string; testID?: string }) {
  const t = useTheme();
  return (
    <Text
      testID={testID}
      style={{
        fontFamily: t.font.family.sans,
        fontSize: t.font.size.figure,
        fontWeight: t.font.weight.black,
        letterSpacing: t.font.size.figure * t.font.tracking.tight,
        color: colour,
        fontVariant: ['tabular-nums'],
        marginBottom: t.space.sm,
      }}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {children}
    </Text>
  );
}

function Row({ label, value, bold, colour }: { label: string; value: string; bold?: boolean; colour?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.sm, paddingVertical: 2 }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, flexShrink: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontSize: t.font.size.small,
          fontWeight: bold ? t.font.weight.bold : t.font.weight.medium,
          color: colour ?? t.color.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Rounding (E05-S02) and where the owner transfer goes (E05-S07), sharing one
 * rounding state so the transfer amount is the rounded one. A component of
 * its own because the hook cannot run above the screen's early return.
 */
function MoneyCards({ saleId, settlement }: { saleId: string; settlement: Settlement }) {
  const t = useTheme();
  const r: SaleRounding = useSaleRounding(
    saleId,
    settlement.perWorker.map((w) => ({ id: w.personId, name: w.workerName || w.personId, shareSatang: Math.max(0, w.payoutSatang) })),
    settlement.ownerSatang,
    settlement.grossSatang,
  );
  return (
    <>
      <View style={card(t)}>
        <RoundingCard r={r} />
      </View>
      <View style={[card(t), { backgroundColor: t.color.brandCream }]}>
        <SaleAccountCard saleId={saleId} ownerSatang={r.result.ownerSatang} ready={r.ready} />
      </View>
    </>
  );
}
