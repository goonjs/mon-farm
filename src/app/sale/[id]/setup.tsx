/**
 * Sale setup — the screen that replaces S17's stub.
 *
 * Everything that must be agreed before the first basket (per the design in
 * docs/ux/mvp-screens.html screen 1, adapted for per-zone contracts): buyer
 * and people, the agreed price, a sale-level default split, and the zones and
 * piles being sold — each zone optionally naming its own worker and
 * percentage, picked from the people list (S16) rather than typed.
 *
 * Parties, price, split and each zone's contract auto-save, debounced —
 * there is no Save button on this screen any more. A round of testing found
 * the explicit-save version genuinely confusing: every save button wrote its
 * event correctly, but gave zero visible feedback, so a working save and a
 * no-op looked identical ("I just saw the save didn't give anything"). The
 * fix isn't a toast someone can miss — it's not making them ask "did that
 * work?" in the first place. Debounced (per `AUTOSAVE_DELAY_MS`, below —
 * shorter on web, longer on native touch keyboards) after the last change to
 * that card, not per-keystroke: typing "ไร่จันทรเซลม" character by character
 * must not append eleven `sale_started` events to an append-only log.
 * `useAutoSaveStatus`-style `pending`/`saved` state per card is the
 * replacement for the old "saved" badge, shown continuously rather than
 * only after a tap. Re-saving parties/price/split still appends another
 * `sys` event rather than mutating one — the projection takes the latest,
 * and the earlier one stays in the log as a record that it was changed, the
 * same "last write wins, nothing is silently overwritten" pattern
 * `tare_confirmed` and `zone_contract_set` already use.
 *
 * "Start counting" stays disabled until FR-8.5's requirement is actually met:
 * a price, and a split resolvable for every zone (its own contract or the
 * sale default), and at least one pile to count into.
 */

import { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Pill, TopBar } from '../../../components/chrome';
import { PeoplePicker } from '../../../components/PeoplePicker';
import { PileEditor, type PileEdit } from '../../../components/PileEditor';
import { RemoveControl } from '../../../components/RemoveControl';
import {
  canEditPileNet,
  canRemoveZone,
  pileNeedsVoidReason,
  zoneNeedsVoidReason,
} from '../../../core/project';
import { newId } from '../../../lib/id';
import { useSale } from '../../../store/SaleProvider';
import { farmProfileStore, type ProfileZone } from '../../../store/farmProfile';
import type { Person } from '../../../store/people';
import { useT } from '../../../i18n';
import { useTheme } from '../../../theme';
import type { Pile, Zone } from '../../../core/types';

export default function SetupScreen() {
  const t = useTheme();
  const msg = useT();
  const router = useRouter();
  const { saleId, state, ready } = useSale();

  // Removed zones and piles (S26) are still in the projection — their history
  // stays readable — but they are not part of the sale being set up, so
  // neither the blocker text nor "start counting" may count them.
  const zones = state.zones.filter((z) => !z.removed);
  const splitResolvable = zones.length > 0 && zones.every((z) => z.contract || state.split);
  const hasPile = state.piles.some((p) => !p.removed);
  const canStart = !!state.price && splitResolvable && hasPile;

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>{msg('counter.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb={msg('setup.title')}
        right={
          // router.back(), not a Link — see the same note on the counter and
          // settlement screens. The list screen this was pushed from is
          // already on the stack; reusing it is what keeps repeated
          // list → setup → list round trips from stacking up hidden screens.
          //
          // Deliberately does NOT flush pending saves: leaving to the list is
          // the abandon path (S17 — "starting a new sale writes no event;
          // leaving the stub loses nothing"), and the split card auto-saves
          // its 50/50 default with no interaction at all, so a completely
          // untouched sale can still have a save pending in its first
          // AUTOSAVE_DELAY_MS. Flushing here would write that default for a
          // sale the operator never touched, and it would then wrongly stop
          // appearing as empty. Only the forward path (start counting) flushes.
          <Button testID="back-to-list" onPress={() => router.back()}>
            {msg('setup.backToList')}
          </Button>
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: t.space.md, gap: t.space.md, flexDirection: 'row', flexWrap: 'wrap' }}
      >
        {/*
         * `ready` gates this entire return, so every card below mounts for
         * the first time only once `useSale()` has finished its async load —
         * each card's `useState(state.x ?? '')` initializer runs exactly once,
         * and this guarantees it runs with real data already in place rather
         * than with the empty pre-load default that a later re-render could
         * never overwrite (useState initializers only run on mount).
         */}
        <View style={{ flexBasis: 320, flexGrow: 1, gap: t.space.md }}>
          <PartiesCard />
          <PriceCard />
          <SplitCard />
        </View>
        <View style={{ flexBasis: 360, flexGrow: 2, gap: t.space.md }}>
          <ZonesCard />
        </View>
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.sm,
          padding: t.space.sm,
          borderTopWidth: t.border.hair,
          borderTopColor: t.color.rule,
        }}
      >
        <Text
          testID="start-blocker"
          style={{ flex: 1, fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}
        >
          {canStart
            ? msg('setup.ready')
            : !state.price
              ? msg('setup.needPrice')
              : zones.length === 0
                ? msg('setup.needZone')
                : !splitResolvable
                  ? msg('setup.needSplit')
                  : msg('setup.needPile')}
        </Text>
        <Button
          testID="start-counting"
          variant="primary"
          disabled={!canStart}
          onPress={() => {
            flushPendingSaves();
            router.replace({ pathname: '/sale/[id]/counter', params: { id: saleId } });
          }}
        >
          {msg('setup.startCounting')}
        </Button>
      </View>
    </View>
  );
}

