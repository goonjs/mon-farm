/**
 * Add or edit one farm property (สวน, E03-S02, mockup v1.1.0 farm-13).
 *
 * Name and crop are required; area, planted year and GPS may stay blank and
 * then read "ไม่ทราบ" (D-65 Q7, SYNC-12). A new farm's area takes effect
 * today; later changes are dated entries made from `PropertyDetail`'s
 * "เปลี่ยนพื้นที่", never written over the old one (MD-1). The history, the
 * farm's points and delete are on the detail too (farm-14/15).
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { ageInYears, formatGps, parseGps, parsePlantedYear, parseRai, todayIso, validateProperty } from '../core/master';
import type { Crop } from '../core/types';
import { useT } from '../i18n';
import { peopleStore as master, type Property } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, FieldError, TextField } from './farm-ui';

type Problem = 'name' | 'crop' | 'area' | 'year' | 'gps';

export function PropertyForm({ propertyId, onDone }: { propertyId: string | null; onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [existing, setExisting] = useState<Property | null>(null);
  const [name, setName] = useState('');
  const [crop, setCrop] = useState<Crop | null>(null);
  const [area, setArea] = useState('');
  const [now] = useState(() => Date.now());
  const [planted, setPlanted] = useState('');
  const [gps, setGps] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

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
  const gpsParsed = parseGps(gps);
  const plantedParsed = parsePlantedYear(planted, now);
  const year = plantedParsed.ok ? plantedParsed.yearBe : null;
  const problems: Problem[] = [
    ...validateProperty({ name, crop }),
    ...(!rai.ok ? (['area'] as const) : []),
    ...(!plantedParsed.ok ? (['year'] as const) : []),
    ...(!gpsParsed.ok ? (['gps'] as const) : []),
  ];
  const show = (p: Problem) => tried && problems.includes(p);

  const save = async () => {
    setTried(true);
    if (problems.length || !crop || !rai.ok || !gpsParsed.ok || busy) return;
    // One save at a time: a double tap must not create two farms.
    setBusy(true);
    try {
      const fields = { name, crop, plantedYearBe: year, gps: gpsParsed.gps };
      const id = existing ? existing.id : (await master.addProperty(fields)).id;
      if (existing) await master.editProperty(id, fields);
      // A new farm's area takes effect today; later changes are dated on the detail (MD-1).
      if (!existing && rai.centiRai !== null) await master.recordArea(id, rai.centiRai, todayIso(now));
    } finally {
      setBusy(false);
    }
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

        {existing ? null : (
          <TextField
            testID="property-area"
            label={msg('propertyForm.area')}
            placeholder={msg('propertyForm.areaPlaceholder')}
            value={area}
            onChangeText={setArea}
            error={show('area') ? msg('propertyForm.badArea') : null}
          />
        )}
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

      <Button testID="property-save" variant="primary" onPress={() => void save()}>
        {msg('common.save')}
      </Button>
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
