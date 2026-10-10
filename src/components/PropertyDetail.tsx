/**
 * One farm, read-only (mockup v1.1.0 farm-14): crop, the area in effect
 * today with "เปลี่ยนพื้นที่", planted year and age, GPS, the dated area
 * history (MD-1), and its weighing points with each one's tapper today.
 * "แก้" opens the form; "ลบสวน (กู้คืนได้)" opens a sheet saying its points
 * go with it and come back with it (farm-15, D-58, D-65 Q9).
 */

import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  activePoints,
  ageInYears,
  areaOn,
  formatGps,
  formatRai,
  parseRai,
  parseThaiDay,
  tapperOn,
  thaiDayInput,
  todayIso,
  type MasterState,
} from '../core/master';
import { useT } from '../i18n';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, FarmScreen, ListRow, Sheet, StateBadge, TextField } from './farm-ui';
import { ThaiDate } from './ThaiDate';

const dayTs = (day: string) => Date.parse(`${day}T00:00:00+07:00`);

export function PropertyDetail({ propertyId, onEdit, onDone }: { propertyId: string; onEdit: () => void; onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [now] = useState(() => Date.now());
  const [sheet, setSheet] = useState<'none' | 'area' | 'delete'>('none');
  const [area, setArea] = useState('');
  const [areaDate, setAreaDate] = useState(() => thaiDayInput(todayIso(now)));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    master.state().then(setState);
  }, []);
  useEffect(reload, [reload]);
  // Points are added and renamed on their own screens; refresh on return.
  useFocusEffect(reload);
  if (!state) return null;
  const property = state.properties.find((p) => p.id === propertyId);
  if (!property) return null;
  const today = todayIso(now);
  const points = activePoints(state, property.id);
  const areaNow = areaOn(property, today);
  const inUse = property.areaHistory.find((a) => a.effective <= today)?.entryId;
  const age = ageInYears(property.plantedYearBe, now);
  const rai = parseRai(area);
  const day = parseThaiDay(areaDate);
  const nameOf = (id: string | null) => state.people.find((p) => p.id === id)?.name ?? null;

  const text = (size: number, bold = false, color = t.color.ink) => ({
    fontFamily: t.font.family.sans,
    fontSize: size,
    fontWeight: bold ? t.font.weight.bold : t.font.weight.regular,
    color,
  });
  const label = (s: string) => <Text style={text(t.font.size.small, false, t.color.inkSoft)}>{s}</Text>;

  const saveArea = async () => {
    setTried(true);
    if (!rai.ok || rai.centiRai === null || !day || busy) return;
    setBusy(true);
    try {
      await master.recordArea(property.id, rai.centiRai, day);
    } finally {
      setBusy(false);
    }
    setSheet('none');
    setArea('');
    setTried(false);
    reload();
  };

  const remove = async () => {
    await master.remove(property.id);
    onDone();
  };

  const twoButtons = (no: () => void, yesId: string, yes: string, onYes: () => void, destructive: boolean) => (
    <View style={{ flexDirection: 'row', gap: t.space.sm }}>
      <View style={{ flex: 1 }}>
        <Button testID={`${yesId}-no`} onPress={no}>
          {msg('common.cancel')}
        </Button>
      </View>
      <View style={{ flex: 1 }}>
        <Button testID={yesId} variant={destructive ? 'destructive' : 'primary'} onPress={onYes}>
          {yes}
        </Button>
      </View>
    </View>
  );

  return (
    <FarmScreen
      title={property.name}
      subtitle={msg('properties.title')}
      back={'/properties' as Href}
      right={
        <Pressable
          testID="property-edit"
          accessibilityRole="button"
          onPress={onEdit}
          style={{
            minWidth: t.target.min,
            minHeight: t.target.min,
            borderRadius: t.radius.pill,
            borderWidth: t.border.thick,
            borderColor: t.color.action,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.space.sm,
          }}
        >
          <Text style={text(t.font.size.body, true, t.color.action)}>{msg('personDetail.edit')}</Text>
        </Pressable>
      }
      overlay={
        sheet === 'area' ? (
          <Sheet testID="area-sheet" onClose={() => setSheet('none')}>
            <Text style={text(t.font.size.headingLg, true)}>{msg('propertyDetail.changeArea')}</Text>
            <TextField
              testID="area-new"
              label={msg('propertyForm.newArea')}
              value={area}
              onChangeText={setArea}
              error={tried && (!rai.ok || rai.centiRai === null) ? msg('propertyForm.badArea') : null}
            />
            <TextField
              testID="area-new-date"
              label={msg('propertyForm.areaDate')}
              value={areaDate}
              onChangeText={setAreaDate}
              error={tried && !day ? msg('propertyForm.badDate') : null}
            />
            {twoButtons(() => setSheet('none'), 'area-save', msg('propertyDetail.areaSave'), () => void saveArea(), false)}
          </Sheet>
        ) : sheet === 'delete' ? (
          <Sheet testID="delete-confirm" onClose={() => setSheet('none')}>
            <Text style={text(t.font.size.headingLg, true)}>{msg('propertyForm.deleteTitle', { name: property.name })}</Text>
            {points.length > 0 ? (
              <View testID="delete-warning" style={{ backgroundColor: t.color.rejectSunk, borderRadius: t.radius.md, padding: t.space.md, gap: t.space.xxs }}>
                <Text style={text(t.font.size.body, true, t.color.reject)}>{`⚠ ${msg('propertyDetail.warn', { n: points.length })}`}</Text>
                {msg('propertyDetail.warnLines')
                  .split(' · ')
                  .map((line) => (
                    <Text key={line} style={text(t.font.size.body, false, t.color.reject)}>
                      {line}
                    </Text>
                  ))}
              </View>
            ) : null}
            {msg('propertyDetail.body')
              .split(' · ')
              .map((line) => (
                <Text key={line} style={text(t.font.size.body, false, t.color.inkSoft)}>
                  {line}
                </Text>
              ))}
            <Text style={text(t.font.size.body, true)}>{msg('propertyDetail.restore')}</Text>
            {twoButtons(() => setSheet('none'), 'delete-confirm-yes', msg('propertyForm.deleteYes'), () => void remove(), true)}
          </Sheet>
        ) : null
      }
    >
      <Card testID="property-summary">
        <Text style={text(t.font.size.headingLg, true)}>{property.name}</Text>
        <Text style={text(t.font.size.body, false, t.color.inkSoft)}>{msg(`crop.${property.crop}`)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm }}>
          <View testID="property-area-now" style={{ flex: 1 }}>
            {label(msg('propertyDetail.areaNow'))}
            {areaNow === null ? (
              <StateBadge text={msg('common.unknown')} />
            ) : (
              <Text style={text(t.font.size.headingMd, true)}>{msg('properties.area', { rai: formatRai(areaNow) })}</Text>
            )}
          </View>
          <Button testID="change-area" onPress={() => setSheet('area')}>
            {msg('propertyDetail.changeArea')}
          </Button>
        </View>
        <View style={{ flexDirection: 'row', gap: t.space.sm, borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm }}>
          <View testID="property-planted" style={{ flex: 1 }}>
            {label(msg('propertyDetail.planted'))}
            {property.plantedYearBe ? (
              <Text style={text(t.font.size.headingMd, true)}>{String(property.plantedYearBe)}</Text>
            ) : (
              <StateBadge text={msg('common.unknown')} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            {label(msg('propertyDetail.age'))}
            {age !== null ? (
              <Text style={text(t.font.size.headingMd, true)}>{msg('propertyDetail.years', { n: age })}</Text>
            ) : (
              <StateBadge text={msg('common.unknown')} />
            )}
          </View>
        </View>
        <View
          testID="property-gps"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: t.border.hair, borderTopColor: t.color.ruleFaint, paddingTop: t.space.sm }}
        >
          {label(msg('propertyDetail.gps'))}
          {property.gps ? <Text style={text(t.font.size.body)}>{formatGps(property.gps)}</Text> : <StateBadge text={msg('common.unknown')} />}
        </View>
      </Card>

      <Card testID="area-history">
        <Text style={text(t.font.size.bodyMd, true)}>{msg('propertyForm.history')}</Text>
        {property.areaHistory.length === 0 ? <StateBadge text={msg('common.unknown')} /> : null}
        {property.areaHistory.map((a) => (
          <View key={a.entryId} style={{ gap: 2, paddingVertical: t.space.xs }}>
            <Text style={text(t.font.size.body, true)}>{msg('properties.area', { rai: formatRai(a.centiRai) })}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
              {label(msg('propertyDetail.since'))}
              <ThaiDate ts={dayTs(a.effective)} />
            </View>
            {a.entryId === inUse ? <Text style={text(t.font.size.small, true, t.color.accept)}>{`✓ ${msg('propertyForm.inUse')}`}</Text> : null}
          </View>
        ))}
      </Card>

      <Card testID="property-points">
        <Text style={text(t.font.size.bodyMd, true)}>{msg('points.title', { n: points.length })}</Text>
        {points.length === 0 ? label(msg('points.empty')) : null}
        {points.map((p) => {
          const tapper = nameOf(tapperOn(state, p.id, today));
          return (
            <Link key={p.id} href={`/point/${p.id}` as Href} asChild>
              <ListRow
                testID={`point-${p.id}`}
                title={p.name}
                lines={[tapper ?? `⚠ ${msg('assign.none')}`]}
                badge={p.duplicateName ? <StateBadge text={msg('points.duplicate')} /> : undefined}
              />
            </Link>
          );
        })}
        <Link href={`/point/new?property=${property.id}` as Href} asChild>
          <Button testID="add-point">{msg('points.add')}</Button>
        </Link>
      </Card>

      {!property.deleted ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button testID="property-delete" variant="destructive" onPress={() => setSheet('delete')}>
            {msg('propertyForm.delete')}
          </Button>
        </View>
      ) : null}
    </FarmScreen>
  );
}