function PartiesCard() {
  const msg = useT();
  const { state, append } = useSale();
  const p = state.parties;
  const [farmName, setFarmName] = useState(p?.farmName ?? '');
  const [buyer, setBuyer] = useState(p?.buyer ?? '');
  const [manager, setManager] = useState(p?.manager ?? '');
  const [workerLead, setWorkerLead] = useState(p?.workerLead ?? '');
  const [where, setWhere] = useState<'farm' | 'buyer'>(p?.where ?? 'farm');
  const [touched, setTouched] = useState(false);
  const canSave = farmName.trim().length > 0 && buyer.trim().length > 0;

  const status = useAutoSave(
    [farmName, buyer, manager, workerLead, where],
    touched,
    canSave,
    !!p,
    () =>
      append({
        kind: 'sys',
        payload: {
          t: 'sale_started',
          farmName: farmName.trim(),
          buyer: buyer.trim(),
          manager: manager.trim(),
          workerLead: workerLead.trim(),
          where,
        },
      }),
  );

  const dirty = <V,>(setter: (v: V) => void) => (v: V) => {
    setTouched(true);
    setter(v);
  };

  return (
    <Card title={msg('setup.parties')}>
      <LabeledInput testID="farm-name" label={msg('setup.farm')} value={farmName} onChangeText={dirty(setFarmName)} />
      <LabeledInput testID="buyer" label={msg('setup.buyer')} value={buyer} onChangeText={dirty(setBuyer)} />
      <LabeledInput testID="manager" label={msg('setup.manager')} value={manager} onChangeText={dirty(setManager)} />
      <LabeledInput
        testID="worker-lead"
        label={msg('setup.workerLead')}
        value={workerLead}
        onChangeText={dirty(setWorkerLead)}
      />
      <Field label={msg('setup.where')}>
        <Segmented
          options={[
            { value: 'farm' as const, label: msg('setup.atFarm') },
            { value: 'buyer' as const, label: msg('setup.atBuyer') },
          ]}
          value={where}
          onChange={dirty(setWhere)}
        />
      </Field>
      <SaveStatusRow status={status} testID="saved-parties" incompleteHint={msg('setup.partiesHint')} />
    </Card>
  );
}

function PriceCard() {
  const msg = useT();
  const { state, append } = useSale();
  const [baht, setBaht] = useState(state.price ? String(state.price.satangPerKg / 100) : '');
  const [indexRef, setIndexRef] = useState(state.price?.indexRef ?? '');
  const [touched, setTouched] = useState(false);

  const parsed = Number(baht);
  const canSave = Number.isFinite(parsed) && parsed > 0;

  const status = useAutoSave([baht, indexRef], touched, canSave, !!state.price, () =>
    append({
      kind: 'sys',
      payload: { t: 'price_set', satangPerKg: Math.round(parsed * 100), indexRef: indexRef.trim() },
    }),
  );

  return (
    <Card title={msg('setup.price')}>
      <LabeledInput
        testID="price-baht"
        label={msg('setup.bahtPerKg')}
        value={baht}
        onChangeText={(v) => {
          setTouched(true);
          setBaht(v);
        }}
        keyboardType="decimal-pad"
      />
      <LabeledInput
        testID="price-index-ref"
        label={msg('setup.indexRef')}
        value={indexRef}
        onChangeText={(v) => {
          setTouched(true);
          setIndexRef(v);
        }}
      />
      <SaveStatusRow status={status} testID="saved-price" incompleteHint={msg('setup.priceHint')} />
    </Card>
  );
}

