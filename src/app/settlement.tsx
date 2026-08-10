/**
 * Settlement — the screen the MVP exists for.
 *
 * FR-7.4 forbids a single opaque total, so this renders the derivation
 * `settle()` produces: each line is one arithmetic operation, so a
 * disagreement can be localised to a step rather than to "the app".
 *
 * NOTE: this is the S15 compile-fix, not the S18 redesign. Workers are now per
 * zone, so the old single "owner N% / worker N%" card no longer describes the
 * sale — it shows an aggregate owner total instead, and per-zone rows carry
 * each zone's own worker and percentage. The dedicated per-worker view
 * (`Settlement.perWorker`, already computed) is S18's screen.
 */

import { ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Button, TopBar } from '../components/chrome';
import { formatBaht, formatKg, settle, SettlementUnavailable } from '../core/settle';
import { useSale } from '../store/SaleProvider';
import { useTheme } from '../theme';

export default function SettlementScreen() {
  const t = useTheme();
  const { events, state } = useSale();

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
        <TopBar crumb="สรุป · settlement" />
        <View style={{ flex: 1, padding: t.space.xl, justifyContent: 'center' }}>
          <Text
            style={{
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.lead,
              color: t.color.reject,
              marginBottom: t.space.sm,
            }}
          >
            ยังสรุปไม่ได้ · cannot settle yet
          </Text>
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>
            {why}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: t.space.lg }}>
            <Link href="/" asChild>
              <Button variant="primary">← กลับไปนับ · back to counting</Button>
            </Link>
          </View>
        </View>
      </View>
    );
  }

  const s = result;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar crumb={`${state.parties?.farmName ?? ''} ▸ สรุป · settlement`} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: t.space.md, flexDirection: 'row', gap: t.space.md }}>
        {/* ---- the derivation ---- */}
        <View style={[card(t), { flex: 1.1 }]}>
          <CardTitle>ที่มาของยอด · how the total was reached</CardTitle>
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

        {/* ---- owner total, leading ---- */}
        <View style={{ flex: 1, gap: t.space.md }}>
          <View style={card(t)}>
            <CardTitle>รวมส่วนเจ้าของ · owner total</CardTitle>
            <Figure testID="owner-share" colour={t.color.action}>{formatBaht(s.ownerSatang)}</Figure>
            <ShareLabel>รวมทุกโซน · summed across every zone below, each at its own %</ShareLabel>
          </View>

          <View style={card(t)}>
            <CardTitle>แยกตามโซน · per zone</CardTitle>
            {s.perZone.map((z) => (
              <View key={z.zoneId} testID={`zone-${z.zoneId}`} style={{ marginBottom: t.space.sm }}>
                <Row
                  label={`${z.zoneName} — ${z.totals.baskets} เข่ง · ${formatKg(z.totals.netG)} กก.`}
                  value={formatBaht(z.grossSatang)}
                  bold
                />
                <Row
                  label={`  เจ้าของ ${z.ownerPct}%`}
                  value={formatBaht(z.ownerSatang)}
                  colour={t.color.action}
                />
                <Row
                  label={`  ${z.workerName ?? 'คนงาน (ค่าเริ่มต้น)'} ${100 - z.ownerPct}%`}
                  value={formatBaht(z.workerSatang)}
                />
              </View>
            ))}
            <View style={{ borderTopWidth: t.border.hair, borderTopColor: t.color.rule, paddingTop: t.space.sm }}>
              <Row label="รวม · total" value={formatBaht(s.grossSatang)} bold />
            </View>
          </View>
        </View>
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
        <Link href="/" asChild>
          <Button variant="primary" testID="back-to-count">← กลับไปนับ · back to counting</Button>
        </Link>
      </View>
    </View>
  );
}

const card = (t: ReturnType<typeof useTheme>) => ({
  borderWidth: t.border.hair,
  borderColor: t.color.rule,
  borderRadius: t.radius.md,
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
