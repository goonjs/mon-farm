/**
 * A tapper's share of gross, over time (E03-S06, mockup v1.1.0 screen 17).
 *
 * 50/50 unless set (MD-8). The choice is 50/50 or custom (owner comment
 * 2026-10-05 on the mockup, replacing the 60/40 and 70/30 buttons); custom
 * takes the TAPPER's side as a whole number 0–100 and shows the owner's
 * (D-63 Q17). A new share starts the day after the tapper's latest closed
 * sale at the earliest (D-63 Q18, D-74 F17), and never reaches back before
 * its own start.
 */

import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  earliestShareDay,
  formatThaiDate,
  parseTapperPct,
  parseThaiDay,
  shareFromAllowed,
  shareHistory,
  shareOn,
  thaiDayInput,
  todayIso,
  type MasterState,
} from '../core/master';
import { useT } from '../i18n';
import { ShareTooEarlyError } from '../store/master-store';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, FieldError, TextField } from './farm-ui';
import { ThaiDate } from './ThaiDate';

const dayTs = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

export function TapperShare({ tapperId }: { tapperId: string }) {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [lastClosed, setLastClosed] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [custom, setCustom] = useState(false);
  const [pct, setPct] = useState('');
  const [from, setFrom] = useState(() => thaiDayInput(todayIso(now)));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    master.state().then(setState);
    master.lastClosedSaleDay(tapperId).then(setLastClosed);
  }, [tapperId]);
  useEffect(reload, [reload]);

  if (!state) return null;
  const today = todayIso(now);
  const current = shareOn(state, tapperId, today);
  const history = shareHistory(state, tapperId);
  const parsed = custom ? parseTapperPct(pct) : ({ ok: true, tapperPct: 50 } as const);
  const fromDay = parseThaiDay(from);
  const tooEarly = !!fromDay && !shareFromAllowed(fromDay, lastClosed);

  const save = async () => {
    setTried(true);
    if (!parsed.ok || !fromDay || tooEarly || busy) return;
    setBusy(true);
    try {
      await master.setShare(tapperId, parsed.tapperPct, fromDay);
    } catch (err) {
      // Saved before the latest closed sale had loaded: show it, as if it had.
      if (err instanceof ShareTooEarlyError) return setLastClosed(err.lastClosedSaleDay);
      throw err;
    } finally {
      setBusy(false);
    }
    setTried(false);
    setCustom(false);
    setPct('');
    reload();
  };

  const bold = { fontFamily: t.font.family.sans, fontWeight: t.font.weight.bold, color: t.color.ink };
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };
  const earliest = earliestShareDay(lastClosed);

  return (
    <View style={{ gap: t.space.md }}>
      <Card testID="share-now">
        <Text style={small}>{msg('share.now')}</Text>
        <Text style={[bold, { fontSize: t.font.size.headingXl }]}>{msg('share.tapper', { n: current.tapperPct })}</Text>
        <Text style={small}>{msg('share.owner', { n: current.ownerPct })}</Text>
        <Text style={small}>{current.isDefault ? `✓ ${msg('share.default')}` : msg('share.gross')}</Text>
      </Card>

      <Card>
        <Text style={[bold, { fontSize: t.font.size.bodyMd }]}>{msg('share.changeTo')}</Text>
        <ChipRow>
          <Chip testID="share-5050" label="50/50" on={!custom} onPress={() => setCustom(false)} />
          <Chip testID="share-custom" label={msg('share.custom')} on={custom} onPress={() => setCustom(true)} />
        </ChipRow>
        {custom ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space.sm }}>
            <TextField testID="share-pct" label={msg('share.pct')} value={pct} onChangeText={setPct} />
            {parsed.ok ? (
              <Text testID="share-owner" style={[small, { paddingBottom: t.space.md }]}>
                {msg('share.ownerGets', { n: 100 - parsed.tapperPct })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {tried && !parsed.ok ? <FieldError text={msg(parsed.reason === 'range' ? 'share.range' : 'share.whole')} /> : null}
        <TextField
          testID="share-from"
          label={msg('share.from')}
          value={from}
          onChangeText={setFrom}
          error={tried && !fromDay ? msg('share.badDate') : null}
        />
        {tried && tooEarly && lastClosed && earliest ? (
          <View testID="share-too-early">
            <FieldError
              text={msg('share.tooEarly', {
                closed: formatThaiDate(dayTs(lastClosed), 'be'),
                earliest: formatThaiDate(dayTs(earliest), 'be'),
              })}
            />
          </View>
        ) : null}
        <Button testID="share-save" variant="primary" onPress={() => void save()}>
          {msg('common.save')}
        </Button>
      </Card>

      <Card testID="share-history">
        <Text style={[bold, { fontSize: t.font.size.bodyMd }]}>{msg('share.history')}</Text>
        {history.length === 0 ? <Text style={small}>{msg('share.never')}</Text> : null}
        {history.map((h) => (
          <View key={h.shareId} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
              {msg('share.historyRow', { tapper: h.tapperPct, owner: 100 - h.tapperPct })}
            </Text>
            <ThaiDate ts={dayTs(h.from)} />
          </View>
        ))}
      </Card>
    </View>
  );
}
