/**
 * One worker's card on the settlement screen (S29): the share `settle()`
 * already computed, each LIVE deduction against that worker itemised — never
 * netted into one figure, never folded into the share — and a bold payout
 * row underneath.
 *
 * Voiding a deduction is append-only and demands a typed reason, the same
 * bar `pile_reopened` and `void` already meet — pressing the void button
 * opens an inline reason field rather than voiding on the spot.
 */

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from './chrome';
import type { WorkerSettlement } from '../core/settle';
import { formatBaht } from '../core/settle';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export interface WorkerPayoutCardProps {
  worker: WorkerSettlement;
  onVoidDeduction: (deductionId: string, reason: string) => void;
  /** The zone(s) this share comes from, already joined for display — e.g. "โซน A, โซน B". Empty for someone with no zone contract in this sale. */
  zoneNames?: string;
}

export function WorkerPayoutCard({ worker: w, onVoidDeduction, zoneNames }: WorkerPayoutCardProps) {
  const t = useTheme();
  const msg = useT();

  return (
    <View testID={`worker-${w.personId}`} style={{ gap: 2 }}>
      <Row label={w.workerName || w.personId} value={formatBaht(w.workerSatang)} bold />
      {zoneNames ? (
        <Text style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
          {zoneNames}
        </Text>
      ) : null}

      {w.deductions.map((d) => (
        <DeductionRow key={d.id} deduction={d} onVoid={onVoidDeduction} />
      ))}

      <View
        testID={`worker-payout-${w.personId}`}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: 2,
          borderTopWidth: w.deductions.length ? t.border.hair : 0,
          borderTopColor: t.color.ruleFaint,
          marginTop: w.deductions.length ? 2 : 0,
        }}
      >
        <Text style={{ ...t.face(t.font.weight.bold), fontSize: t.font.size.small, color: t.color.ink }}>
          {msg('settle.payout')}
        </Text>
        <Text
          style={{
            ...t.face(t.font.weight.bold),
            fontSize: t.font.size.small,
            color: w.payoutSatang < 0 ? t.color.reject : t.color.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {/* Same convention as the deduction lines below: a typographic minus
              OUTSIDE the ฿, not toLocaleString's hyphen inside it. On a screen
              whose premise is being read at a distance, one money format. */}
          {w.payoutSatang < 0 ? `−${formatBaht(-w.payoutSatang)}` : formatBaht(w.payoutSatang)}
        </Text>
      </View>
    </View>
  );
}

function DeductionRow({
  deduction: d,
  onVoid,
}: {
  deduction: WorkerSettlement['deductions'][number];
  onVoid: (deductionId: string, reason: string) => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');

  const canConfirm = reason.trim().length > 0;

  return (
    <View testID={`deduction-${d.id}`} style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space.sm, paddingVertical: 2 }}>
        <Text style={{ flex: 1, ...t.face(t.font.weight.regular), fontSize: t.font.size.small, color: t.color.inkSoft }}>
          {msg('settle.deductionRow', { reason: d.reason, agreedBy: d.agreedBy })}
        </Text>
        <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.small, color: t.color.reject, fontVariant: ['tabular-nums'] }}>
          −{formatBaht(d.satang)}
        </Text>
        <Button testID={`deduction-void-${d.id}`} onPress={() => setVoiding((v) => !v)}>
          {msg('settle.deductionVoid')}
        </Button>
      </View>

      {voiding ? (
        <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center', paddingLeft: t.space.md }}>
          <TextInput
            testID={`deduction-void-reason-${d.id}`}
            value={reason}
            onChangeText={setReason}
            placeholder={msg('settle.deductionVoidReason')}
            placeholderTextColor={t.color.inkFaint}
            style={{
              flex: 1,
              ...t.face(t.font.weight.regular),
              fontSize: t.font.size.small,
              minHeight: 32,
              paddingHorizontal: t.space.sm,
              borderWidth: t.border.hair,
              borderColor: t.color.ruleStrong,
              borderRadius: t.radius.sm,
              color: t.color.ink,
            }}
          />
          <Button
            testID={`deduction-void-confirm-${d.id}`}
            variant="destructive"
            disabled={!canConfirm}
            onPress={() => {
              onVoid(d.id, reason.trim());
              setReason('');
              setVoiding(false);
            }}
          >
            {msg('settle.deductionVoidConfirm')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.sm, paddingVertical: 2 }}>
      <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.small, color: t.color.inkSoft, flexShrink: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          ...t.face(bold ? t.font.weight.bold : t.font.weight.medium),
          fontSize: t.font.size.small,
          color: t.color.ink,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
