/**
 * จุดชั่ง and their tappers (E03-S03, E03-S05) on v2 — farm mockup 13/13b
 * (set-up helper), 14 (add, then offer to assign), 15 (detail), 16 (plan a
 * change).
 *
 * - PointsScreen (/v2/points): every shown point under its farm, with today's
 *   tapper or "ยังไม่มีคนกรีด"; points deleted on their own behind the small
 *   link, restorable there or on their detail.
 * - PointScreen (/v2/point/<id|new>): `new?property=` adds (a name unique in
 *   its farm, D-65) then offers "เลือกคนกรีดยาง" or "ทำทีหลัง" (D-74 F15);
 *   `?edit=1` renames; otherwise the detail — who taps it when, "ตอนนี้" and
 *   "ตามแผน", a plan not started can be edited or cancelled (D-74 F3), the
 *   plan sheet (`?plan=1` opens it), and delete.
 * - PointsWizardScreen (/v2/points-wizard): farm → tappers → how many each →
 *   names, then every point and its assignment at once (D-73). Nothing
 *   farm-specific is in code; every name is the user's.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, TextInput, View } from 'react-native';

import {
  activePoints,
  activeProperty,
  activeTapperOn,
  blankStartAllowed,
  dayAfter,
  dayBefore,
  filterPeople,
  leaveDayProblem,
  parseThaiDay,
  planStarterPoints,
  plannedVacancies,
  pointTimeline,
  tapperOn,
  todayIso,
  type MasterState,
} from '../../core/master';
import { useT } from '../../i18n';
import { DuplicatePointNameError } from '../../store/master-store';
import { peopleStore } from '../../store/people';
import { useFirstPullGate } from '../../sync/use-first-pull';
import { useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  Button,
  CalendarIcon,
  Card,
  Check,
  Chip,
  CTA,
  FactRow,
  FarmIcon,
  FieldError,
  IconTile,
  MenuItem,
  PersonIcon,
  PinIcon,
  RadioCard,
  SwapIcon,
  TextField,
  TrashIcon,
  Undo,
} from '../../ui';
import { NotFound } from './people-screens';
import {
  AddCTA,
  categoryTone,
  ChipWrap,
  ConfirmSheet,
  DeletedLink,
  DeletedList,
  FarmScreen,
  HeaderButton,
  HelpNote,
  RowCard,
  Stepper,
  ToggleChip,
  useBack,
  useDay,
  useMaster,
  useMounted,
  useWrite,
  SaveFailed,
} from './pieces';

const FARMS = '/v2/farms' as Href;
const POINTS = '/v2/points' as Href;

export function PointsScreen() {
  const msg = useT();
  const router = useRouter();
  const { state, reload } = useMaster();
  const [showDeleted, setShowDeleted] = useState(false);
  const [today] = useState(() => todayIso(Date.now()));
  const farms = state?.properties.filter((p) => !p.deleted) ?? [];
  const nameOf = (id: string | null) => state?.people.find((p) => p.id === id && !p.deleted)?.name ?? null;
  // Deleted on their own; a point that went with its farm comes back with the farm (D-65).
  const deleted = state?.points.filter((p) => p.deleted && farms.some((f) => f.id === p.propertyId)) ?? [];

  const write = useWrite();
  const restore = async (id: string) => {
    if (await write.run(() => peopleStore.restore(id))) reload();
  };

  return (
    <FarmScreen
      title={msg('v2.points')}
      subtitle={msg('farmData.title')}
      fallback={'/v2/farm' as Href}
      failed={write.failed}
      testID="points"
      footer={farms.length && !showDeleted ? <AddCTA testID="add-point" label={msg('v2f.addPoint')} onPress={() => router.push('/v2/point/new' as Href)} /> : undefined}
    >
      {showDeleted ? (
        <>
          <AppText variant="label">{msg('v2f.deletedTitle')}</AppText>
          <DeletedList
            rows={deleted.map((p) => ({ id: p.id, name: p.name, facts: [farms.find((f) => f.id === p.propertyId)?.name ?? ''] }))}
            onRestore={(id) => void restore(id)}
          />
          <Button testID="hide-deleted" onPress={() => setShowDeleted(false)}>
            {msg('v2.back')}
          </Button>
        </>
      ) : (
        <>
          {state && farms.length === 0 ? <AppText variant="bodySm">{msg('v2f.noFarmsYet')}</AppText> : null}
          {/* Always on offer: set up the next person's points later too (names already used are refused). */}
          {state && farms.length > 0 ? (
            <Button testID="open-wizard" variant={activePoints(state).length === 0 ? 'primary' : 'ghost'} icon={(c) => <PinIcon color={c} size={16} />} onPress={() => router.push('/v2/points-wizard' as Href)}>
              {msg('wizard.open')}
            </Button>
          ) : null}
          {state
            ? farms.map((f, i) => {
                const points = activePoints(state, f.id);
                if (points.length === 0) return null;
                return (
                  <RowCard key={f.id} testID={`points-of-${f.id}`} title={f.name}>
                    {points.map((p) => (
                      <MenuItem
                        key={p.id}
                        testID={`point-${p.id}`}
                        label={p.name}
                        onPress={() => router.push(`/v2/point/${p.id}` as Href)}
                        leading={<IconTile tone={categoryTone(i)} icon={(c) => <PinIcon color={c} size={20} />} />}
                        trailing={p.duplicateName ? <Chip tone="warn" label={msg('points.duplicate')} /> : undefined}
                      >
                        <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{nameOf(tapperOn(state, p.id, today)) ?? msg('assign.none')}</FactRow>
                      </MenuItem>
                    ))}
                  </RowCard>
                );
              })
            : null}
          <DeletedLink n={deleted.length} onPress={() => setShowDeleted(true)} />
        </>
      )}
    </FarmScreen>
  );
}

