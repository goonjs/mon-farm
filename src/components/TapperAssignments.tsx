/**
 * Who taps this point, when (E03-S05, mockup v1.1.0 screens 15–16).
 *
 * One tapper per point per day; a change is planned on this screen only, one
 * point at a time: a new tapper from a start day (blank = no start date), or
 * a last day with nobody after it. The previous tapper's end is derived — the
 * day before the new start (D-63) — and shown before saving. A plan that has
 * not started can be cancelled (D-74 F3); editing one is cancel + plan again.
 */

import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  activeTapperOn,
  blankStartAllowed,
  dayAfter,
  dayBefore,
  filterPeople,
  parseThaiDay,
  plannedVacancies,
  pointTimeline,
  todayIso,
  type MasterState,
} from '../core/master';
import { useT } from '../i18n';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';
import { Button, Pill } from './chrome';
import { Card, Chip, ChipRow, FieldError, LinkButton, StateBadge, TextField } from './farm-ui';
import { ThaiDate } from './ThaiDate';

const dayTs = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

export function TapperAssignments({ pointId, startOpen = false }: { pointId: string; startOpen?: boolean }) {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [now] = useState(() => Date.now());
  const [planning, setPlanning] = useState(startOpen);
  const [mode, setMode] = useState<'new' | 'leave'>('new');
  const [tapperId, setTapperId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    master.state().then(setState);
  }, []);
  useEffect(reload, [reload]);

  if (!state) return null;
  const today = todayIso(now);
  const timeline = pointTimeline(state, pointId);
  const current = activeTapperOn(state, pointId, today);
  const nameOf = (id: string) => state.people.find((p) => p.id === id)?.name ?? '';
  const tappers = filterPeople(state.people, 'tapper');

  const fromDay = from.trim() ? parseThaiDay(from) : null;
  const toDay = parseThaiDay(to);
  // No start date reaches back over the whole past: only for the first assignment (D-63).
  const blankOk = blankStartAllowed(state, pointId);
  const fromBad = from.trim() ? !fromDay : !blankOk;
  const vacancies = plannedVacancies(state, pointId, today);
  const valid = mode === 'new' ? !!tapperId && !fromBad : !!toDay;
  // Whoever has the point the day the change starts is the one who ends the day before.
  const outgoing = fromDay ? activeTapperOn(state, pointId, fromDay) : null;

  const save = async () => {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (mode === 'new' && tapperId) await master.assignTapper(pointId, tapperId, fromDay);
      if (mode === 'leave' && toDay) await master.endTapper(pointId, dayAfter(toDay));
    } finally {
      setBusy(false);
    }
    setPlanning(false);
    setTried(false);
    setTapperId(null);
    setFrom('');
    setTo('');
    reload();
  };

  const cancelPlan = async (assignmentId: string) => {
    await master.remove(assignmentId);
    reload();
  };

  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };

  return (
    <View style={{ gap: t.space.md }}>
      <Card testID="timeline">
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {msg('assign.title')}
        </Text>
        {!current ? <StateBadge testID="no-tapper" text={`⚠ ${msg('assign.none')}`} /> : null}
        {timeline.map((seg) => {
          const planned = seg.from !== null && seg.from > today;
          const isNow = (seg.from === null || seg.from <= today) && (seg.to === null || seg.to >= today);
          return (
            <View key={seg.assignmentId} style={{ gap: 2, paddingVertical: t.space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                  {nameOf(seg.tapperId)}
                </Text>
                {isNow ? <Pill tone="accept">{msg('assign.now')}</Pill> : null}
                {planned ? <Pill tone="warn">{msg('assign.planned')}</Pill> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, flexWrap: 'wrap' }}>
                <Text style={small}>{msg('assign.from')}</Text>
                {seg.from ? <ThaiDate ts={dayTs(seg.from)} /> : <Text style={small}>{msg('assign.noStart')}</Text>}
                {seg.to ? (
                  <>
                    <Text style={small}>· {msg('assign.to')}</Text>
                    <ThaiDate ts={dayTs(seg.to)} />
                  </>
                ) : null}
              </View>
              {planned ? (
                <LinkButton testID={`cancel-plan-${seg.assignmentId}`} label={msg('assign.cancelPlan')} onPress={() => void cancelPlan(seg.assignmentId)} />
              ) : null}
            </View>
          );
        })}
        {vacancies.map((v) => (
          <View key={v.assignmentId} testID={`vacancy-${v.assignmentId}`} style={{ gap: 2, paddingVertical: t.space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                {msg('assign.none')}
              </Text>
              <Pill tone="warn">{msg('assign.planned')}</Pill>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
              <Text style={small}>{msg('assign.from')}</Text>
              <ThaiDate ts={dayTs(v.from)} />
            </View>
            <LinkButton testID={`cancel-plan-${v.assignmentId}`} label={msg('assign.cancelPlan')} onPress={() => void cancelPlan(v.assignmentId)} />
          </View>
        ))}
      </Card>

      {planning ? (
        <Card testID="plan">
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
            {msg('assign.plan')}
          </Text>
          <ChipRow>
            <Chip testID="plan-new" label={msg('assign.newPerson')} on={mode === 'new'} onPress={() => setMode('new')} />
            <Chip testID="plan-leave" label={msg('assign.leave')} on={mode === 'leave'} onPress={() => setMode('leave')} />
          </ChipRow>
          {mode === 'new' ? (
            <>
              <Text style={small}>{msg('assign.pickTapper')}</Text>
              <ChipRow>
                {tappers.map((p) => (
                  <Chip key={p.id} testID={`plan-tapper-${p.id}`} label={p.name} on={tapperId === p.id} onPress={() => setTapperId(p.id)} />
                ))}
              </ChipRow>
              {tried && !tapperId ? <FieldError text={msg('assign.pickTapper')} /> : null}
              <TextField
                testID="plan-from"
                label={msg(blankOk ? 'assign.fromLabel' : 'assign.fromRequired')}
                value={from}
                onChangeText={setFrom}
                error={tried && fromBad ? msg(from.trim() ? 'assign.badDate' : 'assign.needFrom') : null}
              />
              {outgoing && fromDay && outgoing.id !== tapperId ? (
                <View testID="plan-preview" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                  <Text style={small}>{msg('assign.endsOn', { name: outgoing.name })}</Text>
                  <ThaiDate ts={dayTs(dayBefore(fromDay))} />
                </View>
              ) : null}
            </>
          ) : (
            <TextField
              testID="plan-to"
              label={msg('assign.toLabel')}
              value={to}
              onChangeText={setTo}
              error={tried && !toDay ? msg('assign.badDate') : null}
            />
          )}
          <Text style={small}>{msg('assign.planHelp')}</Text>
          <Button testID="plan-save" variant="primary" onPress={() => void save()}>
            {msg('assign.save')}
          </Button>
        </Card>
      ) : (
        <Button testID="plan-change" onPress={() => setPlanning(true)}>
          {msg('assign.plan')}
        </Button>
      )}
    </View>
  );
}
