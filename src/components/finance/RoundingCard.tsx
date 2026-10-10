/**
 * "ปัดเศษ" on the settlement screen (E05-S02): asked per sale after debt
 * deductions, only when some worker's cash has satang; the three choices
 * from SET-5, preselected from this device's previous sale but not taken
 * until tapped. Each worker's adjustment is its own line; the owner absorbs
 * the opposite so the sale still balances to the satang.
 */

import { View } from 'react-native';

import type { RoundingMode } from '../../core/finance/deduct';
import { formatSatang } from '../../core/finance/money';
import type { SaleRounding } from '../../finance/use-sale-rounding';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { CardTitle, Chip, ChipRow, Fact, Note } from './parts';

const MODES: readonly { mode: RoundingMode; key: 'round.worker' | 'round.owner' | 'round.keep' }[] = [
  { mode: 'worker', key: 'round.worker' },
  { mode: 'owner', key: 'round.owner' },
  { mode: 'none', key: 'round.keep' },
];

export function RoundingCard({ r }: { r: SaleRounding }) {
  const t = useTheme();
  const msg = useT();
  if (!r.loaded) return null;
  if (!r.result.needsAsking) return <Note testID="round-not-needed">{msg('round.none.needed')}</Note>;

  return (
    <View testID="rounding" style={{ gap: t.space.xs }}>
      <CardTitle>{msg('round.title')}</CardTitle>
      {!r.choice.asked ? <Note tone="warn" testID="round-ask">{msg('round.ask')}</Note> : null}
      <ChipRow>
        {MODES.map((m) => (
          <Chip key={m.mode} testID={`round-${m.mode}`} on={r.choice.asked && r.choice.mode === m.mode} onPress={() => void r.set(m.mode)}>
            {`${msg(m.key)}${!r.choice.asked && r.choice.mode === m.mode && m.mode !== 'none' ? ` · ${msg('round.default')}` : ''}`}
          </Chip>
        ))}
      </ChipRow>
      {r.choice.asked
        ? r.result.workers.map((w, i) => (
            <Note key={w.id} testID={`round-line-${w.id}`}>
              {msg('round.line', {
                name: r.before[i].name,
                before: formatSatang(r.before[i].cashBeforeSatang),
                after: formatSatang(w.cashSatang),
                adjust: `${w.adjustSatang > 0 ? '+' : ''}${formatSatang(w.adjustSatang)}`,
              })}
            </Note>
          ))
        : null}
      {r.choice.asked ? (
        <>
          <Note testID="round-owner-total">{msg('round.owner.line', { amount: formatSatang(r.result.ownerSatang) })}</Note>
          {r.check.ok ? (
            <Fact mark="check" tone="accept" testID="round-check">{msg('round.check')}</Fact>
          ) : (
            <Note tone="reject" testID="round-check-off">{msg('round.checkOff', { diff: formatSatang(r.check.diffSatang) })}</Note>
          )}
        </>
      ) : null}
    </View>
  );
}
