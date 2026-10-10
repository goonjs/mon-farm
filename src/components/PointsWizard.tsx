/**
 * The generic weighing-point set-up helper (D-73, mockup v1.1.0 farm-16/17):
 * a four-step strip; page one is farm → tappers → how many points each,
 * page two every point's name, grouped per tapper → create them all at once.
 * Nothing farm-specific is in code: the farms, tappers, counts and names are
 * all the user's. The tapper choice becomes each point's assignment in
 * E03-S05.
 */

import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { filterPeople, planStarterPoints, type MasterState } from '../core/master';
import { useT } from '../i18n';
import { peopleStore as master } from '../store/people';
import { useTheme } from '../theme';
import { Button } from './chrome';
import { Card, Chip, ChipRow, FarmScreen, FieldError } from './farm-ui';

export function PointsWizard({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [state, setState] = useState<MasterState | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [tappers, setTappers] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string[]>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<1 | 2>(1);

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
  const farm = state?.properties.find((p) => p.id === farmId);

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
  const hint = (text: string) => (
    <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}>{text}</Text>
  );
  const missing = (v: string) => tried && !v.trim();

  // The strip lights the step being worked on: done steps tinted, the current one filled.
  const step = page === 2 ? 4 : tappers.length > 0 ? 3 : farmId ? 2 : 1;
  const strip = (
    <View style={{ flexDirection: 'row', gap: t.space.xs }}>
      {[msg('wizard.step1'), msg('wizard.step2'), msg('wizard.step3'), msg('wizard.step4')].map((label, i) => {
        const n = i + 1;
        const on = n === step;
        const done = n < step;
        return (
          <View
            key={label}
            testID={`wizard-step-${n}`}
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: t.space.xs,
              borderRadius: t.radius.pill,
              backgroundColor: on ? t.color.action : done ? t.color.acceptSunk : t.color.surfaceSunk,
            }}
          >
            <Text
              style={{
                fontFamily: t.font.family.sans,
                fontSize: t.font.size.caption,
                fontWeight: t.font.weight.bold,
                color: on ? t.color.inkInverse : done ? t.color.accept : t.color.inkSoft,
              }}
            >
              {`${n}. ${label}`}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const pageOne = (
    <>
      <Card>
        {heading(msg('wizard.farm'))}
        <ChipRow>
          {state?.properties
            .filter((p) => !p.deleted)
            .map((p) => (
              <Chip key={p.id} testID={`wizard-farm-${p.id}`} label={p.name} on={farmId === p.id} onPress={() => setFarmId(p.id)} />
            ))}
        </ChipRow>
        {hint(msg('wizard.farmHint'))}
      </Card>

      <Card>
        {heading(msg('wizard.tappers'))}
        {state && people.length === 0 ? hint(msg('wizard.noTappers')) : null}
        <ChipRow>
          {people.map((p) => (
            <Chip key={p.id} testID={`wizard-tapper-${p.id}`} label={p.name} on={tappers.includes(p.id)} onPress={() => toggleTapper(p.id)} />
          ))}
        </ChipRow>
        {hint(msg('wizard.tappersHint'))}
      </Card>

      {tappers.length > 0 ? (
        <Card>
          {heading(msg('wizard.counts'))}
          {tappers.map((id) => {
            const n = (names[id] ?? ['']).length;
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.body, fontWeight: t.font.weight.bold, color: t.color.ink }}>
                    {nameOf(id)}
                  </Text>
                  {hint(msg('role.tapper'))}
                </View>
                <Button testID={`wizard-less-${id}`} accessibilityLabel={msg('wizard.less')} onPress={() => setCount(id, n - 1)} disabled={n <= 1}>
                  −
                </Button>
                <Text
                  testID={`wizard-count-${id}`}
                  style={{ minWidth: 32, textAlign: 'center', fontFamily: t.font.family.sans, fontSize: t.font.size.lead, fontWeight: t.font.weight.bold, color: t.color.ink }}
                >
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
    </>
  );

  const pageTwo = (
    <>
      {tappers.map((id) => {
        const list = names[id] ?? [''];
        return (
          <Card key={id} testID={`wizard-group-${id}`}>
            {heading(msg('wizard.group', { farm: farm?.name ?? '', name: nameOf(id), n: list.length }))}
            {list.map((v, i) => {
              const label = msg('wizard.pointOf', { name: nameOf(id), n: i + 1 });
              return (
                <View key={`${id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                  <Text numberOfLines={1} style={{ width: '38%', fontFamily: t.font.family.sans, fontSize: t.font.size.body, color: t.color.inkSoft }}>
                    {label}
                  </Text>
                  <TextInput
                    testID={`wizard-name-${id}-${i}`}
                    accessibilityLabel={label}
                    placeholder={msg('wizard.namePlaceholder')}
                    placeholderTextColor={t.color.inkFaint}
                    value={v}
                    onChangeText={(x) => setName(id, i, x)}
                    style={{
                      flex: 1,
                      minHeight: t.target.min,
                      paddingHorizontal: t.space.md,
                      borderRadius: t.radius.md,
                      borderWidth: missing(v) ? t.border.thick : t.border.hair,
                      borderColor: missing(v) ? t.color.reject : t.color.ruleStrong,
                      backgroundColor: t.color.surfaceRaised,
                      fontFamily: t.font.family.sans,
                      fontSize: t.font.size.body,
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
      {tried && plan && !plan.ok && plan.missing > 0 ? <FieldError text={msg('wizard.needNames')} /> : null}
      {tried && plan && !plan.ok && plan.duplicates.length > 0 ? (
        <FieldError text={msg('wizard.duplicates', { names: plan.duplicates.join(', ') })} />
      ) : null}
      <Card>
        {heading(msg('assign.title'))}
        {hint(msg('wizard.infoStart'))}
        {hint(`✓ ${msg('wizard.infoLater')}`)}
      </Card>
    </>
  );

  return (
    <FarmScreen
      title={msg('wizard.title')}
      subtitle={msg(page === 2 ? 'wizard.lastStep' : 'properties.title')}
      back={'/properties' as Href}
      footer={
        page === 1 ? (
          <Button testID="wizard-next" variant="primary" onPress={() => setPage(2)} disabled={!farmId || total === 0}>
            {msg('wizard.next')}
          </Button>
        ) : (
          <Button testID="wizard-create" variant="primary" onPress={() => void create()} disabled={total === 0}>
            {msg('wizard.create', { n: total })}
          </Button>
        )
      }
    >
      {strip}
      {page === 1 ? pageOne : pageTwo}
    </FarmScreen>
  );
}