function SplitCard() {
  const t = useTheme();
  const msg = useT();
  const { state, append } = useSale();
  const [ownerPct, setOwnerPct] = useState(state.split?.ownerPct ?? 50);
  const [basis, setBasis] = useState<'gross' | 'final'>(state.split?.basis ?? 'gross');
  // 50/50 gross is always a valid split (unlike farm name or price, which
  // have no valid empty/default value) — a sale that has never saved one yet
  // starts "touched" so the default itself auto-saves, rather than needing a
  // decoy click on a control that already visibly shows it as selected.
  const [touched, setTouched] = useState(!state.split);

  const status = useAutoSave([ownerPct, basis], touched, true, !!state.split, () =>
    append({ kind: 'sys', payload: { t: 'split_set', ownerPct, basis } }),
  );

  return (
    <Card title={msg('setup.split')}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, marginBottom: t.space.sm }}>
        {msg('setup.splitNote')}
      </Text>
      <Field label={msg('setup.ownerWorker')}>
        <Segmented
          options={[
            { value: 50, label: '50 / 50' },
            { value: 60, label: '60 / 40' },
            { value: 70, label: '70 / 30' },
          ]}
          value={ownerPct}
          onChange={(v) => {
            setTouched(true);
            setOwnerPct(v);
          }}
        />
      </Field>
      <Field label={msg('setup.appliesTo')}>
        <Segmented
          options={[
            { value: 'gross' as const, label: msg('setup.gross') },
            { value: 'final' as const, label: msg('setup.final') },
          ]}
          value={basis}
          onChange={(v) => {
            setTouched(true);
            setBasis(v);
          }}
        />
      </Field>
      <SaveStatusRow status={status} testID="saved-split" incompleteHint="" />
    </Card>
  );
}

type SaveStatus = 'idle' | 'pending' | 'saved';

/**
 * The real deployment target is native — phone, per CLAUDE.md — so a native
 * build is field use on a touch keyboard, where a shorter debounce risks
 * autosaving mid-word on every pause between taps. Web is the verification
 * surface, not the field surface (see `store.web.ts`), so it can afford the
 * snappier value a developer typing on a real keyboard expects.
 */
const AUTOSAVE_DELAY_MS = Platform.OS === 'web' ? 300 : 600;

/**
 * Every debounce currently waiting to fire, so leaving the screen can write
 * them instead of dropping them.
 *
 * Unmounting cancels a card's timer (that is what the effect's cleanup is
 * for), and both ways off this screen — "start counting" and "← list" —
 * unmount every card at once. An edit made inside the debounce window was
 * therefore discarded silently, and because `canStart` reads the log-derived
 * state rather than the on-screen draft, correcting the price and starting
 * the count in the same breath ran the whole sale at the *old* price with
 * nothing shown to say so. Draining this before navigating is what stops
 * that; the set is module-scoped because only one setup screen is ever
 * mounted, and every entry is removed on fire or unmount.
 */
const pendingSaves = new Set<() => void>();

function flushPendingSaves(): void {
  const fns = [...pendingSaves];
  pendingSaves.clear();
  for (const fire of fns) fire();
}