/** /v2/point/<id|new>: add (`new?property=`), rename (`?edit=1`) or the detail. */
export function PointScreen() {
  const { id, edit, property, plan } = useLocalSearchParams<{ id: string; edit?: string; property?: string; plan?: string }>();
  const mounted = useMounted();
  if (!mounted) return <FarmScreen title="" fallback={POINTS} />;
  const pointId = id && id !== 'new' ? id : null;
  if (pointId && edit !== '1') return <PointDetail key={pointId} pointId={pointId} openPlan={plan === '1'} />;
  return <PointForm key={pointId ?? 'new'} pointId={pointId} propertyId={property ?? null} />;
}

function PointForm({ pointId, propertyId }: { pointId: string | null; propertyId: string | null }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const back = useBack(propertyId ? (`/v2/property/${propertyId}` as Href) : POINTS);
  const { state } = useMaster();
  const [loaded, setLoaded] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(propertyId);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [made, setMade] = useState<{ id: string; name: string } | null>(null);
  const write = useWrite();

  const existing = pointId ? (state?.points.find((p) => p.id === pointId) ?? null) : null;
  if (existing && loaded !== existing.id) {
    setLoaded(existing.id);
    setFarmId(existing.propertyId);
    setName(existing.name);
  }
  const farms = state?.properties.filter((p) => !p.deleted) ?? [];
  const farm = farms.find((f) => f.id === farmId);

  const save = async () => {
    if (!name.trim()) return setError(msg('pointForm.needName'));
    // A new point goes only under a farm still there (the store refuses the rest too).
    if (!farmId || (!existing && !farm)) return setError(msg('v2f.pickFarm'));
    let taken = false;
    await write.run(async () => {
      try {
        if (existing) {
          await peopleStore.renamePoint(existing.id, name);
          back();
        } else {
          const p = await peopleStore.addPoint(farmId, name);
          setMade({ id: p.id, name: p.name });
        }
      } catch (err) {
        // A taken name is the user's to fix, not a failed write.
        if (!(err instanceof DuplicatePointNameError)) throw err;
        taken = true;
      }
    });
    if (taken) setError(msg('pointForm.taken', { name: name.trim() }));
  };

  if (pointId && state && !existing) return <NotFound fallback={POINTS} />;
  // `?property=` naming a farm that is missing or deleted: say so, never an orphan point.
  if (!pointId && propertyId && state && !activeProperty(state, propertyId)) return <NotFound fallback={POINTS} />;

  if (made) {
    return (
      <FarmScreen title={farm?.name ?? msg('v2.points')} subtitle={msg('v2.points')} fallback={POINTS}>
        <Card testID="offer-assign">
          <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{msg('assign.offerTitle')}</AppText>
          <AppText>{msg('assign.offerBody', { name: made.name })}</AppText>
          <Button testID="offer-now" variant="primary" icon={(c) => <PersonIcon color={c} size={16} />} onPress={() => router.replace(`/v2/point/${made.id}?plan=1` as Href)}>
            {msg('assign.offerNow')}
          </Button>
          <Button testID="offer-later" onPress={back}>
            {msg('assign.offerLater')}
          </Button>
        </Card>
      </FarmScreen>
    );
  }

  return (
    <FarmScreen
      title={msg(existing ? 'v2f.renamePoint' : 'pointForm.addTitle')}
      fallback={POINTS}
      failed={write.failed}
      testID="point-form"
      action={{ label: msg('common.save'), testID: 'point-save', onPress: () => void save(), saving: write.saving }}
    >
      <View style={{ gap: t.space.xs }}>
        <AppText variant="label">{msg('pointForm.farm')}</AppText>
        {existing || propertyId ? (
          <View
            testID="point-farm"
            style={{
              minHeight: t.target.min,
              justifyContent: 'center',
              paddingHorizontal: t.space.md,
              borderRadius: t.radius.md,
              borderWidth: t.border.hair,
              borderColor: t.color.ruleStrong,
              backgroundColor: t.color.surfaceRaised,
            }}
          >
            <AppText style={{ fontWeight: t.font.weight.semibold }}>{farm?.name ?? ''}</AppText>
          </View>
        ) : (
          <ChipWrap>
            {farms.map((f) => (
              <ToggleChip key={f.id} testID={`point-farm-${f.id}`} label={f.name} on={farmId === f.id} onPress={() => setFarmId(f.id)} />
            ))}
          </ChipWrap>
        )}
      </View>
      <TextField
        testID="point-name"
        label={msg('v2f.pointName')}
        required
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        error={error}
      />
      <HelpNote lines={[msg('v2f.pointHelp1'), msg('v2f.pointHelp2'), msg('v2f.pointHelp3'), msg('v2f.pointHelp4')]} />
    </FarmScreen>
  );
}

