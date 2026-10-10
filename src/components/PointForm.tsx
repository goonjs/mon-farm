/**
 * Add or rename one weighing point (จุดชั่ง, E03-S03, mockup v1.1.0 farm-18):
 * a farm and a name unique within that farm (D-65 Q10). Right after a new
 * point is saved, the screen offers to assign a tapper now or later (D-74
 * F15). Its tappers over time and delete are on `PointDetail` (farm-20).
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useT } from '../i18n';
import { DuplicatePointNameError } from '../store/master-store';
import { peopleStore as master, type Point, type Property } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, TextField } from './farm-ui';
import { TapperAssignments } from './TapperAssignments';

export function PointForm({
  pointId,
  propertyId,
  onDone,
}: {
  pointId: string | null;
  /** Preselected farm for a new point. */
  propertyId: string | null;
  onDone: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [farms, setFarms] = useState<Property[]>([]);
  const [existing, setExisting] = useState<Point | null>(null);
  const [farmId, setFarmId] = useState<string | null>(propertyId);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<Point | null>(null);
  const [assignNow, setAssignNow] = useState(false);

  useEffect(() => {
    master.state().then((s) => {
      setFarms(s.properties.filter((p) => !p.deleted));
      const p = pointId ? s.points.find((x) => x.id === pointId) : undefined;
      if (p) {
        setExisting(p);
        setFarmId(p.propertyId);
        setName(p.name);
      }
    });
  }, [pointId]);

  const save = async () => {
    if (!name.trim() || !farmId) return setError(msg('pointForm.needName'));
    try {
      if (existing) {
        await master.renamePoint(existing.id, name);
        onDone();
      } else {
        setOffer(await master.addPoint(farmId, name));
      }
    } catch (err) {
      if (err instanceof DuplicatePointNameError) setError(msg('pointForm.taken', { name: name.trim() }));
      else throw err;
    }
  };

  if (offer && !assignNow) {
    return (
      <Card testID="offer-assign">
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.headingMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {msg('assign.offerTitle')}
        </Text>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.ink }}>
          {msg('assign.offerBody', { name: offer.name })}
        </Text>
        <Button testID="offer-now" variant="primary" onPress={() => setAssignNow(true)}>
          {msg('assign.offerNow')}
        </Button>
        <Button testID="offer-later" onPress={onDone}>
          {msg('assign.offerLater')}
        </Button>
      </Card>
    );
  }
  if (offer) return <TapperAssignments pointId={offer.id} startOpen />;

  return (
    <View style={{ gap: t.space.md }}>
      <Card>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>
          {msg('pointForm.farm')}
        </Text>
        <ChipRow>
          {farms
            .filter((f) => !existing || f.id === existing.propertyId)
            .map((f) => (
              <Chip key={f.id} testID={`point-farm-${f.id}`} label={f.name} on={farmId === f.id} onPress={() => !existing && setFarmId(f.id)} />
            ))}
        </ChipRow>
        <TextField
          testID="point-name"
          label={msg('pointForm.name')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          error={error}
        />
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('pointForm.help')}</Text>
      </Card>

      <Button testID="point-save" variant="primary" onPress={() => void save()} disabled={!farmId}>
        {msg('common.save')}
      </Button>

    </View>
  );
}
