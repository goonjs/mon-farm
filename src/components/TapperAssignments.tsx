/**
 * Who taps this point, when (E03-S05, mockup v1.1.0 farm-20/21).
 *
 * One tapper per point per day; a change is planned one point at a time: a
 * new tapper from a start day (blank = no start date, first assignment only),
 * or a last day with nobody after it. The previous tapper's end is derived —
 * the day before the new start (D-63) — and shown before saving. A plan that
 * has not started can be cancelled (D-74 F3); "แก้แผน" is cancel + plan again
 * in one save.
 *
 * Two parts, so the point's detail can put the plan in a sheet (farm-21):
 * `AssignmentTimeline` (the card) and `PlanChangeForm` (the plan). The
 * `TapperAssignments` composite keeps both inline, for right after a new
 * point is saved.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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
import { Card, Chip, ChipRow, FieldError, StateBadge, TextField } from './farm-ui';
import { ThaiDate } from './ThaiDate';

const dayTs = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

/** A plan not started yet, on this point: a new tapper or a planned leave. */
export function pendingPlans(state: MasterState, pointId: string, today: string): string[] {
  const starts = pointTimeline(state, pointId)
    .filter((seg) => seg.from !== null && seg.from > today)
    .map((seg) => seg.assignmentId);
  return [...starts, ...plannedVacancies(state, pointId, today).map((v) => v.assignmentId)];
}

