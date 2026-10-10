/**
 * Pick a weighing point (E04-S02, mockup v1.1.0 screen 6): farm → tapper →
 * point. Points with no tapper on the sale day are listed apart, weighable,
 * with a warning (D-63, D-70). Picking one adds its farm and the point to
 * the sale once (`pointSetupPayloads`) and opens the existing counter on it,
 * so the counter flow is reused rather than duplicated.
 */

import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Card, Chip, ChipRow, FarmScreen, ListRow, StateBadge } from '../../../components/farm-ui';
import { saleSettings, todayIso, type MasterState } from '../../../core/master';
import { pointChoices, pointSetupPayloads } from '../../../core/sale-points';
import { useT } from '../../../i18n';
import { peopleStore as master } from '../../../store/people';
import { useSale } from '../../../store/SaleProvider';
import { useTheme } from '../../../theme';

export default function PickPointScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { pair: pairParam, switch: switching, farm: farmParam, tapper: tapperParam, mode } = useLocalSearchParams<{
    pair?: string;
    switch?: string;
    mode?: string;
    farm?: string;
    tapper?: string;
  }>();
  const { saleId, state: sale, append } = useSale();
  const [state, setState] = useState<MasterState | null>(null);
  // Switching from the counter opens on its farm and tapper (E04-S05, ≤ 2 taps).
  const [farmId, setFarmId] = useState<string | null>(farmParam ?? null);
  const [tapperId, setTapperId] = useState<string | null>(tapperParam ?? null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    master.state().then(setState);
  }, []);

  if (!state) return null;
  const farms = state.properties.filter((f) => !f.deleted);
  const farm = farms.find((f) => f.id === farmId) ?? farms[0] ?? null;
  // The sale's own day: the day it started, else today (Bangkok).
  const day = todayIso(sale.startedTs ?? now);
  const choices = farm ? pointChoices(state, farm.id, day) : { byTapper: [], unassigned: [] };
  const group = choices.byTapper.find((g) => g.tapperId === tapperId) ?? choices.byTapper[0] ?? null;
  const nameOf = (id: string) => state.people.find((p) => p.id === id)?.name ?? '';
  const settings = saleSettings(state);
  const pair = settings.pairs.find((p) => p.pairId === pairParam) ?? settings.pairs.find((p) => p.isDefault)!;

  const pick = (pointId: string) => {
    for (const payload of pointSetupPayloads(sale, state, pointId, pair)) append({ kind: 'sys', payload });
    // Switching from the counter (E04-S05) replaces this screen, so the
    // history never grows a counter per switch.
    const go = switching === '1' ? router.replace : router.push;
    // From the backfill screen, the pick goes back to it (E04-S10, D-49: the same flow).
    go({ pathname: mode === 'backfill' ? '/sale/[id]/backfill' : '/sale/[id]/counter', params: { id: saleId, pile: pointId } });
  };

  const heading = (text: string) => (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{text}</Text>
  );

  return (
    <FarmScreen title={msg('pick.title')} back={'/' as Href}>
      {farms.length === 0 ? <Text style={{ fontFamily: t.font.family.sans, color: t.color.inkSoft }}>{msg('pick.noFarms')}</Text> : null}
      <Card>
        {heading(msg('pick.farm'))}
        <ChipRow>
          {farms.map((f) => (
            <Chip key={f.id} testID={`pick-farm-${f.id}`} label={f.name} on={f.id === farm?.id} onPress={() => setFarmId(f.id)} />
          ))}
        </ChipRow>
      </Card>
      {choices.byTapper.length > 0 ? (
        <Card>
          {heading(msg('pick.tapper'))}
          <ChipRow>
            {choices.byTapper.map((g) => (
              <Chip
                key={g.tapperId}
                testID={`pick-tapper-${g.tapperId}`}
                label={`${nameOf(g.tapperId)} · ${msg('pick.points', { n: g.points.length })}`}
                on={g.tapperId === group?.tapperId}
                onPress={() => setTapperId(g.tapperId)}
              />
            ))}
          </ChipRow>
        </Card>
      ) : null}
      {group ? (
        <Card>
          {group.points.map((p) => (
            <ListRow key={p.id} testID={`pick-point-${p.id}`} title={p.name} onPress={() => pick(p.id)} />
          ))}
        </Card>
      ) : null}
      {choices.unassigned.length > 0 ? (
        <Card>
          {heading(msg('pick.unassigned'))}
          {choices.unassigned.map((p) => (
            <ListRow
              key={p.id}
              testID={`pick-point-${p.id}`}
              title={p.name}
              lines={[msg('pick.unassignedWarn')]}
              badge={<StateBadge text="⚠" />}
              onPress={() => pick(p.id)}
            />
          ))}
        </Card>
      ) : null}
      {farm && choices.byTapper.length === 0 && choices.unassigned.length === 0 ? (
        <Text style={{ fontFamily: t.font.family.sans, color: t.color.inkSoft }}>{msg('pick.noPoints')}</Text>
      ) : null}
    </FarmScreen>
  );
}
