/**
 * The one-time check against the buyer (E05-S03 · D-72).
 *
 * Our figures first, under "ยอดที่คำนวณได้ทั้งหมด", with the short baskets
 * broken down by zone. Then one tap: "ตรงกันทั้งหมด" (records the buyer's
 * figures as ours and the status at once), "น้ำหนักตรง", or "ไม่ตรงกัน" —
 * which opens the drill-down to the baskets and, if it still differs, closes
 * the check as "พบส่วนต่าง" with a reason. The money is always ours (D-15).
 */

import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  buyerCheck,
  buyerCheckPayload,
  buyerCheckTarget,
  checkBuyerCheck,
  type BuyerCheckStatus,
  type BuyerFigures,
  type DrillZone,
  type SaleFigures,
} from '../../core/finance/buyer-check';
import { formatSatang, parseBahtToSatang } from '../../core/finance/money';
import { useFinance } from '../../finance/use-finance';
import { useInFlight } from '../../finance/use-in-flight';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';
import { Button } from '../chrome';
import { Card, CardTitle, Fact, Input, Label, MoneyLine, Note, Rule } from './parts';

const kg = (g: number) => (g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
const signedKg = (g: number) => `${g > 0 ? '+' : g < 0 ? '−' : ''}${kg(Math.abs(g))}`;

/** Whole kg typed by a person → grams; '' = not given; NaN = not a number. */
function gramsOf(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!t) return null;
  return /^\d+(\.\d{1,3})?$/.test(t) ? Math.round(Number(t) * 1000) : NaN;
}

export function BuyerCheckPanel({
  saleId,
  ours,
  shorts,
  drill,
}: {
  saleId: string;
  ours: SaleFigures;
  shorts: readonly { zoneId: string; zoneName: string; baskets: number; netG: number }[];
  drill: readonly DrillZone[];
}) {
  const t = useTheme();
  const msg = useT();
  const fin = useFinance();
  const inFlight = useInFlight();
  const check = useMemo(() => buyerCheck(fin.events ?? [], saleId, ours), [fin.events, saleId, ours]);
  const [mismatch, setMismatch] = useState(false);
  const [buyerKg, setBuyerKg] = useState('');
  const [buyerBaht, setBuyerBaht] = useState('');
  const [buyerBaskets, setBuyerBaskets] = useState('');
  const [reason, setReason] = useState('');

  const buyer: BuyerFigures = {
    netG: gramsOf(buyerKg),
    grossSatang: buyerBaht.trim() ? (parseBahtToSatang(buyerBaht) ?? NaN) : null,
    baskets: buyerBaskets.trim() ? (/^\d+$/.test(buyerBaskets.trim()) ? Number(buyerBaskets.trim()) : NaN) : null,
  };
  const problems = checkBuyerCheck('diff', reason, buyer);

  const record = (status: BuyerCheckStatus, given: BuyerFigures | null = null, why = '') =>
    inFlight.run(async () => {
      // Based on every head, so a write made while two phones disagree settles it.
      const others = check.heads.filter((h) => h !== check.head);
      const payload = buyerCheckPayload(saleId, status, ours, given, why);
      await fin.write(buyerCheckTarget(saleId), check.head, others.length ? { ...payload, alsoBasedOn: others } : payload);
      setMismatch(false);
    });

  if (fin.events === null) return <Note>{msg('counter.loading')}</Note>;

  const done = check.status !== 'pending';
  return (
    <View style={{ gap: t.space.md }}>
      <Card tone={check.status === 'diff' ? 'plain' : done ? 'accent' : 'plain'}>
        <Fact mark={done ? 'check' : 'half'} tone={check.status === 'diff' ? 'warn' : done ? 'accept' : 'warn'}>
          <Text testID="check-status">{msg(`chk.status.${check.status}`)}</Text>
        </Fact>
        {check.stale ? (
          <Note tone="warn" testID="check-stale">
            {msg('chk.stale', { was: msg(`chk.status.${check.recorded!}`) })}
          </Note>
        ) : null}
        {check.conflict ? <Note tone="reject" testID="check-conflict">{msg('chk.conflict')}</Note> : null}
        {check.status === 'diff' ? (
          <>
            <Fact mark="note">{check.reason}</Fact>
            {check.diff?.netG != null ? <Fact mark="money" tone="warn"><Text testID="check-diff-kg">{msg('chk.diff.kg', { kg: signedKg(check.diff.netG) })}</Text></Fact> : null}
            {check.diff?.grossSatang != null ? (
              <Fact mark="money" tone="warn">
                <Text testID="check-diff-baht">{msg('chk.diff.baht', { amount: `${check.diff.grossSatang > 0 ? '+' : check.diff.grossSatang < 0 ? '−' : ''}${formatSatang(Math.abs(check.diff.grossSatang))}` })}</Text>
              </Fact>
            ) : null}
            {check.diff?.baskets != null ? <Fact mark="money" tone="warn">{msg('chk.diff.baskets', { n: `${check.diff.baskets > 0 ? '+' : check.diff.baskets < 0 ? '−' : ''}${Math.abs(check.diff.baskets)}` })}</Fact> : null}
          </>
        ) : null}
      </Card>

      <Card>
        <CardTitle>{msg('chk.ours')}</CardTitle>
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('chk.kg')}</Text>
          <Text testID="check-ours-kg" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {`${kg(ours.netG)} ${msg('chk.kgUnit')}`}
          </Text>
        </View>
        <MoneyLine testID="check-ours-price" label={msg('chk.price')} satang={ours.satangPerKg} />
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('chk.baskets')}</Text>
          <Text testID="check-ours-baskets" style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {String(ours.baskets)}
          </Text>
        </View>
        {shorts.map((s) => (
          <Fact key={s.zoneId} mark="half">
            <Text testID={`check-short-${s.zoneId}`}>{msg('chk.short', { zone: s.zoneName, n: s.baskets, kg: kg(s.netG) })}</Text>
          </Fact>
        ))}
        <Rule />
        <MoneyLine testID="check-ours-gross" strong label={msg('chk.gross')} satang={ours.grossSatang} />
      </Card>

      {!mismatch ? (
        <View style={{ gap: t.space.sm }}>
          <Button testID="check-all-match" variant="primary" disabled={inFlight.busy} onPress={() => void record('total')}>
            {msg('chk.allMatch')}
          </Button>
          <Button testID="check-weight" disabled={inFlight.busy} onPress={() => void record('weight')}>{msg('chk.weightOnly')}</Button>
          <Button testID="check-mismatch" onPress={() => setMismatch(true)}>{msg('chk.mismatch')}</Button>
          {check.recorded || check.conflict ? (
            <Button testID="check-undo" variant="destructive" disabled={inFlight.busy} onPress={() => void record('pending')}>{msg('chk.undo')}</Button>
          ) : null}
        </View>
      ) : (
        <Card>
          <CardTitle>{msg('chk.drill')}</CardTitle>
          <Note>{msg('chk.drillNote')}</Note>
          {drill.map((z) => (
            <DrillZoneRow key={z.zoneId} zone={z} />
          ))}
          <Rule />
          <CardTitle>{msg('chk.closeDiff')}</CardTitle>
          <Label hint={msg('chk.optional')}>{msg('chk.buyerSaid')}</Label>
          <Input testID="check-buyer-kg" numeric value={buyerKg} onChangeText={setBuyerKg} placeholder={msg('chk.buyerKg')} />
          <Input testID="check-buyer-baht" numeric value={buyerBaht} onChangeText={setBuyerBaht} placeholder={msg('chk.buyerBaht')} />
          <Input testID="check-buyer-baskets" numeric value={buyerBaskets} onChangeText={setBuyerBaskets} placeholder={msg('chk.buyerBaskets')} />
          <Label>{msg('chk.reason')}</Label>
          <Input testID="check-reason" value={reason} onChangeText={setReason} placeholder={msg('chk.reasonPlaceholder')} />
          {problems.includes('buyer') ? <Note tone="reject" testID="check-buyer-bad">{msg('chk.buyerBad')}</Note> : null}
          <Note>{msg('chk.moneyOurs')}</Note>
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Button onPress={() => setMismatch(false)}>{msg('common.cancel')}</Button>
            <Button
              testID="check-diff-save"
              variant="primary"
              disabled={problems.length > 0 || inFlight.busy}
              onPress={() => void record('diff', buyer, reason)}
            >
              {msg('chk.diffSave')}
            </Button>
          </View>
        </Card>
      )}
    </View>
  );
}

