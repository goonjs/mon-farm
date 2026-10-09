/**
 * Add or edit one farm property (สวน, E03-S02, mockup v1.1.0 screens 10–12).
 *
 * Name and crop are required; area, planted year and GPS may stay blank and
 * then read "ไม่ทราบ" (D-65 Q7, SYNC-12). Area is a dated history: a new
 * value is appended with its effective date, never written over the old one
 * (MD-1). Delete is always allowed and takes the property's weighing points
 * with it until restored (D-58, D-65 Q9).
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  ageInYears,
  formatGps,
  formatRai,
  parseGps,
  parseRai,
  parseThaiDay,
  thaiDayInput,
  todayIso,
  validateProperty,
} from '../core/master';
import type { Crop } from '../core/types';
import { useT } from '../i18n';
import { peopleStore as master, type Property } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, FieldError, TextField } from './farm-ui';
import { ThaiDate } from './ThaiDate';

type Problem = 'name' | 'crop' | 'area' | 'date' | 'year' | 'gps';

export function PropertyForm({ propertyId, onDone }: { propertyId: string | null; onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [existing, setExisting] = useState<Property | null>(null);
  const [name, setName] = useState('');
  const [crop, setCrop] = useState<Crop | null>(null);
  const [area, setArea] = useState('');
  const [now] = useState(() => Date.now());
  const [areaDate, setAreaDate] = useState(() => thaiDayInput(todayIso(now)));
  const [planted, setPlanted] = useState('');
  const [gps, setGps] = useState('');
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    master.state().then((s) => {
      const p = s.properties.find((x) => x.id === propertyId);
      if (!p) return;
      setExisting(p);
      setName(p.name);
      setCrop(p.crop);
      setPlanted(p.plantedYearBe ? String(p.plantedYearBe) : '');
      setGps(p.gps ? formatGps(p.gps) : '');
    });
  }, [propertyId]);

  const rai = parseRai(area);
  const day = parseThaiDay(areaDate);
  const gpsParsed = parseGps(gps);
  const year = planted.trim() ? (/^\d{4}$/.test(planted.trim()) ? Number(planted.trim()) : NaN) : null;
  const problems: Problem[] = [
    ...validateProperty({ name, crop }),
    ...(!rai.ok ? (['area'] as const) : []),
    ...(rai.ok && rai.centiRai !== null && !day ? (['date'] as const) : []),
    ...(Number.isNaN(year) ? (['year'] as const) : []),
    ...(!gpsParsed.ok ? (['gps'] as const) : []),
  ];
  const show = (p: Problem) => tried && problems.includes(p);

  const save = async () => {
    setTried(true);
    if (problems.length || !crop || !rai.ok || !gpsParsed.ok) return;
    const fields = { name, crop, plantedYearBe: year, gps: gpsParsed.gps };
    const id = existing ? existing.id : (await master.addProperty(fields)).id;
    if (existing) await master.editProperty(id, fields);
    if (rai.centiRai !== null && day) await master.recordArea(id, rai.centiRai, day);
    onDone();
  };

  const remove = async () => {
    if (!existing) return;
    await master.remove(existing.id);
    onDone();
  };

  const age = ageInYears(existing?.plantedYearBe ?? null, now);

  return (
    <View style={{ gap: t.space.md }}>
      <Card>
        <TextField
          testID="property-name"
          label={msg('propertyForm.name')}
          value={name}
          onChangeText={setName}
          error={show('name') ? msg('propertyForm.needName') : null}
        />
        <Label text={msg('propertyForm.crop')} />
        <ChipRow>
          {(['rubber', 'durian'] as const).map((c) => (
            <Chip key={c} testID={`crop-${c}`} label={msg(`crop.${c}`)} on={crop === c} onPress={() => setCrop(c)} />
          ))}
        </ChipRow>
        {show('crop') ? <FieldError text={msg('propertyForm.needCrop')} /> : null}

        <TextField
          testID="property-area"
          label={msg(existing ? 'propertyForm.newArea' : 'propertyForm.area')}
          placeholder={msg('propertyForm.areaPlaceholder')}
          value={area}
          onChangeText={setArea}
          error={show('area') ? msg('propertyForm.badArea') : null}
        />
        <TextField
          testID="property-area-date"
          label={msg('propertyForm.areaDate')}
          value={areaDate}
          onChangeText={setAreaDate}
          error={show('date') ? msg('propertyForm.badDate') : null}
        />
        <TextField
          testID="property-planted"
          label={msg('propertyForm.planted')}
          placeholder={msg('propertyForm.plantedPlaceholder')}
          value={planted}
          onChangeText={setPlanted}
          error={show('year') ? msg('propertyForm.badYear') : null}
        />
        {age !== null ? <Muted text={msg('propertyForm.age', { n: age })} /> : null}
        <TextField
          testID="property-gps"
          label={msg('propertyForm.gps')}
          placeholder={msg('propertyForm.gpsPlaceholder')}
          value={gps}
          onChangeText={setGps}
          error={show('gps') ? msg('propertyForm.badGps') : null}
        />
        {!gps.trim() ? <Muted text={msg('common.unknown')} /> : null}
      </Card>

      {existing ? (
        <Card testID="area-history">
          <Label text={msg('propertyForm.history')} />
          {existing.areaHistory.length === 0 ? <Muted text={msg('common.unknown')} /> : null}
          {existing.areaHistory.map((a) => (
            <View key={a.entryId} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
                {msg('propertyForm.historyRow', { rai: formatRai(a.centiRai) })}
              </Text>
              <ThaiDate ts={Date.parse(`${a.effective}T00:00:00+07:00`)} />
              {a.entryId === existing.areaHistory.find((x) => x.effective <= todayIso(now))?.entryId ? (
                <Muted text={`✓ ${msg('propertyForm.inUse')}`} />
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Button testID="property-save" variant="primary" onPress={() => void save()}>
        {msg('common.save')}
      </Button>

      {existing && !existing.deleted ? (
        confirming ? (
          <Card testID="delete-confirm">
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
              {msg('propertyForm.deleteTitle', { name: existing.name })}
            </Text>
            <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
              {msg('propertyForm.deleteBody')}
            </Text>
            <View style={{ flexDirection: 'row', gap: t.space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID="delete-confirm-no" onPress={() => setConfirming(false)}>
                  {msg('common.cancel')}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="delete-confirm-yes" variant="destructive" onPress={() => void remove()}>
                  {msg('propertyForm.deleteYes')}
                </Button>
              </View>
            </View>
          </Card>
        ) : (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button testID="property-delete" variant="destructive" onPress={() => setConfirming(true)}>
              {msg('propertyForm.delete')}
            </Button>
          </View>
        )
      ) : null}
    </View>
  );
}

function Label({ text }: { text: string }) {
  const t = useTheme();
  return (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
      {text}
    </Text>
  );
}

function Muted({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{text}</Text>;
}