/**
 * Auto-save, debounced: fires `save` once `AUTOSAVE_DELAY_MS` after the last
 * change to any of `deps`, and only once the card has actually been
 * `touched` — an already-saved card must never re-fire an identical,
 * redundant event just because the screen mounted (`touched` starts false
 * and is set by the caller's own onChange handlers, not by this hook).
 *
 * `status` is derived during render, not tracked as its own piece of state —
 * only `savedKey` (which snapshot was last actually written) is real state,
 * and it is only ever set from inside the timer's callback, a genuine async
 * event. Deriving 'idle'/'pending' synchronously in an effect body instead
 * (the first version of this) is exactly the pattern this repo's ESLint
 * config (`react-hooks/set-state-in-effect`) forbids, for the same reason
 * the counter screen's pile-selection fix and `WeightInput` both use
 * render-time derivation instead of effect-driven state elsewhere in this
 * codebase.
 *
 * `save` is deliberately NOT in the effect's own dependency list: it is a
 * fresh closure every render (it captures the current field values by
 * design), so depending on it would restart the timer on every render
 * regardless of whether anything actually changed — `deps` is the real
 * change signal this debounce exists to watch.
 */
function useAutoSave(
  deps: readonly unknown[],
  touched: boolean,
  canSave: boolean,
  initiallySaved: boolean,
  save: () => void,
): SaveStatus {
  const key = JSON.stringify(deps);
  // Seeded from `initiallySaved`, NOT `canSave` — they answer different
  // questions. `canSave` is "would this be valid to write" (true for the
  // split card even before anything was ever saved, since 50/50 gross is
  // always a valid default); `initiallySaved` is "did loading this sale
  // actually find a saved value here." Conflating them was a real bug: the
  // split card showed "✓ saved" on a brand-new sale that had never written
  // a `split_set` event, purely because its default happened to be valid.
  const [savedKey, setSavedKey] = useState<string | null>(initiallySaved ? key : null);

  useEffect(() => {
    if (!touched || !canSave) return;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      save();
      setSavedKey(key);
    };
    const id = setTimeout(() => {
      pendingSaves.delete(fire);
      fire();
    }, AUTOSAVE_DELAY_MS);
    pendingSaves.add(fire);
    return () => {
      clearTimeout(id);
      pendingSaves.delete(fire);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps`/`key` are the intended change signal; `save` is excluded by design, see the doc comment above.
  }, [...deps, touched, canSave]);

  if (!canSave) return 'idle';
  if (savedKey === key) return 'saved';
  // 'pending' means "a timer is actually scheduled", which requires `touched`
  // — the effect above will not schedule anything without it. Reporting
  // 'pending' on an untouched card was how the split card came to show
  // "saving…" indefinitely for a save that was never coming.
  return touched ? 'pending' : 'idle';
}

/**
 * Replaces the old explicit Save button + "saved" badge. Always mounted (not
 * conditionally shown only on success) so there's never a moment where the
 * card gives no indication of its state — "did that just save?" was the
 * exact confusion this exists to remove.
 */
function SaveStatusRow({ status, testID, incompleteHint }: { status: SaveStatus; testID: string; incompleteHint: string }) {
  const msg = useT();
  if (status === 'saved') {
    return (
      <Pill testID={testID} tone="accept" dot="filled">
        {msg('setup.saved')}
      </Pill>
    );
  }
  if (status === 'pending') {
    return (
      <Pill testID={testID} tone="warn" dot="half">
        {msg('setup.saving')}
      </Pill>
    );
  }
  return incompleteHint ? (
    <Pill testID={testID} tone="neutral" dot="hollow">
      {incompleteHint}
    </Pill>
  ) : null;
}

function ZonesCard() {
  const t = useTheme();
  const msg = useT();
  const { state, append } = useSale();
  const [newZoneName, setNewZoneName] = useState('');
  const liveZones = state.zones.filter((z) => !z.removed);

  const addZone = () => {
    const name = newZoneName.trim();
    if (!name) return;
    append({ kind: 'sys', payload: { t: 'zone_added', zoneId: newId('zone-'), name } });
    setNewZoneName('');
  };

  return (
    <Card title={msg('setup.zonesPiles')}>
      {liveZones.map((zone) => (
        <ZoneEditor key={zone.id} zone={zone} />
      ))}

      {/*
       * The offer applies to a sale that has no zones yet, and stops applying
       * the moment it has one — whether that zone came from the offer or was
       * typed by hand. Re-offering the profile as the sale fills up would
       * mean putting a zone back that was rejected a minute ago, which is the
       * app arguing with a decision the operator already made (S27).
       */}
      {liveZones.length === 0 ? <ProfileOffer /> : null}

      <View style={{ flexDirection: 'row', gap: t.space.xs, marginTop: state.zones.length ? t.space.md : 0 }}>
        <TextInput
          testID="new-zone-name"
          value={newZoneName}
          onChangeText={setNewZoneName}
          placeholder={msg('setup.zoneNamePlaceholder')}
          placeholderTextColor={t.color.inkFaint}
          onSubmitEditing={addZone}
          style={inputStyle(t)}
        />
        <Button testID="add-zone" variant="primary" onPress={addZone} disabled={!newZoneName.trim()}>
          {msg('setup.addZone')}
        </Button>
      </View>
    </Card>
  );
}

/**
 * The farm profile, offered as this sale's starting point (S27).
 *
 * What this is NOT: a second way for a zone to enter a sale. Accepting writes
 * exactly the `zone_added` / `pile_added` events the form below writes, with
 * no field marking them as profile-sourced — for the sale's own record, where
 * a zone was typed from is not a fact about the sale.
 *
 * The draft here is local state and stays local. Editing a tare or rejecting
 * a zone changes what THIS sale gets and nothing else; the stored profile is
 * only ever written on its own screen. That is the story's central rule, and
 * the reason this component never imports a profile mutator.
 */
function ProfileOffer() {
  const t = useTheme();
  const msg = useT();
  const { appendMany } = useSale();
  const [draft, setDraft] = useState<readonly ProfileZone[] | null>(null); // null = still loading

  useEffect(() => {
    let live = true;
    farmProfileStore.get().then((p) => {
      if (live) setDraft(p.zones);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!draft || draft.length === 0) return null;

  // The hand-typed path cannot produce a nameless zone — `addZone` returns
  // early on a blank name and its button is disabled — so the offer must not
  // be able to either. Blanking an offered name and accepting used to write a
  // `zone_added` with an empty name straight into an append-only log, where
  // nothing can take it back out. (QA, 2026-09-03.)
  const acceptable = draft.every((z) => z.name.trim().length > 0);

  const accept = () => {
    if (!acceptable) return;
    appendMany(
      draft.flatMap((zone) => {
        const zoneId = newId('zone-');
        return [
          { kind: 'sys' as const, payload: { t: 'zone_added' as const, zoneId, name: zone.name.trim() } },
          ...zone.piles.map((p) => ({
            kind: 'sys' as const,
            payload: {
              t: 'pile_added' as const,
              pileId: newId('pile-'),
              zoneId,
              name: p.name,
              tareG: p.tareG,
              stdNetG: p.stdNetG,
            },
          })),
        ];
      }),
    );
  };

  const editZoneName = (zoneId: string, name: string) =>
    setDraft((d) => (d ?? []).map((z) => (z.id === zoneId ? { ...z, name } : z)));

  const editPile = (zoneId: string, edit: PileEdit & { id: string }) =>
    setDraft((d) =>
      (d ?? []).map((z) =>
        z.id === zoneId
          ? { ...z, piles: z.piles.map((p) => (p.id === edit.id ? { ...p, ...edit } : p)) }
          : z,
      ),
    );

  return (
    <View
      testID="profile-offer"
      style={{
        borderWidth: t.border.hair,
        borderColor: t.color.ruleStrong,
        borderRadius: t.radius.sm,
        padding: t.space.sm,
        marginBottom: t.space.sm,
        gap: t.space.xs,
        backgroundColor: t.color.surfaceSunk,
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.sans,
          fontWeight: t.font.weight.bold,
          fontSize: t.font.size.small,
          color: t.color.ink,
        }}
      >
        {msg('setup.profileOffer')}
      </Text>
      {/* The no-mutation guarantee, said to the owner rather than only to the
          test suite: an edit here is for today, not for good. */}
      <Text
        testID="offer-hint"
        style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}
      >
        {msg('setup.profileEditHint')}
      </Text>

      {draft.map((zone) => (
        <OfferedZone
          key={zone.id}
          zone={zone}
          onRename={(name) => editZoneName(zone.id, name)}
          onEditPile={(edit) => editPile(zone.id, edit)}
          onReject={() => setDraft((d) => (d ?? []).filter((z) => z.id !== zone.id))}
        />
      ))}

      <Button testID="offer-accept" variant="primary" disabled={!acceptable} onPress={accept}>
        {msg('setup.profileAccept')}
      </Button>
    </View>
  );
}

function OfferedZone({
  zone,
  onRename,
  onEditPile,
  onReject,
}: {
  zone: ProfileZone;
  onRename: (name: string) => void;
  onEditPile: (edit: PileEdit & { id: string }) => void;
  onReject: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const [editingPileId, setEditingPileId] = useState<string | null>(null);

  return (
    <View style={{ gap: t.space.xs, marginTop: t.space.xs }}>
      <View style={{ flexDirection: 'row', gap: t.space.xs, alignItems: 'center' }}>
        <TextInput
          testID={`offer-zone-name-${zone.id}`}
          value={zone.name}
          onChangeText={onRename}
          style={{ ...inputStyle(t), flex: 1 }}
        />
        <Button testID={`offer-reject-${zone.id}`} variant="destructive" onPress={onReject}>
          {msg('setup.profileReject')}
        </Button>
      </View>

      {zone.piles.map((pile) => (
        <View key={pile.id} style={{ gap: t.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.xs, flexWrap: 'wrap' }}>
            <Text
              testID={`offer-pile-${pile.id}`}
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
            <Button
              testID={`offer-edit-pile-${pile.id}`}
              onPress={() => setEditingPileId((v) => (v === pile.id ? null : pile.id))}
            >
              {msg('setup.editPile')}
            </Button>
          </View>
          {editingPileId === pile.id ? (
            // Nothing has been counted against an unaccepted pile, so both
            // weights are editable — the FR-3.4 lock has nothing to lock yet.
            <PileEditor
              pile={pile}
              canEditNet
              onSave={(edit) => {
                onEditPile({ ...edit, id: pile.id });
                setEditingPileId(null);
              }}
              onCancel={() => setEditingPileId(null)}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ZoneEditor({ zone }: { zone: Zone }) {
  const t = useTheme();
  const msg = useT();
  const { state, append } = useSale();
  const piles = state.piles.filter((p) => p.zoneId === zone.id && !p.removed);
  const [renaming, setRenaming] = useState(false);
  const [zoneName, setZoneName] = useState(zone.name);

  const [worker, setWorker] = useState<Person | null>(
    zone.contract ? { id: zone.contract.personId, name: zone.contract.workerName, createdTs: 0, archivedTs: null } : null,
  );
  const [ownerPct, setOwnerPct] = useState(zone.contract?.ownerPct ?? 50);
  const [contractTouched, setContractTouched] = useState(false);

  const contractStatus = useAutoSave(
    [worker?.id ?? null, ownerPct],
    contractTouched,
    !!worker,
    !!zone.contract,
    () => {
      if (!worker) return;
      append({
        kind: 'sys',
        payload: { t: 'zone_contract_set', zoneId: zone.id, personId: worker.id, workerName: worker.name, ownerPct },
      });
    },
  );

  const [pileName, setPileName] = useState('');
  const [tareKg, setTareKg] = useState('2');
  const [stdKg, setStdKg] = useState('50');

  const addPile = () => {
    const name = pileName.trim();
    const tare = Number(tareKg);
    const std = Number(stdKg);
    if (!name || !Number.isFinite(tare) || tare < 0 || !Number.isFinite(std) || std <= 0) return;
    append({
      kind: 'sys',
      payload: {
        t: 'pile_added',
        pileId: newId('pile-'),
        zoneId: zone.id,
        name,
        tareG: Math.round(tare * 1000),
        stdNetG: Math.round(std * 1000),
      },
    });
    setPileName('');
  };

  return (
    <View
      testID={`zone-editor-${zone.id}`}
      style={{
        borderWidth: t.border.hair,
        borderColor: t.color.rule,
        borderRadius: t.radius.sm,
        padding: t.space.sm,
        marginBottom: t.space.sm,
        backgroundColor: t.color.surfaceSunk,
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
        <Button testID={`edit-zone-${zone.id}`} onPress={() => { setZoneName(zone.name); setRenaming(true); }}>
          {msg('setup.editZone')}
        </Button>
      </View>

      {/*
       * A rename is a `zone_edited` event, appended like everything else —
       * and an explicit Save rather than this screen's debounced autosave.
       * The autosave exists for a card being typed into for the first time;
       * this is a deliberate correction of something already agreed, opened
       * on purpose and closed on purpose, and a rename that lands 300 ms
       * after the last keystroke would be indistinguishable from one that
       * did not land at all.
       */}
      {renaming ? (
        <View style={{ flexDirection: 'row', gap: t.space.xs, marginTop: t.space.xs }}>
          <TextInput
            testID={`zone-name-${zone.id}`}
            value={zoneName}
            onChangeText={setZoneName}
            style={{ ...inputStyle(t), flex: 1 }}
          />
          <Button
            testID={`zone-name-save-${zone.id}`}
            variant="primary"
            disabled={!zoneName.trim()}
            onPress={() => {
              const name = zoneName.trim();
              if (!name) return;
              append({ kind: 'sys', payload: { t: 'zone_edited', zoneId: zone.id, name } });
              setRenaming(false);
            }}
          >
            {msg('common.save')}
          </Button>
          <Button testID={`zone-name-cancel-${zone.id}`} onPress={() => setRenaming(false)}>
            {msg('common.cancel')}
          </Button>
        </View>
      ) : null}

      <View style={{ marginTop: t.space.sm }}>
        <Field label={msg('setup.zoneWorker')}>
          <PeoplePicker
            testID={`zone-worker-${zone.id}`}
            value={worker}
            onChange={(v) => {
              setContractTouched(true);
              setWorker(v);
              // Clearing the worker has to be written, not merely reflected on
              // screen: the log is append-only, so an earlier
              // `zone_contract_set` stays authoritative for the payout until
              // something says otherwise. Without this the zone kept paying
              // the old worker while showing none. Written immediately rather
              // than through the debounce — this is one deliberate tap, not
              // typing, so there is nothing to wait for.
              if (!v && zone.contract) {
                append({ kind: 'sys', payload: { t: 'zone_contract_cleared', zoneId: zone.id } });
              }
            }}
          />
        </Field>
        {worker ? (
          <>
            <Field label={msg('setup.ownerPct')}>
              <Segmented
                options={[
                  { value: 50, label: '50 / 50' },
                  { value: 60, label: '60 / 40' },
                  { value: 70, label: '70 / 30' },
                ]}
                value={ownerPct}
                onChange={(v) => {
                  setContractTouched(true);
                  setOwnerPct(v);
                }}
              />
            </Field>
            <SaveStatusRow status={contractStatus} testID={`saved-contract-${zone.id}`} incompleteHint="" />
          </>
        ) : null}
      </View>

      <View style={{ marginTop: t.space.md, gap: t.space.xs }}>
        {piles.map((p) => (
          <PileRow key={p.id} pile={p} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: t.space.xs, marginTop: t.space.sm, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <View style={{ flexBasis: 100, flexGrow: 1 }}>
          <Field label={msg('setup.pileNamePlaceholder')}>
            <TextInput
              testID={`pile-name-${zone.id}`}
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
              testID={`pile-tare-${zone.id}`}
              value={tareKg}
              onChangeText={setTareKg}
              placeholder={msg('setup.tarePlaceholder')}
              placeholderTextColor={t.color.inkFaint}
              keyboardType="decimal-pad"
              style={inputStyle(t)}
            />
          </Field>
        </View>
        <View style={{ width: 70 }}>
          <Field label={msg('pile.stdNet')}>
            <TextInput
              testID={`pile-std-${zone.id}`}
              value={stdKg}
              onChangeText={setStdKg}
              placeholder={msg('setup.stdPlaceholder')}
              placeholderTextColor={t.color.inkFaint}
              keyboardType="decimal-pad"
              style={inputStyle(t)}
            />
          </Field>
        </View>
        <Button testID={`add-pile-${zone.id}`} onPress={addPile} disabled={!pileName.trim()}>
          {msg('setup.addPile')}
        </Button>
      </View>

      {/*
       * S26: no cascade. A zone is removable only once every pile under it
       * has been removed on its own terms — `canRemoveZone` says whether, and
       * the blocked line says why, because a disabled button with no
       * explanation is a dead end rather than an instruction.
       */}
      <View style={{ marginTop: t.space.sm }}>
        <RemoveControl
          testID={`remove-zone-${zone.id}`}
          label={msg('setup.removeZone')}
          detail={msg('setup.removeZoneDetail', { name: zone.name })}
          needsReason={zoneNeedsVoidReason(state, zone.id)}
          blockedReason={canRemoveZone(state, zone.id) ? null : msg('setup.removeZoneBlocked')}
          onRemove={(reason) =>
            append({ kind: 'sys', payload: { t: 'zone_removed', zoneId: zone.id, reason } })
          }
        />
      </View>
    </View>
  );
}

/**
 * One pile, as the setup screen lets it be corrected (S26): its row, an edit
 * form behind a tap, and a remove control that takes the one-tap or the
 * typed-reason path depending on whether this pile has ever counted.
 *
 * The edit form is opened and closed here rather than being always-on,
 * because the common case is reading the row, not rewriting it — and because
 * three always-visible inputs per pile would bury the "+ add pile" row this
 * card mostly exists for.
 */
function PileRow({ pile }: { pile: Pile }) {
  const t = useTheme();
  const msg = useT();
  const { events, state, append } = useSale();
  const [editing, setEditing] = useState(false);

  const save = ({ name, tareG, stdNetG }: PileEdit) => {
    // The guard, at the write path rather than only on the fields: an edit
    // that would move a locked pile's weights is refused here, and the fold
    // in `projectSale` refuses it a second time for anything that reaches the
    // log by another route (FR-3.4).
    const netEditable = canEditPileNet(state, pile.id);
    append({
      kind: 'sys',
      payload: {
        t: 'pile_edited',
        pileId: pile.id,
        name,
        tareG: netEditable ? tareG : pile.tareG,
        stdNetG: netEditable ? stdNetG : pile.stdNetG,
      },
    });
    setEditing(false);
  };

  return (
    <View style={{ gap: t.space.xs }}>
      {/* Top-aligned, not centred: the remove control grows downwards when it
          opens, and centring floated the pile's own name to the middle of a
          tall cell, above the row it names. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.xs, flexWrap: 'wrap' }}>
        <Text
          testID={`pile-${pile.id}`}
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
        <Button testID={`edit-pile-${pile.id}`} onPress={() => setEditing((v) => !v)}>
          {msg('setup.editPile')}
        </Button>
        <View style={{ flexBasis: 150, flexGrow: 1 }}>
          <RemoveControl
            testID={`remove-pile-${pile.id}`}
            label={msg('setup.removePile')}
            detail={msg('setup.removePileDetail', { name: pile.name })}
            // Asked of the log, not of the pile's status: a basket that was
            // counted and later voided still happened, and removing the pile
            // it was counted into is still a void, not a tidy-up.
            needsReason={pileNeedsVoidReason(events, pile.id)}
            onRemove={(reason) =>
              append({ kind: 'sys', payload: { t: 'pile_removed', pileId: pile.id, reason } })
            }
          />
        </View>
      </View>

      {editing ? (
        <PileEditor
          pile={pile}
          canEditNet={canEditPileNet(state, pile.id)}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : null}
    </View>
  );
}

// ── shared bits, local to this screen ───────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        borderWidth: t.border.hair,
        borderColor: t.color.rule,
        borderRadius: t.radius.md,
        backgroundColor: t.color.surfaceRaised,
        padding: t.space.md,
      }}
    >
      <Text
        style={{
          fontFamily: t.font.family.mono,
          fontSize: t.font.size.micro,
          letterSpacing: t.font.tracking.wide,
          color: t.color.inkSoft,
          marginBottom: t.space.sm,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: t.space.sm }}>
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

function LabeledInput({
  testID,
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  testID: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  const t = useTheme();
  return (
    <Field label={label}>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={inputStyle(t)}
      />
    </Field>
  );
}

function Segmented<Value extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (v: Value) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderWidth: t.border.hair, borderColor: t.color.ruleStrong, borderRadius: t.radius.sm, overflow: 'hidden' }}>
      {options.map((opt, i) => {
        const on = opt.value === value;
        return (
          <Text
            key={String(opt.value)}
            testID={`seg-${String(opt.value)}`}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              textAlign: 'center',
              paddingVertical: 8,
              fontFamily: t.font.family.sans,
              fontSize: t.font.size.small,
              fontWeight: on ? t.font.weight.bold : t.font.weight.regular,
              color: on ? t.color.inkInverse : t.color.ink,
              backgroundColor: on ? t.color.action : t.color.surfaceRaised,
              borderLeftWidth: i > 0 ? t.border.hair : 0,
              borderLeftColor: t.color.ruleStrong,
            }}
          >
            {opt.label}
          </Text>
        );
      })}
    </View>
  );
}