function DrillZoneRow({ zone }: { zone: DrillZone }) {
  const t = useTheme();
  const msg = useT();
  const [open, setOpen] = useState(false);
  const [pile, setPile] = useState<string | null>(null);
  const totalG = zone.piles.reduce((s, p) => s + p.netG, 0);
  const count = zone.piles.reduce((s, p) => s + p.baskets.length, 0);
  return (
    <View style={{ gap: t.space.xxs }}>
      <Pressable testID={`drill-zone-${zone.zoneId}`} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, fontWeight: t.font.weight.bold, color: t.color.action }}>
          {`${open ? '▾' : '▸'} ${msg('chk.drillLine', { name: zone.name, n: count, kg: kg(totalG) })}`}
        </Text>
      </Pressable>
      {open
        ? zone.piles.map((p) => (
            <View key={p.pileId} style={{ gap: 2, paddingLeft: t.space.md }}>
              <Pressable testID={`drill-pile-${p.pileId}`} accessibilityRole="button" accessibilityState={{ expanded: pile === p.pileId }} onPress={() => setPile(pile === p.pileId ? null : p.pileId)}>
                <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.action }}>
                  {`${pile === p.pileId ? '▾' : '▸'} ${msg('chk.drillLine', { name: p.name, n: p.baskets.length, kg: kg(p.netG) })}`}
                </Text>
              </Pressable>
              {pile === p.pileId
                ? p.baskets.map((b, i) => (
                    <Text key={b.id} testID={`drill-basket-${b.id}`} style={{ paddingLeft: t.space.md, fontFamily: t.font.family.sans, fontSize: t.font.size.micro, color: b.short ? t.color.warn : t.color.inkSoft }}>
                      {msg(b.short ? 'chk.basketShort' : 'chk.basket', { n: i + 1, kg: kg(b.netG) })}
                    </Text>
                  ))
                : null}
            </View>
          ))
        : null}
    </View>
  );
}
