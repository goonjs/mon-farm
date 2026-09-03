/**
 * Bulk entry (S23): the form a pile gets instead of the counter when nobody
 * counted it live.
 *
 * Two fields, because two things are all a person actually knows about a pile
 * they did not watch being counted — how many whole baskets, and the weight
 * of what was left over. No third field derives one from the other: dividing
 * a total by the standard net would invent a basket count nobody counted and
 * still leave a remainder to explain.
 *
 * Deliberately NOT `WeightInput`. Its drag track and ± nudges exist to track
 * a scale that is moving in front of you; here there is no scale and no live
 * reading, just a number being copied off a tally, so a typed decimal field
 * is the whole affordance.
 *
 * The typed reason is required, and this component never appends anything —
 * it reports a `(baskets, leftoverG, reason)` tuple and lets the screen write
 * the events, the same division of labour `ShortBasketPanel` uses.
 */

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from './chrome';
import { useT } from '../i18n';
import { useTheme } from '../theme';

const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export interface BulkEntry {
  /** Whole standard baskets. May be 0 — an all-leftover pile is legitimate. */
  baskets: number;
  /** The leftover, in integer grams. 0 means there was none to record. */
  leftoverG: number;
  reason: string;
}

export interface BulkEntryFormProps {
  pileName: string;
  tareG: number;
  stdNetG: number;
  onConfirm: (entry: BulkEntry) => void;
  onCancel: () => void;
}

/** Digits only: baskets are counted things, never 2.5 of one. */
function parseBaskets(raw: string): number {
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** kg as typed → integer grams, the unit everything downstream speaks. */
function parseLeftoverG(raw: string): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : 0;
}

export function BulkEntryForm({ pileName, tareG, stdNetG, onConfirm, onCancel }: BulkEntryFormProps) {
  const t = useTheme();
  const msg = useT();
  const [basketsRaw, setBasketsRaw] = useState('');
  const [leftoverRaw, setLeftoverRaw] = useState('');
  const [reason, setReason] = useState('');

  const baskets = parseBaskets(basketsRaw);
  const leftoverG = parseLeftoverG(leftoverRaw);
  const hasSomething = baskets > 0 || leftoverG > 0;
  const hasReason = reason.trim().length > 0;

  const field = {
    width: '100%' as const,
    maxWidth: 480,
    minHeight: 40,
    fontFamily: t.font.family.sans,
    fontSize: t.font.size.small,
    paddingHorizontal: t.space.sm,
    borderWidth: t.border.hair,
    borderColor: t.color.ruleStrong,
    borderRadius: t.radius.sm,
    backgroundColor: t.color.surfaceRaised,
    color: t.color.ink,
  };

  const label = {
    fontFamily: t.font.family.mono,
    fontSize: t.font.size.micro,
    letterSpacing: t.font.tracking.wide,
    color: t.color.inkSoft,
  };

  return (
    <View
      testID="bulk-entry-form"
      style={{
        flex: 1,
        backgroundColor: t.color.stage,
        padding: t.space.md,
        gap: t.space.sm,
      }}
    >
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.lead, fontWeight: t.font.weight.black, color: t.color.ink }}>
        {msg('bulk.title', { name: pileName })}
      </Text>

      {/* Two columns, because the app is landscape-locked and three stacked
          fields plus the summary and the buttons do not fit in 360px of
          height — and a confirm button below the fold is a confirm button
          nobody presses. */}
      <View style={{ flex: 1, flexDirection: 'row', gap: t.space.lg }}>
        <View style={{ flex: 1, gap: t.space.xs }}>
          <Text style={label}>{msg('bulk.basketsLabel')}</Text>
          <TextInput
            testID="bulk-baskets"
            value={basketsRaw}
            onChangeText={setBasketsRaw}
            inputMode="numeric"
            placeholder="0"
            placeholderTextColor={t.color.inkFaint}
            style={field}
          />

          <Text style={label}>{msg('bulk.leftoverLabel')}</Text>
          <TextInput
            testID="bulk-leftover"
            value={leftoverRaw}
            onChangeText={setLeftoverRaw}
            inputMode="decimal"
            placeholder="0"
            placeholderTextColor={t.color.inkFaint}
            style={field}
          />

          <Text style={label}>{msg('bulk.reasonLabel')}</Text>
          <TextInput
            testID="bulk-reason"
            value={reason}
            onChangeText={setReason}
            placeholder={msg('bulk.reasonPlaceholder')}
            placeholderTextColor={t.color.inkFaint}
            style={field}
          />
        </View>

        <View style={{ flex: 1, gap: t.space.sm }}>
          {/* What confirming writes, spelled out — the auto-close especially,
              which two number fields would otherwise spring on the operator. */}
          <Text
            testID="bulk-summary"
            style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}
          >
            {msg('bulk.summary', {
              baskets: String(baskets),
              leftover: (leftoverG / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 }),
            })}
          </Text>

          {/* The pile's own numbers: every bulk basket is snapshotted at
              exactly these, the same as a counted one. */}
          <Text style={label}>
            {msg('gate.expected', {
              tare: kg(tareG),
              std: kg(stdNetG),
              expected: kg(tareG + stdNetG),
            })}
          </Text>

          {/* The gate is skipped, not passed, and the form says so before the
              fact as well as in the log afterwards. */}
          <Text
            testID="bulk-gate-note"
            style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: t.color.warn }}
          >
            {msg('bulk.gateNote')}
          </Text>

          {/* Named blockers rather than a button that is dim for no stated
              reason — the same bar `ReopenPrompt` sets for a typed reason. */}
          {!hasSomething ? (
            <Text testID="bulk-empty-error" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: t.color.reject }}>
              {msg('bulk.emptyError')}
            </Text>
          ) : !hasReason ? (
            <Text testID="bulk-reason-error" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: t.color.reject }}>
              {msg('bulk.reasonRequired')}
            </Text>
          ) : null}

          <View style={{ flex: 1 }} />

          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Button
              testID="bulk-confirm"
              variant="primary"
              disabled={!hasSomething || !hasReason}
              onPress={() => onConfirm({ baskets, leftoverG, reason: reason.trim() })}
            >
              {msg('bulk.confirm')}
            </Button>
            <Button testID="bulk-cancel" onPress={onCancel}>
              {msg('common.cancel')}
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}
