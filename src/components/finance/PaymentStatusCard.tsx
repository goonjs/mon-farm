/**
 * "การจ่ายเงิน" on settlement (E05-S05 · SET-6): one big tick per payee —
 * each worker's cash, the owner's transfer — independent of each other.
 * A tick whose amount has since changed shows old and new and asks for a
 * recheck (SALE-21); a tick and an untick from two phones is a conflict
 * that must be settled here before anyone counts it as paid.
 */

import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { paymentMarkPayload, paymentStatus, paymentTarget, type PaymentStatus } from '../../core/finance/payments';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Button } from '../chrome';
import { CardTitle, Fact, Note } from './parts';

export interface Payee {
  readonly id: string;
  readonly name: string;
  readonly satang: number;
  readonly kind: 'cash' | 'transfer';
}

const clock = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function PaymentStatusCard({ saleId, payees }: { saleId: string; payees: readonly Payee[] }) {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const inFlight = useInFlight();
  const rows = useMemo(() => payees.map((p) => ({ p, s: paymentStatus(fin.events ?? [], saleId, p.id, p.satang) })), [fin.events, saleId, payees]);

  const mark = (p: Payee, s: PaymentStatus, done: boolean) =>
    inFlight.run(async () => {
      const others = s.heads.filter((h) => h !== s.head);
      const payload = paymentMarkPayload(saleId, p.id, done, p.satang);
      await fin.write(paymentTarget(saleId, p.id), s.head, others.length ? { ...payload, alsoBasedOn: others } : payload);
    });

  if (fin.events === null) return null;

  return (
    <View testID="payments" style={{ gap: t.space.sm }}>
      <CardTitle>{msg('pay.title')}</CardTitle>
      {rows.map(({ p, s }) => (
        <View key={p.id} style={{ gap: t.space.xxs }}>
          <Pressable
            testID={`pay-toggle-${p.id}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: s.done, disabled: inFlight.busy }}
            disabled={inFlight.busy}
            onPress={() => void mark(p, s, !s.done)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.space.sm,
              minHeight: t.target.min,
              paddingHorizontal: t.space.md,
              paddingVertical: t.space.sm,
              borderRadius: t.radius.lg,
              borderWidth: s.done ? t.border.thick : t.border.hair,
              borderColor: s.done ? t.color.accept : t.color.ruleStrong,
              backgroundColor: s.done ? t.color.acceptSunk : t.color.surfaceRaised,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: t.radius.sm,
                borderWidth: t.border.thick,
                borderColor: s.done ? t.color.accept : t.color.ruleStrong,
                backgroundColor: s.done ? t.color.accept : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {s.done ? <Text style={{ color: t.color.inkInverse, fontWeight: t.font.weight.bold }}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text testID={`pay-${p.id}`} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                {p.id === 'owner' ? msg('pay.owner') : msg('pay.cash', { name: p.name })}
              </Text>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{`${formatSatang(p.satang)} ${msg('fin.baht')}`}</Text>
            </View>
          </Pressable>
          {s.done && !s.recheck ? (
            <Fact mark="check" tone="accept" testID={`pay-done-${p.id}`}>
              {msg('pay.doneBy', { device: s.by?.deviceId ?? '', time: s.at ? clock(s.at) : '' })}
            </Fact>
          ) : null}
          {s.recheck ? (
            <View style={{ gap: t.space.xxs }}>
              <Note tone="warn" testID={`pay-recheck-${p.id}`}>
                {msg('pay.recheck', { was: formatSatang(s.amountAtMarkSatang ?? 0), now: formatSatang(p.satang) })}
              </Note>
              <Button testID={`pay-confirm-${p.id}`} disabled={inFlight.busy} onPress={() => void mark(p, s, true)}>
                {msg('pay.confirmNew')}
              </Button>
            </View>
          ) : null}
          {s.conflict ? <Note tone="reject" testID={`pay-conflict-${p.id}`}>{msg('pay.conflict')}</Note> : null}
        </View>
      ))}
    </View>
  );
}
