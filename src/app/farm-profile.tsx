/**
 * The farm profile — zones and their usual piles, saved on this device
 * (S27). Reached from settings, not the sale list: this is device
 * configuration, not a working screen used with a scale in front of anyone.
 *
 * Nothing on this screen writes to the event log — see the header comment on
 * `settings.tsx` for why the profile lives beside language/theme/speech
 * rather than inside any one sale. The one place the profile touches sale
 * data is setup's prefill button (`sale/[id]/setup.tsx`), which copies the
 * profile's own zone/pile ids into ordinary `zone_added` / `pile_added`
 * events — nothing here does that.
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';

import { Button, TopBar } from '../components/chrome';
import { projectSale } from '../core/project';
// Bare specifiers — Metro resolves each to its platform adapter; see the
// note in SaleProvider.tsx for why a literal '.web'/'.native' import here
// would be wrong.
import { farmStore } from '../store/farm';
import { store } from '../store/store';
import type { ProfilePile, ProfileZone } from '../store/farm';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export default function FarmProfileScreen() {
  const t = useTheme();
  const msg = useT();

  const [zones, setZones] = useState<ProfileZone[] | null>(null); // null = loading
  const [hasPastSale, setHasPastSale] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');

  const reload = useCallback(() => {
    farmStore.listZones().then(setZones);
  }, []);

  useEffect(reload, [reload]);

  // First-use seeding: only worth checking once the profile is confirmed
  // empty, and only ever offered — never applied — automatically.
  useEffect(() => {
    if (zones === null || zones.length > 0) return;
    let live = true;
    store.listSales().then((ids) => {
      if (live) setHasPastSale(ids.length > 0);
    });
    return () => {
      live = false;
    };
  }, [zones]);

  const seedFromLastSale = async () => {
    const ids = await store.listSales();
    if (ids.length === 0) return;
    // listSales() is newest first (store.ts).
    const events = await store.load(ids[0]);
    const sale = projectSale(events, ids[0]);
    for (const zone of sale.zones) {
      const profileZone = await farmStore.addZone(zone.name);
      const piles = sale.piles.filter((p) => p.zoneId === zone.id);
      for (const pile of piles) {
        await farmStore.addPile(profileZone.id, pile.name, pile.tareG, pile.stdNetG);
      }
    }
    reload();
  };

  const addZone = async () => {
    const name = newZoneName.trim();
    if (!name) return;
    await farmStore.addZone(name);
    setNewZoneName('');
    reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={msg('farmProfile.title')}
        right={
          <Link href="/settings" asChild>
            <Button testID="farm-profile-back" icon="arrow-left">{msg('farmProfile.back')}</Button>
          </Link>
        }
      />

      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        {zones === null ? (
          <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
        ) : (
          <>
            {zones.length === 0 && hasPastSale ? (
              <View
                style={{
                  borderWidth: t.border.hair,
                  borderColor: t.color.rule,
                  borderRadius: t.radius.md,
                  backgroundColor: t.color.surfaceRaised,
                  padding: t.space.md,
                  gap: t.space.sm,
                }}
              >
                <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.small, color: t.color.ink }}>
                  {msg('farmProfile.seedPrompt')}
                </Text>
                <Button testID="seed-from-last-sale" variant="primary" onPress={seedFromLastSale}>
                  {msg('farmProfile.seedButton')}
                </Button>
              </View>
            ) : null}

            {zones.length === 0 ? (
              <Text testID="farm-profile-empty" style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.small, color: t.color.inkSoft }}>
                {msg('farmProfile.empty')}
              </Text>
            ) : (
              zones.map((zone) => <ZoneCard key={zone.id} zone={zone} onChange={reload} />)
            )}

            <View style={{ flexDirection: 'row', gap: t.space.xs }}>
              <TextInput
                testID="new-zone-name"
                value={newZoneName}
                onChangeText={setNewZoneName}
                placeholder={msg('farmProfile.zoneNamePlaceholder')}
                placeholderTextColor={t.color.inkFaint}
                onSubmitEditing={addZone}
                style={inputStyle(t)}
              />
              <Button testID="add-zone" variant="primary" onPress={addZone} disabled={!newZoneName.trim()}>
                {msg('farmProfile.addZone')}
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ZoneCard({ zone, onChange }: { zone: ProfileZone; onChange: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [name, setName] = useState(zone.name);

  const [pileName, setPileName] = useState('');
  const [tareKg, setTareKg] = useState('2');
  const [stdKg, setStdKg] = useState('50');

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === zone.name) return;
    await farmStore.renameZone(zone.id, trimmed);
    onChange();
  };

  const archive = async () => {
    await farmStore.archiveZone(zone.id);
    onChange();
  };

  const addPile = async () => {
    const trimmedName = pileName.trim();
    const tare = Number(tareKg);
    const std = Number(stdKg);
    if (!trimmedName || !Number.isFinite(tare) || tare < 0 || !Number.isFinite(std) || std <= 0) return;
    await farmStore.addPile(zone.id, trimmedName, Math.round(tare * 1000), Math.round(std * 1000));
    setPileName('');
    onChange();
  };

  return (
    <View
      testID={`zone-${zone.id}`}
      style={{
        borderWidth: t.border.hair,
        borderColor: t.color.rule,
        borderRadius: t.radius.md,
        padding: t.space.sm,
        backgroundColor: t.color.surfaceRaised,
        gap: t.space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
        <TextInput
          testID={`zone-name-${zone.id}`}
          value={name}
          onChangeText={setName}
          style={[inputStyle(t), { flex: 1 }]}
        />
        <Button testID={`save-zone-name-${zone.id}`} onPress={saveName} disabled={!name.trim() || name.trim() === zone.name}>
          {msg('farmProfile.renameZone')}
        </Button>
        <Button testID={`archive-zone-${zone.id}`} variant="destructive" onPress={archive}>
          {msg('farmProfile.archiveZone')}
        </Button>
      </View>

      {zone.piles.length === 0 ? (
        <Text style={{ ...t.face(t.font.weight.regular), fontSize: t.font.size.small, color: t.color.inkSoft }}>
          {msg('farmProfile.noPiles')}
        </Text>
      ) : (
        zone.piles.map((pile) => <PileRow key={pile.id} zone={zone} pile={pile} onChange={onChange} />)
      )}

      <View style={{ flexDirection: 'row', gap: t.space.xs, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <View style={{ flexBasis: 100, flexGrow: 1 }}>
          <TextInput
            testID={`pile-name-${zone.id}`}
            value={pileName}
            onChangeText={setPileName}
            placeholder={msg('farmProfile.pileNamePlaceholder')}
            placeholderTextColor={t.color.inkFaint}
            style={inputStyle(t)}
          />
        </View>
        <View style={{ width: 70 }}>
          <TextInput
            testID={`pile-tare-${zone.id}`}
            value={tareKg}
            onChangeText={setTareKg}
            placeholder={msg('farmProfile.tarePlaceholder')}
            placeholderTextColor={t.color.inkFaint}
            keyboardType="decimal-pad"
            style={inputStyle(t)}
          />
        </View>
        <View style={{ width: 70 }}>
          <TextInput
            testID={`pile-std-${zone.id}`}
            value={stdKg}
            onChangeText={setStdKg}
            placeholder={msg('farmProfile.stdPlaceholder')}
            placeholderTextColor={t.color.inkFaint}
            keyboardType="decimal-pad"
            style={inputStyle(t)}
          />
        </View>
        <Button testID={`add-pile-${zone.id}`} onPress={addPile} disabled={!pileName.trim()}>
          {msg('farmProfile.addPile')}
        </Button>
      </View>
    </View>
  );
}

function PileRow({ zone, pile, onChange }: { zone: ProfileZone; pile: ProfilePile; onChange: () => void }) {
  const t = useTheme();
  const msg = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pile.name);
  const [tareKg, setTareKg] = useState(String(pile.tareG / 1000));
  const [stdKg, setStdKg] = useState(String(pile.stdNetG / 1000));

  const startEdit = () => {
    setName(pile.name);
    setTareKg(String(pile.tareG / 1000));
    setStdKg(String(pile.stdNetG / 1000));
    setEditing(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    const tare = Number(tareKg);
    const std = Number(stdKg);
    if (!trimmed || !Number.isFinite(tare) || tare < 0 || !Number.isFinite(std) || std <= 0) return;
    await farmStore.editPile(zone.id, pile.id, {
      name: trimmed,
      tareG: Math.round(tare * 1000),
      stdNetG: Math.round(std * 1000),
    });
    setEditing(false);
    onChange();
  };

  const remove = async () => {
    await farmStore.removePile(zone.id, pile.id);
    onChange();
  };

  if (editing) {
    return (
      <View
        testID={`pile-${pile.id}`}
        style={{ flexDirection: 'row', gap: t.space.xs, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <View style={{ flexBasis: 100, flexGrow: 1 }}>
          <TextInput testID={`edit-pile-name-${pile.id}`} value={name} onChangeText={setName} style={inputStyle(t)} />
        </View>
        <View style={{ width: 70 }}>
          <TextInput
            testID={`edit-pile-tare-${pile.id}`}
            value={tareKg}
            onChangeText={setTareKg}
            keyboardType="decimal-pad"
            style={inputStyle(t)}
          />
        </View>
        <View style={{ width: 70 }}>
          <TextInput
            testID={`edit-pile-std-${pile.id}`}
            value={stdKg}
            onChangeText={setStdKg}
            keyboardType="decimal-pad"
            style={inputStyle(t)}
          />
        </View>
        <Button testID={`save-pile-${pile.id}`} variant="primary" onPress={save}>
          {msg('farmProfile.savePile')}
        </Button>
        <Button testID={`cancel-edit-pile-${pile.id}`} onPress={() => setEditing(false)}>
          {msg('farmProfile.cancelEdit')}
        </Button>
      </View>
    );
  }

  return (
    <View testID={`pile-${pile.id}`} style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
      <Text style={{ flex: 1, fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}>
        {msg('farmProfile.pileRow', { name: pile.name, tare: pile.tareG / 1000, std: pile.stdNetG / 1000 })}
      </Text>
      <Button testID={`edit-pile-${pile.id}`} onPress={startEdit}>
        {msg('farmProfile.editPile')}
      </Button>
      <Button testID={`remove-pile-${pile.id}`} variant="destructive" onPress={remove}>
        {msg('farmProfile.removePile')}
      </Button>
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
    ...t.face(t.font.weight.regular),
    fontSize: t.font.size.small,
    minHeight: 34,
    paddingHorizontal: t.space.sm,
    borderWidth: t.border.hair,
    borderColor: t.color.ruleStrong,
    borderRadius: t.radius.sm,
    backgroundColor: t.color.surfaceRaised,
    color: t.color.ink,
  } as const;
}