type Sheet = { kind: 'none' } | { kind: 'plan'; replacing: string | null } | { kind: 'delete' };

function PointDetail({ pointId, openPlan }: { pointId: string; openPlan: boolean }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const day = useDay();
  const { state, reload } = useMaster();
  const [sheet, setSheet] = useState<Sheet>(openPlan ? { kind: 'plan', replacing: null } : { kind: 'none' });
  const [today] = useState(() => todayIso(Date.now()));
  const write = useWrite();

  const point = state?.points.find((p) => p.id === pointId);
  const farm = state?.properties.find((f) => f.id === point?.propertyId);
  const back = useBack(farm ? (`/v2/property/${farm.id}` as Href) : POINTS);
  if (!state) return <FarmScreen title="" fallback={POINTS} />;
  if (!point) return <NotFound fallback={POINTS} />;

  const timeline = pointTimeline(state, point.id);
  const current = activeTapperOn(state, point.id, today);
  const vacancies = plannedVacancies(state, point.id, today);
  const tappers = filterPeople(state.people, 'tapper');
  const nameOf = (id: string) => state.people.find((p) => p.id === id)?.name ?? '';
  const toneOf = (id: string) => categoryTone(4 + Math.max(0, tappers.findIndex((p) => p.id === id)));
  const farmIndex = state.properties.filter((p) => !p.deleted).findIndex((p) => p.id === point.propertyId);

  const cancelPlan = async (id: string) => {
    if (await write.run(() => peopleStore.remove(id))) reload();
  };
  const remove = async () => {
    if (!(await write.run(() => peopleStore.remove(point.id)))) return;
    setSheet({ kind: 'none' });
    back();
  };
  const restore = async () => {
    if (await write.run(() => peopleStore.restore(point.id))) reload();
  };

  const planButtons = (assignmentId: string) => (
    <View style={{ flexDirection: 'row', gap: t.space.sm, paddingBottom: t.space.sm }}>
      <View style={{ flex: 1 }}>
        <Button testID={`edit-plan-${assignmentId}`} onPress={() => setSheet({ kind: 'plan', replacing: assignmentId })}>
          {msg('assign.editPlan')}
        </Button>
      </View>
      <View style={{ flex: 1 }}>
        <Button testID={`cancel-plan-${assignmentId}`} icon={(c) => <Undo color={c} size={12} />} onPress={() => void cancelPlan(assignmentId)}>
          {msg('assign.cancelPlan')}
        </Button>
      </View>
    </View>
  );

  return (
    <FarmScreen
      title={point.name}
      subtitle={farm?.name}
      fallback={farm ? (`/v2/property/${farm.id}` as Href) : POINTS}
      failed={write.failed && sheet.kind === 'none'}
      testID="point-detail"
      right={<HeaderButton testID="point-rename" label={msg('pointDetail.rename')} onPress={() => router.push(`/v2/point/${point.id}?edit=1` as Href)} />}
      overlay={
        <>
          {sheet.kind === 'plan' ? (
            <PlanForm
              state={state}
              pointId={point.id}
              pointName={point.name}
              replacing={sheet.replacing}
              onClose={() => setSheet({ kind: 'none' })}
              onSaved={() => {
                setSheet({ kind: 'none' });
                reload();
              }}
            />
          ) : null}
          <ConfirmSheet
            open={sheet.kind === 'delete'}
            title={msg('pointForm.deleteTitle', { name: point.name })}
            lines={msg('pointForm.deleteBody').split(' · ')}
            confirmLabel={msg('pointForm.deleteYes')}
            onConfirm={() => void remove()}
            onClose={() => setSheet({ kind: 'none' })}
            failed={write.failed}
          />
        </>
      }
    >
      <RowCard testID="point-summary">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm }}>
          <IconTile tone={categoryTone(Math.max(0, farmIndex))} icon={(c) => <PinIcon color={c} size={22} />} />
          <View style={{ flex: 1, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{point.name}</AppText>
            <FactRow icon={(c) => <FarmIcon color={c} size={12} />}>{farm?.name ?? ''}</FactRow>
          </View>
          {point.duplicateName ? <Chip tone="warn" label={msg('points.duplicate')} /> : null}
        </View>
      </RowCard>

      <RowCard testID="timeline" title={msg('assign.title')}>
        {!current ? (
          <View style={{ paddingVertical: t.space.sm }}>
            <Chip testID="no-tapper" tone="warn" label={msg('assign.none')} />
          </View>
        ) : null}
        {timeline.map((seg) => {
          const planned = seg.from !== null && seg.from > today;
          const isNow = (seg.from === null || seg.from <= today) && (seg.to === null || seg.to >= today);
          return (
            <View key={seg.assignmentId}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm }}>
                <IconTile tone={toneOf(seg.tapperId)} icon={(c) => <PersonIcon color={c} size={20} />} />
                <View style={{ flex: 1, gap: t.space.xxs }}>
                  <AppText style={{ fontWeight: t.font.weight.bold }}>{nameOf(seg.tapperId)}</AppText>
                  <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{seg.from ? msg('v2f.startOn', { date: day(seg.from) }) : msg('v2f.startUnset')}</FactRow>
                  {seg.to ? <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('v2f.until', { date: day(seg.to) })}</FactRow> : null}
                  {planned ? (
                    <AppText variant="bodySm" style={{ color: t.color.warn, fontWeight: t.font.weight.semibold }}>
                      {msg('assign.plannedNotYet')}
                    </AppText>
                  ) : null}
                </View>
                {isNow ? <Chip tone="accept" label={msg('assign.now')} /> : null}
              </View>
              {planned ? planButtons(seg.assignmentId) : null}
            </View>
          );
        })}
        {vacancies.map((v) => (
          <View key={v.assignmentId} testID={`vacancy-${v.assignmentId}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm }}>
              <IconTile tone="neutral" icon={(c) => <PersonIcon color={c} size={20} />} />
              <View style={{ flex: 1, gap: t.space.xxs }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('assign.none')}</AppText>
                <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('v2f.startOn', { date: day(v.from) })}</FactRow>
                <AppText variant="bodySm" style={{ color: t.color.warn, fontWeight: t.font.weight.semibold }}>
                  {msg('assign.plannedNotYet')}
                </AppText>
              </View>
            </View>
            {planButtons(v.assignmentId)}
          </View>
        ))}
      </RowCard>

      <Button testID="plan-change" icon={(c) => <SwapIcon color={c} size={16} />} onPress={() => setSheet({ kind: 'plan', replacing: null })}>
        {msg('assign.plan')}
      </Button>
      <HelpNote lines={[msg('assign.planHelp')]} />

      {point.deleted ? (
        <DeletedList rows={[{ id: point.id, name: point.name }]} onRestore={() => void restore()} />
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="point-delete" variant="destructive" icon={(c) => <TrashIcon color={c} size={16} />} onPress={() => setSheet({ kind: 'delete' })}>
            {msg('pointForm.delete')}
          </Button>
        </View>
      )}
    </FarmScreen>
  );
}

/**
 * The plan (farm mockup 16): a new tapper from a start day — blank only for
 * a point's first assignment (D-63) — or a last day with nobody after it.
 * The outgoing tapper's end is derived (the day before) and shown first.
 * "แก้แผน" cancels the old plan in the same save — after the new one is
 * written, so a failed write never leaves the point with neither; a retry
 * then only cancels the old one.
 */
function PlanForm({ state, pointId, pointName, replacing, onClose, onSaved }: { state: MasterState; pointId: string; pointName: string; replacing: string | null; onClose: () => void; onSaved: () => void }) {
  const t = useTheme();
  const msg = useT();
  const day = useDay();
  const [mode, setMode] = useState<'new' | 'leave'>('new');
  const [tapperId, setTapperId] = useState<string | null>(null);
  const [today] = useState(() => todayIso(Date.now()));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const [wrote, setWrote] = useState(false);
  const write = useWrite();

  const tappers = filterPeople(state.people, 'tapper');
  const fromDay = from.trim() ? parseThaiDay(from) : null;
  const toDay = parseThaiDay(to);
  const blankOk = blankStartAllowed(state, pointId) && !replacing;
  const fromBad = from.trim() ? !fromDay : !blankOk;
  const leaveProblem = leaveDayProblem(state, pointId, toDay, today);
  const valid = mode === 'new' ? !!tapperId && !fromBad : !leaveProblem;
  const outgoing = fromDay ? activeTapperOn(state, pointId, fromDay) : null;
  const incoming = state.people.find((p) => p.id === tapperId);

  const save = async () => {
    setTried(true);
    if (!valid) return;
    const saved = await write.run(async () => {
      if (!wrote) {
        if (mode === 'new' && tapperId) await peopleStore.assignTapper(pointId, tapperId, fromDay);
        if (mode === 'leave' && toDay) await peopleStore.endTapper(pointId, dayAfter(toDay));
        setWrote(true);
      }
      if (replacing) await peopleStore.remove(replacing);
    });
    if (saved) onSaved();
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={msg('assign.planTitle', { point: pointName })}
      testID="plan-sheet"
      action={{ label: msg('assign.save'), testID: 'plan-save', onPress: () => void save(), saving: write.saving }}
    >
      <View testID="plan" style={{ gap: t.space.md }}>
        <RadioCard testID="plan-new" selected={mode === 'new'} title={msg('assign.newPerson')} detail={msg('assign.newPersonHint')} onPress={() => setMode('new')} />
        {mode === 'new' ? (
          <View style={{ gap: t.space.sm, paddingLeft: t.space.xl }}>
            <AppText variant="label">{msg('assign.pickTapper')}</AppText>
            <ChipWrap>
              {tappers.map((p) => (
                <ToggleChip key={p.id} check testID={`plan-tapper-${p.id}`} label={p.name} on={tapperId === p.id} onPress={() => setTapperId(p.id)} />
              ))}
            </ChipWrap>
            {tried && !tapperId ? <FieldError>{msg('assign.pickTapper')}</FieldError> : null}
            <TextField
              testID="plan-from"
              label={msg(blankOk ? 'assign.fromLabel' : 'assign.fromRequired')}
              value={from}
              onChangeText={setFrom}
              error={tried && fromBad ? msg(from.trim() ? 'assign.badDate' : 'assign.needFrom') : undefined}
            />
            {outgoing && fromDay && outgoing.id !== tapperId ? (
              <View testID="plan-preview" style={{ backgroundColor: t.color.surfaceSunk, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xxs }}>
                <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{`${outgoing.name} ${msg('v2f.until', { date: day(dayBefore(fromDay)) })}`}</FactRow>
                {incoming ? <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{`${incoming.name} ${msg('v2f.startOn', { date: day(fromDay) })}`}</FactRow> : null}
              </View>
            ) : null}
          </View>
        ) : null}
        <RadioCard testID="plan-leave" selected={mode === 'leave'} title={msg('assign.leave')} detail={msg('assign.leaveHint')} onPress={() => setMode('leave')} />
        {mode === 'leave' ? (
          <View style={{ paddingLeft: t.space.xl }}>
            <TextField
              testID="plan-to"
              label={msg('assign.toLabel')}
              value={to}
              onChangeText={setTo}
              error={
                tried && leaveProblem
                  ? msg(leaveProblem === 'date' ? 'assign.badDate' : leaveProblem === 'noTapper' ? 'assign.leaveNoTapper' : 'assign.leaveBeforeStart')
                  : undefined
              }
            />
          </View>
        ) : null}
        <SaveFailed show={write.failed} />
      </View>
    </BottomSheet>
  );
}

/**
 * While sync is running and online, creating waits for this device's first pull
 * (E01-S09): otherwise two offline phones can both create "จุด 1". The wait is
 * bounded and never a trap (`first-pull.ts`): offline, a sync error, a slow
 * connection or a group that exists only on this phone lets the person go on,
 * with a plain warning that a name another phone used may repeat.
 */
export function PointsWizardScreen() {
  const t = useTheme();
  const msg = useT();
  const back = useBack(FARMS);
  const { state, reload } = useMaster();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState<1 | 2>(1);
  const [tried, setTried] = useState(false);
  const write = useWrite();
  const gate = useFirstPullGate();
  const pulled = gate.kind !== 'waiting';

  const tappers = state ? filterPeople(state.people, 'tapper') : [];
  const farms = state?.properties.filter((p) => !p.deleted) ?? [];
  const farm = farms.find((f) => f.id === farmId);
  const nameOf = (id: string) => tappers.find((p) => p.id === id)?.name ?? '';
  const existing = state && farmId ? activePoints(state, farmId) : [];
  const rows = farmId ? chosen.map((id) => ({ propertyId: farmId, tapperId: id, names: names[id] ?? [''] })) : [];
  const plan = state ? planStarterPoints(state, rows) : null;
  const total = rows.reduce((n, r) => n + r.names.length, 0);

  const toggle = (id: string) => {
    setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setNames((cur) => (cur[id] ? cur : { ...cur, [id]: [''] }));
  };
  const setCount = (id: string, n: number) =>
    setNames((cur) => {
      const list = cur[id] ?? [''];
      const k = Math.max(1, n);
      return { ...cur, [id]: k > list.length ? [...list, ...Array<string>(k - list.length).fill('')] : list.slice(0, k) };
    });
  const setName = (id: string, i: number, v: string) => setNames((cur) => ({ ...cur, [id]: (cur[id] ?? []).map((x, j) => (j === i ? v : x)) }));

  const create = async () => {
    setTried(true);
    if (!pulled || !plan?.ok || total === 0) return;
    // One run at a time (useWrite): a double tap must not create the set twice.
    if (await write.run(() => peopleStore.createStarterPoints(rows))) back();
    // Part of the set may have landed: re-read, so its names show as taken rather than being made twice.
    else reload();
  };

  // Back from the names page is page 1, names kept — header, button and Android back alike.
  useEffect(() => {
    if (page !== 2) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage(1);
      return true;
    });
    return () => sub.remove();
  }, [page]);

  const step = page === 2 ? 4 : chosen.length > 0 ? 3 : farmId ? 2 : 1;
  const strip = (
    <View style={{ flexDirection: 'row', gap: t.space.xs }}>
      {(['wizard.step1', 'wizard.step2', 'wizard.step3', 'wizard.step4'] as const).map((id, i) => {
        const n = i + 1;
        const on = n === step;
        const done = n < step;
        return (
          <View
            key={id}
            testID={`wizard-step-${n}`}
            accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: t.space.xs, borderRadius: t.radius.pill, backgroundColor: on ? t.color.action : done ? t.color.acceptSunk : t.color.surfaceSunk }}
          >
            <AppText variant="caption" style={{ fontWeight: t.font.weight.bold, color: on ? t.color.inkInverse : done ? t.color.accept : t.color.inkSoft }}>
              {`${n}. ${msg(id)}`}
            </AppText>
          </View>
        );
      })}
    </View>
  );

  const card = (title: string, children: React.ReactNode, testID?: string) => (
    <Card testID={testID}>
      <AppText variant="label">{title}</AppText>
      {children}
    </Card>
  );

  return (
    <FarmScreen
      title={msg('wizard.title')}
      subtitle={page === 2 ? msg('wizard.lastStep') : undefined}
      fallback={FARMS}
      failed={write.failed}
      onBack={page === 2 ? () => setPage(1) : undefined}
      action={page === 2 ? { label: msg('wizard.create', { n: total }), testID: 'wizard-create', disabled: total === 0 || !pulled, saving: write.saving, onPress: () => void create() } : undefined}
      testID="points-wizard"
      footer={
        page === 1 ? (
          <CTA testID="wizard-next" disabled={!farmId || total === 0} onPress={() => setPage(2)}>
            {msg('wizard.next')}
          </CTA>
        ) : (
          <View style={{ flexDirection: 'row', gap: t.space.sm }}>
            <Button testID="wizard-prev" onPress={() => setPage(1)}>
              {msg('wizard.prev')}
            </Button>
          </View>
        )
      }
    >
      {strip}
      {page === 1 ? (
        <>
          {card(
            msg('wizard.farm'),
            <>
              <ChipWrap>
                {farms.map((f) => (
                  <ToggleChip key={f.id} testID={`wizard-farm-${f.id}`} label={f.name} on={farmId === f.id} onPress={() => setFarmId(f.id)} />
                ))}
              </ChipWrap>
              <AppText variant="bodySm">{msg('wizard.farmHint')}</AppText>
              {existing.length > 0 ? (
                <AppText variant="bodySm" testID="wizard-existing">
                  {msg('wizard.existing', { n: existing.length, names: existing.map((p) => p.name).join(', ') })}
                </AppText>
              ) : null}
            </>,
          )}
          {card(
            msg('wizard.tappers'),
            <>
              {state && tappers.length === 0 ? <AppText variant="bodySm">{msg('wizard.noTappers')}</AppText> : null}
              <ChipWrap>
                {tappers.map((p) => (
                  <ToggleChip key={p.id} check testID={`wizard-tapper-${p.id}`} label={p.name} on={chosen.includes(p.id)} onPress={() => toggle(p.id)} />
                ))}
              </ChipWrap>
              <AppText variant="bodySm">{msg('wizard.tappersHint')}</AppText>
            </>,
          )}
          {chosen.length > 0
            ? card(
                msg('wizard.counts'),
                chosen.map((id) => {
                  const n = (names[id] ?? ['']).length;
                  return (
                    <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontWeight: t.font.weight.bold }}>{nameOf(id)}</AppText>
                        <AppText variant="caption">{msg('role.tapper')}</AppText>
                      </View>
                      <View style={{ width: 168 }}>
                        <Stepper testID={`wizard-count-${id}`} label={nameOf(id)} value={String(n)} onLess={() => setCount(id, n - 1)} onMore={() => setCount(id, n + 1)} />
                      </View>
                    </View>
                  );
                }),
              )
            : null}
        </>
      ) : (
        <>
          {chosen.map((id) => {
            const list = names[id] ?? [''];
            return (
              <Card key={id} testID={`wizard-group-${id}`}>
                <AppText variant="label">{msg('v2f.wizardRow', { farm: farm?.name ?? '', name: nameOf(id), n: list.length })}</AppText>
                {list.map((v, i) => {
                  const label = msg('v2f.pointOf', { name: nameOf(id), n: i + 1 });
                  const missing = tried && !v.trim();
                  return (
                    <View key={`${id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                      <AppText variant="bodySm" style={{ width: 112 }}>
                        {label}
                        <AppText variant="bodySm" style={{ color: t.color.reject }}>
                          {' *'}
                        </AppText>
                      </AppText>
                      <TextInput
                        testID={`wizard-name-${id}-${i}`}
                        accessibilityLabel={`${label}, ${msg('form.required')}`}
                        placeholder={msg('wizard.namePlaceholder')}
                        placeholderTextColor={t.color.inkFaint}
                        value={v}
                        onChangeText={(x) => setName(id, i, x)}
                        style={{
                          flex: 1,
                          minHeight: t.target.min,
                          paddingHorizontal: t.space.md,
                          borderRadius: t.radius.md,
                          borderWidth: missing ? t.border.thick : t.border.hair,
                          borderColor: missing ? t.color.reject : t.color.ruleStrong,
                          backgroundColor: t.color.surfaceRaised,
                          fontFamily: t.font.family.sans,
                          fontSize: t.font.size.bodyLg,
                          fontWeight: v.trim() ? t.font.weight.bold : t.font.weight.regular,
                          color: t.color.ink,
                        }}
                      />
                    </View>
                  );
                })}
              </Card>
            );
          })}
          {gate.kind === 'waiting' ? (
            <AppText variant="bodySm" testID="wizard-wait-pull">
              {msg('wizard.waitPull')}
            </AppText>
          ) : null}
          {gate.kind === 'unavailable' ? (
            <FieldError testID="wizard-no-sync">{msg(gate.reason === 'offline' ? 'wizard.noSyncOffline' : 'wizard.noSyncError')}</FieldError>
          ) : null}
          {tried && plan && !plan.ok && plan.missing > 0 ? <FieldError testID="wizard-missing">{msg('wizard.needNames')}</FieldError> : null}
          {tried && plan && !plan.ok && plan.duplicates.length > 0 ? <FieldError testID="wizard-duplicates">{msg('wizard.duplicates', { names: plan.duplicates.join(', ') })}</FieldError> : null}
          <RowCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm }}>
              <IconTile tone="neutral" icon={(c) => <PersonIcon color={c} size={20} />} />
              <View style={{ flex: 1, gap: t.space.xxs }}>
                <AppText style={{ fontWeight: t.font.weight.bold }}>{msg('assign.title')}</AppText>
                <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('wizard.infoStart')}</FactRow>
                <FactRow icon={(c) => <Check color={c} size={10} />}>{msg('wizard.infoLater')}</FactRow>
              </View>
            </View>
          </RowCard>
        </>
      )}
    </FarmScreen>
  );
}
