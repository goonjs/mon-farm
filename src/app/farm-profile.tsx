/**
 * The farm profile's own screen (S27) — the one place the profile changes.
 *
 * ── Why its own screen, not a section on settings.tsx ───────────────────────
 *
 * `settings.tsx` frames itself as "language and theme — nothing about a
 * sale", and every control on it is a two-option `Choice` row. Zones, piles,
 * tares and standard nets are a materially bigger surface — closer to
 * `ZonesCard` than to a theme toggle — and folding them in would turn the
 * settings screen into the catch-all its own header says it is not. Settings
 * keeps one row that links here.
 *
 * ── What this screen is for ─────────────────────────────────────────────────
 *
 * The profile is the STARTING POINT for the next sale's setup, and this is
 * the only surface that writes it. Nothing a sale does writes back: an
 * offered tare edited before acceptance, or a pile corrected mid-count
 * (S26's `pile_edited`), changes that sale and only that sale. The epic
 * rejected implicit inheritance because a one-off change silently becoming
 * next month's default is invisible to the owner; what this screen shows is
 * exactly what the next sale will prefill, and nothing else changes it.
 *
 * The one exception is the seed, and it happens exactly once: the first time
 * this screen is opened with a profile that is empty AND has never been
 * seeded, it is filled in from the most recently started sale — so the first
 * profile does not have to be typed either. A profile the owner has since
 * emptied — whether it was seeded or typed by hand — stays empty
 * (`establishedTs` outlives the zones).
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, TopBar } from '../components/chrome';
import { PileEditor, type PileEdit } from '../components/PileEditor';
import { RemoveControl } from '../components/RemoveControl';
import { projectSale } from '../core/project';
import { farmProfileStore, type FarmProfile, type ProfileZone } from '../store/farmProfile';
import { profileZonesFromSale } from '../store/farmProfile-doc';
// Bare specifier — see the note in SaleProvider.tsx for why this matters.
import { store } from '../store/store';
import { useT } from '../i18n';
import { useTheme } from '../theme';

export default function FarmProfileScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const [profile, setProfile] = useState<FarmProfile | null>(null); // null = loading
  const [newZoneName, setNewZoneName] = useState('');

  const reload = useCallback(async () => {
    setProfile(await farmProfileStore.get());
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const current = await farmProfileStore.get();
      // The seed is offered, not forced: `seed()` itself refuses a profile
      // that already has zones or has been seeded before, so this can only
      // ever fill in a genuinely empty, never-seeded one.
      if (current.establishedTs === null && current.zones.length === 0) {
        const zones = await lastSaleProfileZones();
        if (zones.length) await farmProfileStore.seed(zones);
      }
      const loaded = await farmProfileStore.get();
      if (live) setProfile(loaded);
    })();
    return () => {
      live = false;
    };
  }, []);

  const addZone = async () => {
    const name = newZoneName.trim();
    if (!name) return;
    await farmProfileStore.addZone(name);
    setNewZoneName('');
    await reload();
  };

  return (
    <View testID="farm-profile" style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={msg('farmProfile.title')}
        right={
          <Button testID="farm-profile-back" onPress={() => router.back()}>
            {msg('farmProfile.back')}
          </Button>
        }
      />

      <ScrollView contentContainerStyle={{ padding: t.space.md, gap: t.space.md }}>
        <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkFaint }}>
          {msg('farmProfile.intro')}
        </Text>

        {profile === null ? (
          <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>
            {msg('farmProfile.loading')}
          </Text>
        ) : (
          <>
            {profile.zones.length === 0 ? (
              <Text
                testID="profile-empty"
                style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft }}
              >
                {msg('farmProfile.empty')}
              </Text>
            ) : (
              profile.zones.map((zone) => <ProfileZoneEditor key={zone.id} zone={zone} onChanged={reload} />)
            )}

            <View style={{ flexDirection: 'row', gap: t.space.xs }}>
              <TextInput
                testID="profile-new-zone-name"
                value={newZoneName}
                onChangeText={setNewZoneName}
                placeholder={msg('setup.zoneNamePlaceholder')}
                placeholderTextColor={t.color.inkFaint}
                onSubmitEditing={addZone}
                style={{ ...inputStyle(t), flex: 1 }}
              />
              <Button testID="profile-add-zone" variant="primary" onPress={addZone} disabled={!newZoneName.trim()}>
                {msg('farmProfile.addZone')}
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The zones and piles of the most recently STARTED sale, as profile zones.
 *
 * "Started", not "closed" — see the story's Dev notes. Decided from each
 * sale's own `startedTs` rather than from the order `listSales()` happens to
 * return, because that order is an adapter's detail and this is a rule.
 */
