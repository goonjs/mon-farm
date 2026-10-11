/**
 * สวน (E03-S02) on v2 — farm mockup 9 (list), 10 (form), 11 (detail and
 * area history), 12 (delete).
 *
 * - FarmsScreen (/v2/farms): crop, today's area ("ไม่ทราบ" when none, never
 *   0 — SYNC-12) and the point count per farm; the set-up helper while the
 *   group has no points (D-73); deleted farms behind the small link.
 * - PropertyScreen (/v2/property/<id|new>, `?edit=1`): the form (name and
 *   crop required; area, planted year and GPS may stay unknown), or the
 *   detail: area now with "เปลี่ยนพื้นที่" (a new dated line, never written
 *   over — MD-1), planted year and age, GPS, the area history, the farm's
 *   points with today's tapper, and delete — its points go with it and come
 *   back with it (D-58, D-65).
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  activePoints,
  ageInYears,
  areaOn,
  formatGps,
  formatRai,
  parseGps,
  parsePlantedYear,
  parseRai,
  parseThaiDay,
  tapperOn,
  thaiDayInput,
  todayIso,
  validateProperty,
  type MasterState,
  type PropertyRecord,
} from '../../core/master';
import type { Crop } from '../../core/types';
import { useT } from '../../i18n';
import { peopleStore } from '../../store/people';
import { useTheme } from '../../theme';
import {
  AppText,
  BottomSheet,
  Button,
  CalendarIcon,
  Check,
  FactRow,
  FarmIcon,
  FieldError,
  IconTile,
  MenuItem,
  PersonIcon,
  PinIcon,
  Plus,
  SegmentedControl,
  TextField,
  TrashIcon
} from '../../ui';
import { UnknownPill } from '../money/pieces';
import { NotFound } from './people-screens';
import {
  AddCTA,
  categoryTone,
  ConfirmSheet,
  DeletedLink,
  DeletedList,
  FarmScreen,
  HeaderButton,
  RowCard,
  useBack,
  useDay,
  useMaster,
  useMounted,
  useWrite,
  SaveFailed,
} from './pieces';

const FARMS = '/v2/farms' as Href;
const CROPS: readonly Crop[] = ['rubber', 'durian'];

export function FarmsScreen() {
  const msg = useT();
  const router = useRouter();
  const { state, reload } = useMaster();
  const [showDeleted, setShowDeleted] = useState(false);
  const [today] = useState(() => todayIso(Date.now()));
  const active = state?.properties.filter((p) => !p.deleted) ?? [];
  const deleted = state?.properties.filter((p) => p.deleted) ?? [];

  const write = useWrite();
  const restore = async (id: string) => {
    if (await write.run(() => peopleStore.restore(id))) reload();
  };

  return (
    <FarmScreen
      title={msg('properties.title')}
      subtitle={msg('farmData.title')}
      fallback={'/v2/farm' as Href}
      failed={write.failed}
      testID="farms"
      footer={<AddCTA testID="add-farm" label={msg('v2f.addFarm')} onPress={() => router.push('/v2/property/new' as Href)} />}
    >
      {showDeleted ? (
        <>
          <AppText variant="label">{msg('v2f.deletedTitle')}</AppText>
          <DeletedList
            rows={deleted.map((p) => ({ id: p.id, name: p.name, facts: [msg('v2f.pointsCount', { n: state ? state.points.filter((x) => x.propertyId === p.id && !x.deleted).length : 0 })] }))}
            onRestore={(id) => void restore(id)}
          />
          <Button testID="hide-deleted" onPress={() => setShowDeleted(false)}>
            {msg('v2.back')}
          </Button>
        </>
      ) : (
        <>
          {/* Always on offer, not only when empty: it can be used again for the next person (names already used are refused). */}
          {state && active.length > 0 ? (
            <Button testID="open-wizard" variant={activePoints(state).length === 0 ? 'primary' : 'ghost'} icon={(c) => <PinIcon color={c} size={16} />} onPress={() => router.push('/v2/points-wizard' as Href)}>
              {msg('wizard.open')}
            </Button>
          ) : null}
          {state && active.length === 0 ? <AppText variant="bodySm">{msg('properties.empty')}</AppText> : null}
          {state && active.length > 0 ? (
            <RowCard testID="farms-list">
              {active.map((p, i) => (
                <FarmRow key={p.id} state={state} farm={p} index={i} today={today} />
              ))}
            </RowCard>
          ) : null}
          <DeletedLink n={deleted.length} onPress={() => setShowDeleted(true)} />
        </>
      )}
    </FarmScreen>
  );
}

