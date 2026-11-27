/**
 * The exact amounts behind a summary card's short figures (owner rule
 * 2026-10-31, skill summary-lines §1: "the exact amount is one tap away").
 * Same pattern as the expense totals sheet of PR 251: a BottomSheet with a
 * 48 px ✕; Escape and Android back close it too.
 */

import { Fragment, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { formatSatang } from '../../core/finance/money';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { AppText, BottomSheet } from '../../ui';

export interface ExactRow {
  readonly testID: string;
  readonly label: string;
  readonly satang: number;
  /** A caption above this row, starting a group (e.g. "หนี้กับคนอื่น"). */
  readonly section?: string;
}

export function ExactSheet({ testID, open, onClose, rows }: { testID: string; open: boolean; onClose: () => void; rows: readonly ExactRow[] }) {
  const t = useTheme();
  const msg = useT();
  return (
    <BottomSheet testID={testID} open={open} onClose={onClose} title={msg('v2m.exact.title')} closeLabel={msg('v2m.exact.close')}>
      <View style={{ gap: t.space.xs, paddingBottom: t.space.lg }}>
        {rows.map((r) => (
          <Fragment key={r.testID}>
            {r.section ? <AppText variant="caption" style={{ fontWeight: t.font.weight.bold, marginTop: t.space.sm }}>{r.section}</AppText> : null}
            <View testID={r.testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: t.space.md, paddingVertical: t.space.xs }}>
              <AppText>{r.label}</AppText>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
                {`${formatSatang(r.satang)} ${msg('v2m.baht')}`}
              </Text>
            </View>
          </Fragment>
        ))}
      </View>
    </BottomSheet>
  );
}

/** Stands in for `{amount}` in a message, so a short figure can sit inside the translated sentence. */
export const MONEY_SLOT = '\u0000';

/** `text` (a message given `amount: MONEY_SLOT`) with `money` where the amount goes. */
export function withMoney(text: string, money: ReactNode): ReactNode {
  const [before, after = ''] = text.split(MONEY_SLOT);
  return (
    <>
      {before}
      {money}
      {after}
    </>
  );
}