async function lastSaleProfileZones(): Promise<ProfileZone[]> {
  const ids = await store.listSales();
  if (!ids.length) return [];
  const states = await Promise.all(ids.map(async (id) => projectSale(await store.load(id), id)));
  const last = states.reduce<(typeof states)[number] | null>(
    (best, s) => (best === null || (s.startedTs ?? 0) > (best.startedTs ?? 0) ? s : best),
    null,
  );
  return last ? profileZonesFromSale(last.zones, last.piles) : [];
}

function ProfileZoneEditor({ zone, onChanged }: { zone: ProfileZone; onChanged: () => Promise<void> }) {
  const t = useTheme();
  const msg = useT();
  const [renaming, setRenaming] = useState(false);
  const [zoneName, setZoneName] = useState(zone.name);
  const [pileName, setPileName] = useState('');
  const [tareKg, setTareKg] = useState('2');
  const [stdKg, setStdKg] = useState('50');

  const addPile = async () => {
    const name = pileName.trim();
    const tare = Number(tareKg);
    const std = Number(stdKg);
    if (!name || !Number.isFinite(tare) || tare < 0 || !Number.isFinite(std) || std <= 0) return;
    await farmProfileStore.addPile(zone.id, {
      name,
      tareG: Math.round(tare * 1000),
      stdNetG: Math.round(std * 1000),
    });
    setPileName('');
    await onChanged();
  };

  return (
    <View
      testID={`profile-zone-${zone.id}`}
      style={{
        borderWidth: t.border.hair,
        borderColor: t.color.rule,
        borderRadius: t.radius.sm,
        padding: t.space.sm,
        backgroundColor: t.color.surfaceSunk,
        gap: t.space.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
        <Text
          style={{
            flex: 1,
            fontFamily: t.font.family.sans,
            fontWeight: t.font.weight.bold,
            fontSize: t.font.size.small,
            color: t.color.ink,
          }}
        >
          {zone.name}
        </Text>
        <Button
          testID={`profile-rename-zone-${zone.id}`}
          onPress={() => {
            setZoneName(zone.name);
            setRenaming(true);
          }}
        >
          {msg('farmProfile.rename')}
        </Button>
      </View>

      {renaming ? (
        <View style={{ flexDirection: 'row', gap: t.space.xs }}>
          <TextInput
            testID={`profile-zone-name-${zone.id}`}
            value={zoneName}
            onChangeText={setZoneName}
            style={{ ...inputStyle(t), flex: 1 }}
          />
          <Button
            testID={`profile-zone-name-save-${zone.id}`}
            variant="primary"
            disabled={!zoneName.trim()}
            onPress={async () => {
              const name = zoneName.trim();
              if (!name) return;
              await farmProfileStore.renameZone(zone.id, name);
              setRenaming(false);
              await onChanged();
            }}
          >
            {msg('common.save')}
          </Button>
          <Button testID={`profile-zone-name-cancel-${zone.id}`} onPress={() => setRenaming(false)}>
            {msg('common.cancel')}
          </Button>
        </View>
      ) : null}

      {zone.piles.map((pile) => (
        <ProfilePileRow key={pile.id} pile={pile} onChanged={onChanged} />
      ))}

      <View style={{ flexDirection: 'row', gap: t.space.xs, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <View style={{ flexBasis: 100, flexGrow: 1 }}>
          <Field label={msg('setup.pileNamePlaceholder')}>
            <TextInput
              testID={`profile-pile-name-${zone.id}`}
              value={pileName}
              onChangeText={setPileName}
              placeholder={msg('setup.pileNamePlaceholder')}
              placeholderTextColor={t.color.inkFaint}
              style={inputStyle(t)}
            />
          </Field>
        </View>
        <View style={{ width: 70 }}>
          <Field label={msg('pile.tare')}>
            <TextInput
              testID={`profile-pile-tare-${zone.id}`}
              value={tareKg}
              onChangeText={setTareKg}
              keyboardType="decimal-pad"
              style={inputStyle(t)}
            />
          </Field>
        </View>
        <View style={{ width: 70 }}>
          <Field label={msg('pile.stdNet')}>
            <TextInput
              testID={`profile-pile-std-${zone.id}`}
              value={stdKg}
              onChangeText={setStdKg}
              keyboardType="decimal-pad"
              style={inputStyle(t)}
            />
          </Field>
        </View>
        <Button testID={`profile-add-pile-${zone.id}`} onPress={addPile} disabled={!pileName.trim()}>
          {msg('farmProfile.addPile')}
        </Button>
      </View>

      {/*
       * `needsReason={false}` everywhere on this screen, and that is the
       * point of the profile being configuration rather than a log: removing
       * a template zone is not a void, because no basket was ever counted
       * into it. Past sales keep their own zones and piles; this only changes
       * what the next sale starts from.
       */}
      <RemoveControl
        testID={`profile-remove-zone-${zone.id}`}
        label={msg('farmProfile.removeZone')}
        detail={msg('farmProfile.removeZoneDetail', { name: zone.name })}
        needsReason={false}
        onRemove={async () => {
          await farmProfileStore.removeZone(zone.id);
          await onChanged();
        }}
      />
    </View>
  );
}

function ProfilePileRow({
  pile,
  onChanged,
}: {
  pile: ProfileZone['piles'][number];
  onChanged: () => Promise<void>;
}) {
  const t = useTheme();
  const msg = useT();
  const [editing, setEditing] = useState(false);

  const save = async ({ name, tareG, stdNetG }: PileEdit) => {
    await farmProfileStore.editPile(pile.id, { name, tareG, stdNetG });
    setEditing(false);
    await onChanged();
  };

  return (
    <View style={{ gap: t.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.xs, flexWrap: 'wrap' }}>
        <Text
          testID={`profile-pile-${pile.id}`}
          style={{
            flexBasis: 140,
            flexGrow: 2,
            paddingTop: 10,
            fontFamily: t.font.family.mono,
            fontSize: t.font.size.micro,
            color: t.color.inkSoft,
          }}
        >
          {msg('setup.pileRow', { name: pile.name, tare: pile.tareG / 1000, std: pile.stdNetG / 1000 })}
        </Text>
        <Button testID={`profile-edit-pile-${pile.id}`} onPress={() => setEditing((v) => !v)}>
          {msg('farmProfile.editPile')}
        </Button>
        <View style={{ flexBasis: 150, flexGrow: 1 }}>
          <RemoveControl
            testID={`profile-remove-pile-${pile.id}`}
            label={msg('farmProfile.removePile')}
            detail={msg('farmProfile.removePileDetail', { name: pile.name })}
            needsReason={false}
            onRemove={async () => {
              await farmProfileStore.removePile(pile.id);
              await onChanged();
            }}
          />
        </View>
      </View>

      {editing ? (
        // The profile has no FR-3.4 lock to respect: nothing has been counted
        // against these weights, so both are always editable here.
        <PileEditor pile={pile} canEditNet onSave={save} onCancel={() => setEditing(false)} />
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: t.font.family.mono,
          fontSize: t.font.size.micro,
          letterSpacing: t.font.tracking.wide,
          color: t.color.inkSoft,
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
    fontFamily: t.font.family.sans,
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