function FarmRow({ state, farm, index, today }: { state: MasterState; farm: PropertyRecord; index: number; today: string }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const area = areaOn(farm, today);
  const points = activePoints(state, farm.id).length;
  return (
    <MenuItem
      testID={`farm-${farm.id}`}
      label={farm.name}
      onPress={() => router.push(`/v2/property/${farm.id}` as Href)}
      leading={<IconTile tone={categoryTone(index)} icon={(c) => <FarmIcon color={c} size={22} />} />}
    >
      <FactRow icon={(c) => <FarmIcon color={c} size={12} />}>{msg(`crop.${farm.crop}`)}</FactRow>
      {area === null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('v2f.areaLabel')}</FactRow>
          <UnknownPill />
        </View>
      ) : (
        <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('properties.area', { rai: formatRai(area) })}</FactRow>
      )}
      {points > 0 ? <FactRow icon={(c) => <PinIcon color={c} size={12} />}>{msg('v2f.pointsCount', { n: points })}</FactRow> : null}
    </MenuItem>
  );
}

/** /v2/property/<id|new>: the form for `new` or `?edit=1`, else the detail. */
export function PropertyScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const mounted = useMounted();
  if (!mounted) return <FarmScreen title="" fallback={FARMS} />;
  const propertyId = id && id !== 'new' ? id : null;
  if (propertyId && edit !== '1') return <PropertyDetail key={propertyId} propertyId={propertyId} />;
  return <PropertyForm key={propertyId ?? 'new'} propertyId={propertyId} />;
}

type Problem = 'name' | 'crop' | 'area' | 'year' | 'gps';

function PropertyForm({ propertyId }: { propertyId: string | null }) {
  const t = useTheme();
  const msg = useT();
  const back = useBack(FARMS);
  const { state } = useMaster();
  const [loaded, setLoaded] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [crop, setCrop] = useState<Crop | null>(null);
  const [area, setArea] = useState('');
  const [planted, setPlanted] = useState('');
  const [gps, setGps] = useState('');
  const [tried, setTried] = useState(false);
  const write = useWrite();
  /** A new farm whose first write landed but its area did not: a retry edits it, never adds a second (D-65). */
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const existing = propertyId ? (state?.properties.find((p) => p.id === propertyId) ?? null) : null;
  if (existing && loaded !== existing.id) {
    setLoaded(existing.id);
    setName(existing.name);
    setCrop(existing.crop);
    setPlanted(existing.plantedYearBe ? String(existing.plantedYearBe) : '');
    setGps(existing.gps ? formatGps(existing.gps) : '');
  }

  const rai = parseRai(area);
  const gpsParsed = parseGps(gps);
  const year = parsePlantedYear(planted, now);
  const problems: Problem[] = [
    ...validateProperty({ name, crop }),
    ...(!rai.ok ? (['area'] as const) : []),
    ...(!year.ok ? (['year'] as const) : []),
    ...(!gpsParsed.ok ? (['gps'] as const) : []),
  ];
  const show = (p: Problem) => tried && problems.includes(p);

  const save = async () => {
    setTried(true);
    if (problems.length || !crop || !rai.ok || !gpsParsed.ok || !year.ok) return;
    const fields = { name, crop, plantedYearBe: year.yearBe, gps: gpsParsed.gps };
    // One save at a time (useWrite): a double tap must not create two farms.
    const saved = await write.run(async () => {
      if (existing) return peopleStore.editProperty(existing.id, fields);
      let id = createdId;
      if (id) await peopleStore.editProperty(id, fields);
      else {
        id = (await peopleStore.addProperty(fields)).id;
        setCreatedId(id);
      }
      // A new farm's area takes effect today; later changes are dated on the detail (MD-1).
      if (rai.centiRai !== null) await peopleStore.recordArea(id, rai.centiRai, todayIso(now));
    });
    if (saved) back();
  };

  if (propertyId && state && !existing) return <NotFound fallback={FARMS} />;
  const unknown = (blank: boolean) => (blank ? <UnknownPill /> : undefined);

  return (
    <FarmScreen
      title={msg(propertyId ? 'propertyForm.editTitle' : 'propertyForm.addTitle')}
      fallback={FARMS}
      failed={write.failed}
      testID="property-form"
      action={{ label: msg('common.save'), testID: 'property-save', onPress: () => void save(), saving: write.saving }}
    >
      <TextField testID="property-name" label={msg('v2f.farmName')} required value={name} onChangeText={setName} error={show('name') ? msg('propertyForm.needName') : undefined} />
      <View style={{ gap: t.space.xs }}>
        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          <AppText variant="label">{msg('v2f.crop')}</AppText>
          <AppText variant="label" style={{ color: t.color.reject }}>
            *
          </AppText>
        </View>
        <SegmentedControl<Crop | ''>
          testID="property-crop"
          value={crop ?? ''}
          onChange={(c) => c && setCrop(c)}
          options={CROPS.map((c) => ({ value: c, label: msg(`crop.${c}`) }))}
        />
        {show('crop') ? <FieldError testID="property-crop-error">{msg('propertyForm.needCrop')}</FieldError> : null}
      </View>
      {existing ? null : (
        <TextField
          testID="property-area"
          label={msg('v2f.areaRai')}
          hint={msg('v2f.optional')}
          placeholder={msg('propertyForm.areaPlaceholder')}
          keyboardType="decimal-pad"
          value={area}
          onChangeText={setArea}
          aside={unknown(!area.trim())}
          error={show('area') ? msg('propertyForm.badArea') : undefined}
        />
      )}
      <TextField
        testID="property-planted"
        label={msg('v2f.planted')}
        hint={msg('v2f.plantedHint')}
        placeholder={msg('propertyForm.plantedPlaceholder')}
        keyboardType="number-pad"
        value={planted}
        onChangeText={setPlanted}
        aside={unknown(!planted.trim())}
        error={show('year') ? msg('propertyForm.badYear') : undefined}
      />
      <TextField
        testID="property-gps"
        label={msg('v2f.gps')}
        hint={msg('v2f.gpsHint')}
        placeholder={msg('propertyForm.gpsPlaceholder')}
        value={gps}
        onChangeText={setGps}
        aside={unknown(!gps.trim())}
        error={show('gps') ? msg('propertyForm.badGps') : undefined}
      />
    </FarmScreen>
  );
}

