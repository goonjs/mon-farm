/**
 * Start a sale (E04-S02, mockup v1.1.0 screen 5): the header filled from
 * master data — today, the latest buyer, the farm manager, the group's
 * default net weight, numbering mode and scale type — so "next" is one tap
 * (NFR-4). No farm on the header (a sale spans farms, D-36), no worker lead
 * or "at the buyer" (D-10), and the price may wait (SALE-3, D-11).
 *
 * Writes the same `sale_started` the old setup screen does, plus the master
 * ids alongside the name snapshots — additive, so the counter and the
 * settlement read it unchanged.
 */

import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '../../../components/chrome';
import { Card, Chip, ChipRow, FarmScreen, FieldError, TextField } from '../../../components/farm-ui';
import { ThaiDate } from '../../../components/ThaiDate';
import { defaultBuyer, filterPeople, saleSettings, type MasterState } from '../../../core/master';
import { parsePrice } from '../../../core/sale-points';
import type { NumberingMode } from '../../../core/types';
import { useT } from '../../../i18n';
import { peopleStore as master } from '../../../store/people';
import { useSale } from '../../../store/SaleProvider';
import { useTheme } from '../../../theme';

export default function StartSaleScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { saleId, append } = useSale();
  const [state, setState] = useState<MasterState | null>(null);
  const [now] = useState(() => Date.now());
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [numbering, setNumbering] = useState<NumberingMode | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await master.state();
      const latest = defaultBuyer(s, await master.latestBuyerId());
      setState(s);
      setLatestId(latest?.id ?? null);
      setBuyerId(latest?.id ?? null);
    })();
  }, []);

  if (!state) return null;
  const settings = saleSettings(state);
  const mode = numbering ?? settings.numbering;
  const pair = settings.pairs.find((p) => p.pairId === pairId) ?? settings.pairs.find((p) => p.isDefault)!;
  const buyers = state.buyers.filter((b) => !b.deleted);
  const buyer = buyers.find((b) => b.id === buyerId) ?? null;
  // The manager fills itself in from farm data (SALE-2): the first person holding the role.
  const manager = filterPeople(state.people, 'manager')[0] ?? null;
  const priceParsed = parsePrice(price);

  const next = () => {
    setTried(true);
    if (!priceParsed.ok) return;
    append({
      kind: 'sys',
      payload: {
        t: 'sale_started',
        farmName: '',
        buyer: buyer?.name ?? '',
        ...(buyer ? { buyerId: buyer.id } : {}),
        manager: manager?.name ?? '',
        ...(manager ? { managerId: manager.id } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        workerLead: '',
        where: 'farm',
      },
    });
    append({ kind: 'sys', payload: { t: 'numbering_set', numbering: mode } });
    if (priceParsed.satang !== null) append({ kind: 'sys', payload: { t: 'price_set', satangPerKg: priceParsed.satang, indexRef: '' } });
    router.push({ pathname: '/sale/[id]/points', params: { id: saleId, pair: pair.pairId } });
  };

  const label = (text: string) => <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{text}</Text>;
  const value = (text: string, testID?: string) => (
    <Text testID={testID} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.lead, fontWeight: t.font.weight.bold, color: t.color.ink }}>
      {text}
    </Text>
  );

  return (
    <FarmScreen
      title={msg('start.title')}
      back={'/' as Href}
      footer={
        <Button testID="start-next" variant="primary" onPress={next}>
          {msg('start.next')}
        </Button>
      }
    >
      <Card>
        {label(msg('start.date'))}
        <ThaiDate ts={now} />
        <View testID="start-buyer" style={{ gap: t.space.xs }}>
          {label(msg('start.buyer'))}
          {value(buyer?.name ?? msg('start.noBuyer'))}
          {buyer && buyer.id === latestId ? label(`✓ ${msg('start.buyerLatest')}`) : null}
          <ChipRow>
            {buyers.map((b) => (
              <Chip key={b.id} testID={`start-buyer-${b.id}`} label={b.name} on={b.id === buyerId} onPress={() => setBuyerId(b.id)} />
            ))}
          </ChipRow>
        </View>
        <View testID="start-manager">
          {label(msg('start.manager'))}
          {value(manager?.name ?? '—')}
          {manager ? label(msg('start.managerAuto')) : null}
        </View>
        <TextField
          testID="start-price"
          label={msg('start.price')}
          value={price}
          onChangeText={setPrice}
          error={tried && !priceParsed.ok ? msg('start.badPrice') : null}
        />
        {label(msg('start.pair'))}
        <ChipRow>
          {settings.pairs.map((p) => (
            <Chip
              key={p.pairId}
              testID={`start-pair-${p.pairId}`}
              label={`${p.netG / 1000} ${msg('common.kg')}`}
              on={p.pairId === pair.pairId}
              onPress={() => setPairId(p.pairId)}
            />
          ))}
        </ChipRow>
        {label(msg('start.groupDefault'))}
        <TextField testID="start-note" label={msg('start.note')} value={note} onChangeText={setNote} />
      </Card>

      <Card>
        {label(msg('start.numbering'))}
        {(['per-tapper', 'per-point'] as NumberingMode[]).map((m) => (
          <Pressable
            key={m}
            testID={`start-numbering-${m}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setNumbering(m)}
            style={{
              minHeight: t.target.min,
              justifyContent: 'center',
              padding: t.space.sm,
              borderRadius: t.radius.md,
              borderWidth: mode === m ? t.border.thick : t.border.hair,
              borderColor: mode === m ? t.color.action : t.color.ruleStrong,
              backgroundColor: mode === m ? t.color.actionSunk : t.color.surfaceRaised,
            }}
          >
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
              {msg(m === 'per-tapper' ? 'saleSettings.perTapper' : 'saleSettings.perPoint')}
            </Text>
            {label(msg(m === 'per-tapper' ? 'saleSettings.perTapperHelp' : 'saleSettings.perPointHelp'))}
          </Pressable>
        ))}
        {label(msg('start.groupDefault'))}
      </Card>

      <Card>
        {label(msg('start.scale'))}
        <ChipRow>
          <Chip testID="start-scale-whole" label={msg('saleSettings.scaleWhole')} on onPress={() => undefined} />
        </ChipRow>
        {label(msg('saleSettings.scaleDecimal'))}
      </Card>
      {tried && !priceParsed.ok ? <FieldError text={msg('start.badPrice')} /> : null}
    </FarmScreen>
  );
}
