/**
 * คน (E03-S01) on v2 — farm mockup 4 (list), 5 (form), 6 (detail), 7 (delete).
 *
 * - PeopleScreen (/v2/people): filters ทุกคน · roles · คนรับซื้อยาง (D-74
 *   F12); each row one role per line and a tapper's point count. Deleted
 *   people sit behind a small link (D-74 F13).
 * - PersonScreen (/v2/person/<id|new>, `?edit=1`): the form to add or edit
 *   (D-68: one or more roles, typed ones too), or the read-only detail with
 *   the points tapped today, the share and the debt account, and "ลบ
 *   (กู้คืนได้)" behind a sheet that names the points left without a tapper —
 *   a warning, never a block (D-65).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { projectDebts } from '../../core/finance/debts';
import { formatSatang } from '../../core/finance/money';
import {
  BUILTIN_ROLES,
  filterPeople,
  pointsOf,
  shareOn,
  tapperPointsNow,
  todayIso,
  validatePerson,
  type MasterState,
  type PersonRecord,
} from '../../core/master';
import type { BuiltinRole } from '../../core/types';
import { useFinance } from '../../finance/use-finance';
import { useSaleCounts } from '../../finance/use-live-sales';
import { useT, type Translate } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import {
  AppText,
  Button,
  CalendarIcon,
  Card,
  Check,
    DebtIcon,
  FactRow,
  FarmIcon,
  FieldError,
  IconTile,
  MenuItem,
  MoneyInIcon,
  PercentIcon,
  PersonIcon,
  PinIcon,
  Plus,
  SwapIcon,
  TagIcon,
  TextField,
  TrashIcon,
  type TileTone
} from '../../ui';
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
  ToggleChip,
  useBack,
  useDay,
  useMaster,
  useMounted,
  useWrite,
} from './pieces';

const PEOPLE = '/v2/people' as Href;
type Filter = 'all' | 'buyers' | BuiltinRole;
const FILTERS: readonly Filter[] = ['all', 'tapper', 'worker', 'manager', 'buyers', 'owner'];

/**
 * Roles the people screens show and offer. ผู้จ่าย is left out (owner
 * 2026-10-10): who paid is recorded on each expense (MONEY), not as a person
 * role. The data model keeps it, so someone who has it keeps it on save.
 */
const HIDDEN_ROLES: ReadonlySet<BuiltinRole> = new Set(['payer']);
const SHOWN_ROLES = BUILTIN_ROLES.filter((r) => !HIDDEN_ROLES.has(r));

const roleNames = (p: PersonRecord, msg: Translate) => [
  ...p.roles.filter((r) => !HIDDEN_ROLES.has(r)).map((r) => msg(`role.${r}`)),
  ...p.otherRoles,
];

/** Tappers take a category colour in turn; a tenant cream; everyone else action blue (mockup 4). */
function personTone(p: PersonRecord, tappers: readonly PersonRecord[]): TileTone {
  if (p.roles.includes('tapper')) return categoryTone(4 + tappers.indexOf(p));
  if (p.roles.length === 1 && p.roles[0] === 'tenant') return 'cream';
  return 'action';
}