function PropertyDetail({ propertyId }: { propertyId: string }) {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const back = useBack(FARMS);
  const day = useDay();
  const { state, reload } = useMaster();
  const [now] = useState(() => Date.now());
  const [sheet, setSheet] = useState<'none' | 'area' | 'delete'>('none');
  const [area, setArea] = useState('');
  const [areaDate, setAreaDate] = useState(() => thaiDayInput(todayIso(now)));
  const [tried, setTried] = useState(false);
  const write = useWrite();

  const property = state?.properties.find((p) => p.id === propertyId);
  if (!state) return <FarmScreen title="" fallback={FARMS} />;
  if (!property) return <NotFound fallback={FARMS} />;

  const today = todayIso(now);
  const points = activePoints(state, property.id);
  const areaNow = areaOn(property, today);
  const inUse = property.areaHistory.find((a) => a.effective <= today)?.entryId;
  const age = ageInYears(property.plantedYearBe, now);
  const rai = parseRai(area);
  const effective = parseThaiDay(areaDate);
  const nameOf = (id: string | null) => state.people.find((p) => p.id === id && !p.deleted)?.name ?? null;
  const index = state.properties.filter((p) => !p.deleted).findIndex((p) => p.id === property.id);

  const saveArea = async () => {
    setTried(true);
    if (!rai.ok || rai.centiRai === null || !effective) return;
    const centiRai = rai.centiRai;
    if (!(await write.run(() => peopleStore.recordArea(property.id, centiRai, effective)))) return;
    setSheet('none');
    setArea('');
    setTried(false);
    reload();
  };
  const remove = async () => {
    if (!(await write.run(() => peopleStore.remove(property.id)))) return;
    setSheet('none');
    back();
  };
  const restore = async () => {
    if (await write.run(() => peopleStore.restore(property.id))) reload();
  };

  const value = (text: string) => <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{text}</AppText>;

  return (
    <FarmScreen
      title={property.name}
      subtitle={msg('properties.title')}
      fallback={FARMS}
      failed={write.failed && sheet === 'none'}
      testID="property-detail"
      right={<HeaderButton testID="property-edit" label={msg('personDetail.edit')} onPress={() => router.push(`/v2/property/${property.id}?edit=1` as Href)} />}
      overlay={
        <>
          <BottomSheet open={sheet === 'area'} onClose={() => setSheet('none')} title={msg('propertyDetail.changeArea')} testID="area-sheet" action={{ label: msg('propertyDetail.areaSave'), testID: 'area-save', onPress: () => void saveArea(), saving: write.saving }}>
            <TextField
              testID="area-new"
              label={msg('v2f.newArea')}
              required
              keyboardType="decimal-pad"
              value={area}
              onChangeText={setArea}
              error={tried && (!rai.ok || rai.centiRai === null) ? msg('propertyForm.badArea') : undefined}
            />
            <TextField
              testID="area-new-date"
              label={msg('v2f.effective')}
              required
              hint={msg('v2f.dateHint')}
              value={areaDate}
              onChangeText={setAreaDate}
              error={tried && !effective ? msg('propertyForm.badDate') : undefined}
            />
            <AppText variant="bodySm">{msg('v2f.areaNewLine')}</AppText>
            <SaveFailed show={write.failed} />
          </BottomSheet>
          <ConfirmSheet
            open={sheet === 'delete'}
            title={msg('propertyForm.deleteTitle', { name: property.name })}
            warning={points.length > 0 ? { title: msg('propertyDetail.warn', { n: points.length }), lines: msg('propertyDetail.warnLines').split(' · ') } : null}
            lines={[...msg('propertyDetail.body').split(' · '), msg('propertyDetail.restore')]}
            confirmLabel={msg('propertyForm.deleteYes')}
            onConfirm={() => void remove()}
            onClose={() => setSheet('none')}
            failed={write.failed}
          />
        </>
      }
    >
      <RowCard testID="property-summary">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm }}>
          <IconTile tone={categoryTone(Math.max(0, index))} icon={(c) => <FarmIcon color={c} size={22} />} />
          <View style={{ flex: 1, gap: t.space.xxs }}>
            <AppText style={{ fontWeight: t.font.weight.bold, fontSize: t.font.size.headingSm }}>{property.name}</AppText>
            <FactRow icon={(c) => <FarmIcon color={c} size={12} />}>{msg(`crop.${property.crop}`)}</FactRow>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, paddingVertical: t.space.sm }}>
          <View testID="property-area-now" style={{ flex: 1, gap: t.space.xxs }}>
            <AppText variant="bodySm">{msg('propertyDetail.areaNow')}</AppText>
            {areaNow === null ? <UnknownPill /> : value(msg('properties.area', { rai: formatRai(areaNow) }))}
          </View>
          <Button testID="change-area" onPress={() => setSheet('area')}>
            {msg('propertyDetail.changeArea')}
          </Button>
        </View>
        <View style={{ flexDirection: 'row', gap: t.space.sm, paddingVertical: t.space.sm }}>
          <View testID="property-planted" style={{ flex: 1, gap: t.space.xxs }}>
            <AppText variant="bodySm">{msg('propertyDetail.planted')}</AppText>
            {property.plantedYearBe ? value(String(property.plantedYearBe)) : <UnknownPill />}
          </View>
          <View style={{ flex: 1, gap: t.space.xxs }}>
            <AppText variant="bodySm">{msg('propertyDetail.age')}</AppText>
            {age !== null ? value(msg('propertyDetail.years', { n: age })) : <UnknownPill />}
          </View>
        </View>
        <View testID="property-gps" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: t.space.md }}>
          <AppText variant="bodySm">{msg('propertyDetail.gps')}</AppText>
          {property.gps ? <AppText>{formatGps(property.gps)}</AppText> : <UnknownPill />}
        </View>
      </RowCard>

      <RowCard testID="area-history" title={msg('propertyForm.history')}>
        {property.areaHistory.length === 0 ? (
          <View style={{ paddingVertical: t.space.sm }}>
            <UnknownPill />
          </View>
        ) : null}
        {property.areaHistory.map((a) => (
          <View key={a.entryId} style={{ paddingVertical: t.space.sm, gap: t.space.xxs }}>
            {value(msg('properties.area', { rai: formatRai(a.centiRai) }))}
            <FactRow icon={(c) => <CalendarIcon color={c} size={12} />}>{msg('v2f.since', { date: day(a.effective) })}</FactRow>
            {a.entryId === inUse ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
                <Check color={t.color.accept} size={10} />
                <AppText variant="bodySm" style={{ color: t.color.accept, fontWeight: t.font.weight.semibold }}>
                  {msg('propertyForm.inUse')}
                </AppText>
              </View>
            ) : null}
          </View>
        ))}
      </RowCard>

      <RowCard testID="property-points" title={msg('v2f.pointsOf', { n: points.length })}>
        {points.map((p) => {
          const tapper = nameOf(tapperOn(state, p.id, today));
          return (
            <MenuItem
              key={p.id}
              testID={`point-${p.id}`}
              label={p.name}
              onPress={() => router.push(`/v2/point/${p.id}` as Href)}
              leading={<IconTile tone={categoryTone(Math.max(0, index))} icon={(c) => <PinIcon color={c} size={20} />} />}
            >
              <FactRow icon={(c) => <PersonIcon color={c} size={12} />}>{tapper ?? msg('assign.none')}</FactRow>
            </MenuItem>
          );
        })}
        <View style={{ paddingVertical: t.space.sm, alignSelf: 'flex-start' }}>
          <Button testID="add-point" icon={(c) => <Plus color={c} size={14} />} onPress={() => router.push(`/v2/point/new?property=${property.id}` as Href)}>
            {msg('v2f.addPoint')}
          </Button>
        </View>
      </RowCard>

      {property.deleted ? (
        <DeletedList rows={[{ id: property.id, name: property.name }]} onRestore={() => void restore()} />
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="property-delete" variant="destructive" icon={(c) => <TrashIcon color={c} size={16} />} onPress={() => setSheet('delete')}>
            {msg('propertyForm.delete')}
          </Button>
        </View>
      )}
    </FarmScreen>
  );
}
