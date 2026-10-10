/**
 * The generic weighing-point set-up helper (D-73, mockup v1.1.0 screens
 * 13/13b): farm → tappers → how many points each → every point's name →
 * create them all at once. Nothing farm-specific is in code: the farms,
 * tappers, counts and names are all the user's. The tapper choice becomes
 * each point's assignment in E03-S05.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { filterPeople, planStarterPoints, type MasterState } from '../core/master';
import { useT } from '../i18n';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, FieldError, TextField } from './farm-ui';

export function PointsWizard({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [tappers, setTappers] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string[]>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    master.state().then(setState);
  }, []);

  const toggleTapper = (id: string) => {
    setTappers((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setNames((cur) => (cur[id] ? cur : { ...cur, [id]: [''] }));
  };
  const setCount = (id: string, n: number) =>
    setNames((cur) => {
      const list = cur[id] ?? [''];
      return { ...cur, [id]: n > list.length ? [...list, ...Array(n - list.length).fill('')] : list.slice(0, Math.max(1, n)) };
    });
  const setName = (id: string, i: number, v: string) =>
    setNames((cur) => ({ ...cur, [id]: (cur[id] ?? []).map((x, j) => (j === i ? v : x)) }));

  const rows = farmId ? tappers.map((id) => ({ propertyId: farmId, tapperId: id, names: names[id] ?? [''] })) : [];
  const plan = state ? planStarterPoints(state, rows) : null;
  const total = rows.reduce((n, r) => n + r.names.length, 0);
  const people = state ? filterPeople(state.people, 'tapper') : [];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '';

  const create = async () => {
    setTried(true);
    // One run at a time: a double tap must not create the set twice.
    if (!plan?.ok || total === 0 || busy) return;
    setBusy(true);
    try {
      await master.createStarterPoints(rows);
    } finally {
      setBusy(false);
    }
    onDone();
  };

  const heading = (text: string) => (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.ink }}>{text}</Text>
  );

  return (
    <View style={{ gap: t.space.md }}>
      <Card>
        {heading(msg('wizard.farm'))}
        <ChipRow>
          {state?.properties
            .filter((p) => !p.deleted)
            .map((p) => (
              <Chip key={p.id} testID={`wizard-farm-${p.id}`} label={p.name} on={farmId === p.id} onPress={() => setFarmId(p.id)} />
            ))}
        </ChipRow>
      </Card>

      <Card>
        {heading(msg('wizard.tappers'))}
        {state && people.length === 0 ? (
          <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{msg('wizard.noTappers')}</Text>
        ) : null}
        <ChipRow>
          {people.map((p) => (
            <Chip key={p.id} testID={`wizard-tapper-${p.id}`} label={p.name} on={tappers.includes(p.id)} onPress={() => toggleTapper(p.id)} />
          ))}
        </ChipRow>
      </Card>

      {tappers.length > 0 ? (
        <Card>
          {heading(msg('wizard.counts'))}
          {tappers.map((id) => {
            const n = (names[id] ?? ['']).length;
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                <Text style={{ flex: 1, fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                  {nameOf(id)}
                </Text>
                <Button testID={`wizard-less-${id}`} accessibilityLabel={msg('wizard.less')} onPress={() => setCount(id, n - 1)} disabled={n <= 1}>
                  −
                </Button>
                <Text testID={`wizard-count-${id}`} style={{ minWidth: 32, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.lead, color: t.color.ink }}>
                  {n}
                </Text>
                <Button testID={`wizard-more-${id}`} accessibilityLabel={msg('wizard.more')} onPress={() => setCount(id, n + 1)}>
                  +
                </Button>
              </View>
            );
          })}
        </Card>
      ) : null}

      {tappers.length > 0 ? (
        <Card>
          {heading(msg('wizard.names'))}
          {tappers.flatMap((id) =>
            (names[id] ?? ['']).map((v, i) => (
              <TextField
                key={`${id}-${i}`}
                testID={`wizard-name-${id}-${i}`}
                label={msg('wizard.pointOf', { name: nameOf(id), n: i + 1 })}
                value={v}
                onChangeText={(x) => setName(id, i, x)}
              />
            )),
          )}
          {tried && plan && !plan.ok && plan.missing > 0 ? <FieldError text={msg('wizard.needNames')} /> : null}
          {tried && plan && !plan.ok && plan.duplicates.length > 0 ? (
            <FieldError text={msg('wizard.duplicates', { names: plan.duplicates.join(', ') })} />
          ) : null}
        </Card>
      ) : null}

      <Button testID="wizard-create" variant="primary" onPress={() => void create()} disabled={!farmId || total === 0}>
        {msg('wizard.create', { n: total })}
      </Button>
    </View>
  );
}
