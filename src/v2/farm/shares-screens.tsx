/**
 * ส่วนแบ่ง (E03-S06) on v2 — farm mockup 17.
 *
 * - SharesScreen (/v2/shares): every tapper with today's share of gross.
 * - ShareScreen (/v2/share/<tapperId>): 50/50 unless set (MD-8); the choice
 *   is 50/50 or custom (owner comment 2026-10-05), custom takes the TAPPER's
 *   whole percent and shows the owner's at once. A change starts on a day
 *   after the tapper's latest closed sale (D-74 F17) and never reaches back
 *   before its own start; the history keeps every entry.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  earliestShareDay,
  filterPeople,
  parseTapperPct,
  parseThaiDay,
  shareFromAllowed,
  shareHistory,
  shareOn,
  thaiDayInput,
  todayIso,
} from '../../core/master';
import { useT } from '../../i18n';
import { ShareTooEarlyError } from '../../store/master-store';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import { AppText, CalendarIcon, Card, Check, CTA, FactRow, FarmIcon, FieldError, IconTile, MenuItem, PercentIcon, PersonIcon, SegmentedControl, TextField } from '../../ui';
import { NotFound } from './people-screens';
import { FarmScreen, RowCard, useDay, useMaster, useMounted } from './pieces';

const SHARES = '/v2/shares' as Href;

export function SharesScreen() {
  const msg = useT();
  const router = useRouter();
  const { state } = useMaster();
  const [today] = useState(() => todayIso(Date.now()));
  const tappers = state ? filterPeople(state.people, 'tapper') : [];
  return (
    <FarmScreen title={msg('v2.shares')} subtitle={msg('farmData.title')} fallback={'/v2/farm' as Href} testID="shares">
      {state && tappers.length === 0 ? <AppText variant="bodySm">{msg('v2f.sharesEmpty')}</AppText> : null}
      {state && tappers.length > 0 ? (
        <RowCard>
          {tappers.map((p) => {
            const share = shareOn(state, p.id, today);
            return (
              <MenuItem
                key={p.id}
                testID={`share-${p.id}`}
                label={p.name}
                onPress={() => router.push(`/v2/share/${p.id}` as Href)}
                leading={<IconTile tone="action" icon={(c) => <PercentIcon color={c} size={20} />} />}
              >
                <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{msg('share.tapper', { n: share.tapperPct })}</FactRow>
                <FactRow icon={(c) => <FarmIcon color={c} size={12} />}>{msg('share.owner', { n: share.ownerPct })}</FactRow>
                {share.isDefault ? <FactRow icon={(c) => <Check color={c} size={10} />}>{msg('personDetail.shareDefault')}</FactRow> : null}
              </MenuItem>
            );
          })}
        </RowCard>
      ) : null}
    </FarmScreen>
  );
}

export function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mounted = useMounted();
  if (!mounted || !id) return <FarmScreen title="" fallback={SHARES} />;
  return <TapperShare key={id} tapperId={id} />;
}

function TapperShare({ tapperId }: { tapperId: string }) {
  const t = useTheme();
  const msg = useT();
  const day = useDay();
  const { state, reload } = useMaster();
  const [lastClosed, setLastClosed] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [mode, setMode] = useState<'5050' | 'custom'>('5050');
  const [pct, setPct] = useState('');
  const [from, setFrom] = useState(() => thaiDayInput(todayIso(now)));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    peopleStore.lastClosedSaleDay(tapperId).then(
      (d) => live && setLastClosed(d),
      () => live && setLastClosed(null),
    );
    return () => {
      live = false;
    };
  }, [tapperId]);

  const person = state?.people.find((p) => p.id === tapperId);
  if (!state) return <FarmScreen title="" fallback={SHARES} />;
  if (!person) return <NotFound fallback={SHARES} />;

  const today = todayIso(now);
  const current = shareOn(state, tapperId, today);
  const history = shareHistory(state, tapperId);
  const parsed = mode === 'custom' ? parseTapperPct(pct) : ({ ok: true, tapperPct: 50 } as const);
  const fromDay = parseThaiDay(from);
  const tooEarly = !!fromDay && !shareFromAllowed(fromDay, lastClosed);
  const earliest = earliestShareDay(lastClosed);

  const save = async () => {
    setTried(true);
    if (!parsed.ok || !fromDay || tooEarly || busy) return;
    setBusy(true);
    try {
      await peopleStore.setShare(tapperId, parsed.tapperPct, fromDay);
    } catch (err) {
      // Saved before the latest closed sale had loaded: show it, as if it had.
      if (err instanceof ShareTooEarlyError) return setLastClosed(err.lastClosedSaleDay);
      throw err;
    } finally {
      setBusy(false);
    }
    setTried(false);
    setMode('5050');
    setPct('');
    reload();
  };

  return (
    <FarmScreen
      title={msg('share.title')}
      subtitle={person.name}
      fallback={`/v2/person/${tapperId}` as Href}
      testID="share"
      footer={
        <CTA testID="share-save" icon={(c) => <Check color={c} size={14} />} onPress={() => void save()}>
          {msg('common.save')}
        </CTA>
      }
    >
      <Card testID="share-now" style={{ alignItems: 'center' }}>
        <AppText variant="bodySm">{msg('share.now')}</AppText>
        <AppText style={{ fontSize: t.font.size.displayLg, lineHeight: Math.round(t.font.size.displayLg * 1.3), fontWeight: t.font.weight.bold }}>
          {msg('share.tapper', { n: current.tapperPct })}
        </AppText>
        <AppText variant="bodySm">{msg('share.owner', { n: current.ownerPct })}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          {current.isDefault ? <Check color={t.color.inkSoft} size={10} /> : null}
          <AppText variant="bodySm">{msg(current.isDefault ? 'share.default' : 'share.gross')}</AppText>
        </View>
      </Card>

      <View style={{ gap: t.space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
          <AppText variant="label">{msg('v2f.changeTo')}</AppText>
          <AppText variant="caption">{msg('v2f.changeToHint')}</AppText>
        </View>
        <SegmentedControl<'5050' | 'custom'>
          testID="share-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: '5050', label: msg('v2f.shareFifty') },
            { value: 'custom', label: msg('share.custom') },
          ]}
        />
      </View>
      {mode === 'custom' ? (
        <TextField
          testID="share-pct"
          label={msg('v2f.pctLabel')}
          required
          hint={msg('v2f.pctHint')}
          keyboardType="number-pad"
          value={pct}
          onChangeText={setPct}
          aside={
            <AppText testID="share-owner" variant="bodySm">
              {parsed.ok ? msg('share.ownerGets', { n: 100 - parsed.tapperPct }) : ''}
            </AppText>
          }
          error={tried && !parsed.ok ? msg(parsed.reason === 'range' ? 'share.range' : 'share.whole') : undefined}
        />
      ) : null}
      <TextField
        testID="share-from"
        label={msg('v2f.effective')}
        required
        hint={msg('v2f.dateHint')}
        value={from}
        onChangeText={setFrom}
        error={tried && !fromDay ? msg('share.badDate') : undefined}
      />
      {tried && tooEarly && lastClosed && earliest ? (
        <FieldError testID="share-too-early">{msg('share.tooEarly', { closed: day(lastClosed), earliest: day(earliest) })}</FieldError>
      ) : null}

      <RowCard testID="share-history" title={msg('share.history')}>
        {history.length === 0 ? (
          <View style={{ paddingVertical: t.space.sm, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2f.neverChanged')}</AppText>
            <FactRow icon={(c) => <Check color={c} size={10} />}>{msg('v2f.useDefault')}</FactRow>
          </View>
        ) : null}
        {history.map((h) => (
          <View key={h.shareId} style={{ paddingVertical: t.space.sm, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('v2f.shareRow', { tapper: h.tapperPct, owner: 100 - h.tapperPct })}</AppText>
            <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('v2f.since', { date: day(h.from) })}</FactRow>
          </View>
        ))}
      </RowCard>
    </FarmScreen>
  );
}