export function PeopleScreen() {
  const msg = useT();
  const router = useRouter();
  const { state, reload } = useMaster();
  // `?filter=tapper` — the home card ข้อมูลคนงาน opens the list on its tappers (v1.1.0 screen 26).
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<Filter>('all');
  // Follow the param whenever it changes, not only on the first render: the
  // static page hydrates without search params and gets them a render later.
  const asked = FILTERS.find((f) => f === params.filter) ?? null;
  const [seen, setSeen] = useState<Filter | null>(null);
  if (asked !== seen) {
    setSeen(asked);
    if (asked) setFilter(asked);
  }
  const [showDeleted, setShowDeleted] = useState(false);
  const [today] = useState(() => todayIso(Date.now()));

  const label = (f: Filter) => (f === 'all' ? msg('peopleList.all') : f === 'buyers' ? msg('peopleList.buyers') : msg(`role.${f}`));
  const tappers = state ? filterPeople(state.people, 'tapper') : [];
  const deleted = state ? [...state.people.filter((p) => p.deleted), ...state.buyers.filter((b) => b.deleted)] : [];
  const write = useWrite();
  const restore = async (id: string) => {
    if (await write.run(() => peopleStore.restore(id))) reload();
  };

  return (
    <FarmScreen
      title={msg('peopleList.title')}
      subtitle={msg('farmData.title')}
      fallback={'/v2/farm' as Href}
      failed={write.failed}
      testID="people"
      footer={<AddCTA testID="add-person" label={msg('v2f.addPerson')} onPress={() => router.push('/v2/person/new' as Href)} />}
    >
      {showDeleted ? (
        <>
          <AppText variant="label">{msg('v2f.deletedTitle')}</AppText>
          <DeletedList rows={deleted.map((r) => ({ id: r.id, name: r.name }))} onRestore={(id) => void restore(id)} />
          <Button testID="hide-deleted" onPress={() => setShowDeleted(false)}>
            {msg('v2.back')}
          </Button>
        </>
      ) : (
        <>
          <ChipWrap testID="people-filters">
            {FILTERS.map((f) => (
              <ToggleChip key={f} testID={`filter-${f}`} label={label(f)} on={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ChipWrap>
          {state ? <PeopleRows state={state} filter={filter} today={today} tappers={tappers} /> : null}
          <DeletedLink n={deleted.length} onPress={() => setShowDeleted(true)} />
        </>
      )}
    </FarmScreen>
  );
}

function PeopleRows({ state, filter, today, tappers }: { state: MasterState; filter: Filter; today: string; tappers: readonly PersonRecord[] }) {
  const msg = useT();
  const router = useRouter();
  if (filter === 'buyers') {
    const buyers = state.buyers.filter((b) => !b.deleted);
    if (buyers.length === 0) return <AppText variant="bodySm">{msg('buyers.empty')}</AppText>;
    return (
      <RowCard>
        {buyers.map((b) => (
          <MenuItem
            key={b.id}
            testID={`buyer-${b.id}`}
            label={b.name}
            onPress={() => router.push('/v2/buyers' as Href)}
            leading={<IconTile tone="cream" icon={(c) => <MoneyInIcon color={c} size={22} />} />}
          >
            <FactRow icon={(c) => <TagIcon color={c} size={12} />}>{msg('peopleList.buyers')}</FactRow>
          </MenuItem>
        ))}
      </RowCard>
    );
  }
  const list = filterPeople(state.people, filter);
  if (list.length === 0) return <AppText variant="bodySm">{msg('peopleList.empty')}</AppText>;
  return (
    <RowCard testID="people-list">
      {list.map((p) => {
        const points = p.roles.includes('tapper') ? pointsOf(state, p.id, today).length : null;
        return (
          <MenuItem
            key={p.id}
            testID={`person-${p.id}`}
            label={p.name}
            onPress={() => router.push(`/v2/person/${p.id}` as Href)}
            leading={<IconTile tone={personTone(p, tappers)} icon={(c) => <PersonIcon color={c} size={22} />} />}
          >
            {roleNames(p, msg).map((r) => (
              <FactRow key={r} icon={(c) => <TagIcon color={c} size={12} />}>
                {r}
              </FactRow>
            ))}
            {points !== null ? <FactRow icon={(c) => <PinIcon color={c} size={12} />}>{msg('v2f.pointsN', { n: points })}</FactRow> : null}
          </MenuItem>
        );
      })}
    </RowCard>
  );
}

/** /v2/person/<id|new>: the form for `new` or `?edit=1`, else the detail. */
export function PersonScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const mounted = useMounted();
  if (!mounted) return <FarmScreen title="" fallback={PEOPLE} />;
  const personId = id && id !== 'new' ? id : null;
  if (personId && edit !== '1') return <PersonDetail key={personId} personId={personId} />;
  return <PersonForm key={personId ?? 'new'} personId={personId} />;
}

function PersonForm({ personId }: { personId: string | null }) {
  const t = useTheme();
  const msg = useT();
  const back = useBack(PEOPLE);
  const { state } = useMaster();
  const [loaded, setLoaded] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<BuiltinRole[]>([]);
  const [otherRoles, setOtherRoles] = useState<string[]>([]);
  const [otherDraft, setOtherDraft] = useState('');
  const [tried, setTried] = useState(false);
  const [roleWarning, setRoleWarning] = useState(false);
  const write = useWrite();
  const [today] = useState(() => todayIso(Date.now()));

  const existing = personId ? (state?.people.find((p) => p.id === personId) ?? null) : null;
  // Fill the form once, when the record first arrives.
  if (existing && loaded !== existing.id) {
    setLoaded(existing.id);
    setName(existing.name);
    setRoles([...existing.roles]);
    setOtherRoles([...existing.otherRoles]);
  }

  const errors = validatePerson({ name, roles, otherRoles });
  const points = existing && state ? pointsOf(state, existing.id, today) : [];
  const toggle = (r: BuiltinRole) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  const addOther = () => {
    const v = otherDraft.trim();
    if (v && !otherRoles.includes(v)) setOtherRoles([...otherRoles, v]);
    setOtherDraft('');
  };

  const save = async (confirmed = false) => {
    setTried(true);
    if (errors.length) return;
    // Taking the tapper role away while they still tap points: warn, never block (D-65).
    if (!confirmed && existing && points.length > 0 && existing.roles.includes('tapper') && !roles.includes('tapper')) {
      setRoleWarning(true);
      return;
    }
    const saved = await write.run(() => (existing ? peopleStore.edit(existing.id, { name, roles, otherRoles }) : peopleStore.create(name, roles, otherRoles)));
    if (saved) back();
  };

  if (personId && state && !existing) return <NotFound />;

  return (
    <FarmScreen
      title={msg(personId ? 'personForm.editTitle' : 'personForm.addTitle')}
      fallback={PEOPLE}
      failed={write.failed}
      testID="person-form"
      action={{ label: msg('common.save'), testID: 'person-save', onPress: () => void save(), saving: write.saving }}
    >
      <TextField
        testID="person-name"
        label={msg('v2f.name')}
        required
        value={name}
        onChangeText={setName}
        error={tried && errors.includes('name') ? msg('personForm.needName') : undefined}
      />
      <View style={{ gap: t.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.xs }}>
          <AppText variant="label">{msg('v2f.roles')}</AppText>
          <AppText variant="label" style={{ color: t.color.reject }}>
            *
          </AppText>
          <AppText variant="caption">{msg('v2f.rolesHint')}</AppText>
        </View>
        <ChipWrap>
          {SHOWN_ROLES.map((r) => (
            <ToggleChip key={r} check testID={`role-${r}`} label={msg(`role.${r}`)} on={roles.includes(r)} onPress={() => toggle(r)} />
          ))}
          {otherRoles.map((r) => (
            <ToggleChip key={r} check testID={`other-role-${r}`} label={r} on onPress={() => setOtherRoles(otherRoles.filter((x) => x !== r))} />
          ))}
        </ChipWrap>
        {tried && errors.includes('roles') ? <FieldError testID="person-roles-error">{msg('personForm.needRole')}</FieldError> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space.sm }}>
        <View style={{ flex: 1 }}>
          <TextField
            testID="person-other-role"
            label={msg('v2f.otherRoles')}
            hint={msg('v2f.otherRolesHint')}
            placeholder={msg('personForm.otherRolePlaceholder')}
            value={otherDraft}
            onChangeText={setOtherDraft}
          />
        </View>
        <Button testID="person-add-other-role" icon={(c) => <Plus color={c} size={14} />} onPress={addOther} disabled={!otherDraft.trim()}>
          {msg('v2f.add')}
        </Button>
      </View>
      <HelpNote lines={[msg('v2f.noAccount')]} />
      {roleWarning && existing ? (
        <Card testID="role-warning">
          <FieldError>{msg('person.pointsWarn', { name: existing.name, n: points.length, points: points.map((p) => p.name).join(', ') })}</FieldError>
          <Button testID="role-warning-yes" variant="primary" onPress={() => void save(true)}>
            {msg('person.roleWarnYes')}
          </Button>
        </Card>
      ) : null}
    </FarmScreen>
  );
}

function PersonDetail({ personId }: { personId: string }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const back = useBack(PEOPLE);
  const day = useDay();
  const { state, reload } = useMaster();
  const fin = useFinance();
  const counts = useSaleCounts();
  const [confirming, setConfirming] = useState(false);
  const write = useWrite();
  const [today] = useState(() => todayIso(Date.now()));
  const debt = useMemo(() => projectDebts(fin.events ?? [], counts).get(personId), [fin.events, counts, personId]);

  const person = state?.people.find((p) => p.id === personId);
  if (!state) return <FarmScreen title="" fallback={PEOPLE} />;
  if (!person) return <NotFound />;

  const isTapper = person.roles.includes('tapper');
  const points = tapperPointsNow(state, person.id, today);
  const share = shareOn(state, person.id, today);
  const tone = personTone(person, filterPeople(state.people, 'tapper'));

  const remove = async () => {
    if (!(await write.run(() => peopleStore.remove(person.id)))) return;
    setConfirming(false);
    back();
  };
  const restore = async () => {
    if (await write.run(() => peopleStore.restore(person.id))) reload();
  };

  return (
    <FarmScreen
      title={person.name}
      subtitle={msg('peopleList.title')}
      fallback={PEOPLE}
      failed={write.failed && !confirming}
      testID="person-detail"
      right={<HeaderButton testID="person-edit" label={msg('personDetail.edit')} onPress={() => router.push(`/v2/person/${person.id}?edit=1` as Href)} />}
      overlay={
        <ConfirmSheet
          open={confirming}
          title={msg('personForm.deleteTitle', { name: person.name })}
          warning={
            points.length > 0
              ? { title: msg('personDetail.warnTitle', { name: person.name, n: points.length }), lines: [points.map((p) => p.name).join(' · '), msg('personDetail.warnAfter')] }
              : null
          }
          lines={msg('personForm.deleteBody').split(' · ')}
          confirmLabel={msg('personForm.deleteYes')}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
          failed={write.failed}
        />
      }
    >
      <RowCard testID="person-profile">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm }}>
          <IconTile tone={tone} icon={(c) => <PersonIcon color={c} size={22} />} />
          <View style={{ flex: 1, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{person.name}</AppText>
            {roleNames(person, msg).map((r) => (
              <FactRow key={r} icon={(c) => <TagIcon color={c} size={12} />}>
                {r}
              </FactRow>
            ))}
          </View>
        </View>
      </RowCard>

      {points.length > 0 ? (
        <RowCard testID="person-points" title={msg('person.points')}>
          {points.map((p) => (
            <MenuItem
              key={p.pointId}
              testID={`person-point-${p.pointId}`}
              label={p.name}
              onPress={() => router.push(`/v2/point/${p.pointId}` as Href)}
              leading={<IconTile tone="category1" icon={(c) => <PinIcon color={c} size={20} />} />}
            >
              <FactRow icon={(c) => <FarmIcon color={c} size={12} />}>{p.farmName}</FactRow>
              <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>
                {p.to ? msg('v2f.until', { date: day(p.to) }) : p.from ? msg('v2f.since', { date: day(p.from) }) : msg('assign.noStart')}
              </FactRow>
              {p.planned ? <FactRow icon={(c) => <SwapIcon color={c} size={12} />}>{msg('personDetail.planChange')}</FactRow> : null}
            </MenuItem>
          ))}
        </RowCard>
      ) : null}

      {isTapper || debt ? (
        <RowCard>
          {isTapper ? (
            <MenuItem
              testID="share-summary"
              label={msg('share.title')}
              onPress={() => router.push(`/v2/share/${person.id}` as Href)}
              leading={<IconTile tone="action" icon={(c) => <PercentIcon color={c} size={20} />} />}
            >
              <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{msg('share.tapper', { n: share.tapperPct })}</FactRow>
              <FactRow icon={(c) => <FarmIcon color={c} size={12} />}>{msg('share.owner', { n: share.ownerPct })}</FactRow>
              {share.isDefault ? <FactRow icon={(c) => <Check color={c} size={10} />}>{msg('personDetail.shareDefault')}</FactRow> : null}
            </MenuItem>
          ) : null}
          {debt ? (
            <MenuItem
              testID="debt-summary"
              label={msg('v2.debts')}
              onPress={() => router.push(`/v2/debt/${person.id}` as Href)}
              leading={<IconTile tone="cream" icon={(c) => <DebtIcon color={c} size={20} />} />}
            >
              <FactRow icon={(c) => <MoneyInIcon color={c} size={12} />}>{msg('v2f.debtFarm', { amount: formatSatang(Math.max(0, debt.balanceSatang)) })}</FactRow>
              {debt.planPerSaleSatang ? (
                <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('v2f.debtPlan', { amount: formatSatang(debt.planPerSaleSatang) })}</FactRow>
              ) : null}
            </MenuItem>
          ) : null}
        </RowCard>
      ) : null}

      {person.deleted ? (
        <DeletedList rows={[{ id: person.id, name: person.name }]} onRestore={() => void restore()} />
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="person-delete" variant="destructive" icon={(c) => <TrashIcon color={c} size={16} />} onPress={() => setConfirming(true)}>
            {msg('personForm.delete')}
          </Button>
        </View>
      )}
    </FarmScreen>
  );
}

/** A record that does not exist (a stale link): say so, with the way back. */
export function NotFound({ fallback = PEOPLE }: { fallback?: Href }) {
  const msg = useT();
  return (
    <FarmScreen title={msg('v2f.notFound')} fallback={fallback}>
      <Card testID="not-found">
        <AppText>{msg('v2f.notFound')}</AppText>
      </Card>
    </FarmScreen>
  );
}