export function AssignmentTimeline({
  state,
  pointId,
  today,
  onCancelPlan,
  onEditPlan,
}: {
  state: MasterState;
  pointId: string;
  today: string;
  onCancelPlan: (assignmentId: string) => void;
  /** When given, a pending plan shows "แก้แผน" next to "ยกเลิกแผน" (farm-20). */
  onEditPlan?: (assignmentId: string) => void;
}) {
  const t = useTheme();
  const msg = useT();
  const timeline = pointTimeline(state, pointId);
  const current = activeTapperOn(state, pointId, today);
  const vacancies = plannedVacancies(state, pointId, today);
  const nameOf = (id: string) => state.people.find((p) => p.id === id)?.name ?? '';
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };
  const bold = { fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink };

  const planButtons = (assignmentId: string) => (
    <View style={{ flexDirection: 'row', gap: t.space.sm }}>
      {onEditPlan ? (
        <View style={{ flex: 1 }}>
          <Button testID={`edit-plan-${assignmentId}`} onPress={() => onEditPlan(assignmentId)}>
            {msg('assign.editPlan')}
          </Button>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Button testID={`cancel-plan-${assignmentId}`} onPress={() => onCancelPlan(assignmentId)}>
          {msg('assign.cancelPlan')}
        </Button>
      </View>
    </View>
  );

  return (
    <Card testID="timeline">
      <Text style={{ ...bold, fontSize: t.font.size.bodyMd }}>{msg('assign.title')}</Text>
      {!current ? <StateBadge testID="no-tapper" text={`⚠ ${msg('assign.none')}`} /> : null}
      {timeline.map((seg) => {
        const planned = seg.from !== null && seg.from > today;
        const isNow = (seg.from === null || seg.from <= today) && (seg.to === null || seg.to >= today);
        return (
          <View key={seg.assignmentId} style={{ gap: 2, paddingVertical: t.space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
              <Text style={{ ...bold, flex: 1 }}>{nameOf(seg.tapperId)}</Text>
              {isNow ? <Pill tone="accept">{msg('assign.now')}</Pill> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, flexWrap: 'wrap' }}>
              <Text style={small}>{`${msg('assign.from')}:`}</Text>
              {seg.from ? <ThaiDate ts={dayTs(seg.from)} /> : <Text style={small}>{msg('assign.unset')}</Text>}
            </View>
            {seg.to ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                <Text style={small}>{msg('assign.to')}</Text>
                <ThaiDate ts={dayTs(seg.to)} />
              </View>
            ) : null}
            {planned ? (
              <>
                <Text style={{ ...small, color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('assign.plannedNotYet')}</Text>
                {planButtons(seg.assignmentId)}
              </>
            ) : null}
          </View>
        );
      })}
      {vacancies.map((v) => (
        <View key={v.assignmentId} testID={`vacancy-${v.assignmentId}`} style={{ gap: 2, paddingVertical: t.space.xs }}>
          <Text style={bold}>{msg('assign.none')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
            <Text style={small}>{`${msg('assign.from')}:`}</Text>
            <ThaiDate ts={dayTs(v.from)} />
          </View>
          <Text style={{ ...small, color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('assign.plannedNotYet')}</Text>
          {planButtons(v.assignmentId)}
        </View>
      ))}
    </Card>
  );
}

export function PlanChangeForm({
  state,
  pointId,
  replacing,
  onSaved,
}: {
  state: MasterState;
  pointId: string;
  /** "แก้แผน": this pending plan is cancelled in the same save. */
  replacing?: string | null;
  onSaved: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [mode, setMode] = useState<'new' | 'leave'>('new');
  const [tapperId, setTapperId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const tappers = filterPeople(state.people, 'tapper');
  const fromDay = from.trim() ? parseThaiDay(from) : null;
  const toDay = parseThaiDay(to);
  // No start date reaches back over the whole past: only for the first assignment (D-63).
  const blankOk = blankStartAllowed(state, pointId) && !replacing;
  const fromBad = from.trim() ? !fromDay : !blankOk;
  const valid = mode === 'new' ? !!tapperId && !fromBad : !!toDay;
  // Whoever has the point the day the change starts is the one who ends the day before.
  const outgoing = fromDay ? activeTapperOn(state, pointId, fromDay) : null;
  const incoming = state.people.find((p) => p.id === tapperId);
  const small = { fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft };

  const save = async () => {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (replacing) await master.remove(replacing);
      if (mode === 'new' && tapperId) await master.assignTapper(pointId, tapperId, fromDay);
      if (mode === 'leave' && toDay) await master.endTapper(pointId, dayAfter(toDay));
    } finally {
      setBusy(false);
    }
    onSaved();
  };

  return (
    <View testID="plan" style={{ gap: t.space.sm }}>
      <ChoiceCard testID="plan-new" title={msg('assign.newPerson')} hint={msg('assign.newPersonHint')} on={mode === 'new'} onPress={() => setMode('new')} />
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
            <View testID="plan-preview" style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.sm, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                <Text style={small}>{msg('assign.endsOn', { name: outgoing.name })}</Text>
                <ThaiDate ts={dayTs(dayBefore(fromDay))} />
              </View>
              {incoming ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                  <Text style={small}>{msg('assign.startsOn', { name: incoming.name })}</Text>
                  <ThaiDate ts={dayTs(fromDay)} />
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
      <ChoiceCard testID="plan-leave" title={msg('assign.leave')} hint={msg('assign.leaveHint')} on={mode === 'leave'} onPress={() => setMode('leave')} />
      {mode === 'leave' ? (
        <TextField
          testID="plan-to"
          label={msg('assign.toLabel')}
          value={to}
          onChangeText={setTo}
          error={tried && !toDay ? msg('assign.badDate') : null}
        />
      ) : null}
      <Text style={small}>{msg('assign.planHelp')}</Text>
      <Button testID="plan-save" variant="primary" onPress={() => void save()}>
        {msg('assign.save')}
      </Button>
    </View>
  );
}

/** A radio card (mockup farm-21): a ● or ○, a title and one line of hint. */
function ChoiceCard({ testID, title, hint, on, onPress }: { testID: string; title: string; hint: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.sm,
        minHeight: t.target.comfortable,
        padding: t.space.md,
        borderRadius: t.radius.lg,
        borderWidth: on ? t.border.thick : t.border.hair,
        borderColor: on ? t.color.action : t.color.ruleStrong,
        backgroundColor: on ? t.color.actionSunk : t.color.surfaceRaised,
      }}
    >
      <Text style={{ fontSize: t.font.size.headingMd, color: on ? t.color.action : t.color.inkSoft }}>{on ? '◉' : '○'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>{title}</Text>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{hint}</Text>
      </View>
    </Pressable>
  );
}

/** Timeline and plan together, inline — right after a new point is saved (D-74 F15). */
export function TapperAssignments({ pointId, startOpen = false }: { pointId: string; startOpen?: boolean }) {
  const [state, setState] = useState<MasterState | null>(null);
  const [now] = useState(() => Date.now());
  const [planning, setPlanning] = useState(startOpen);
  const msg = useT();
  const t = useTheme();

  const reload = useCallback(() => {
    master.state().then(setState);
  }, []);
  useEffect(reload, [reload]);

  if (!state) return null;
  const today = todayIso(now);
  return (
    <View style={{ gap: t.space.md }}>
      <AssignmentTimeline
        state={state}
        pointId={pointId}
        today={today}
        onCancelPlan={(id) => void master.remove(id).then(reload)}
      />
      {planning ? (
        <Card>
          <PlanChangeForm
            state={state}
            pointId={pointId}
            onSaved={() => {
              setPlanning(false);
              reload();
            }}
          />
        </Card>
      ) : (
        <Button testID="plan-change" onPress={() => setPlanning(true)}>
          {msg('assign.plan')}
        </Button>
      )}
    </View>
  );
}
