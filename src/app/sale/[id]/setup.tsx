/**
 * Sale setup — the screen that replaces S17's stub.
 *
 * Everything that must be agreed before the first basket (per the design in
 * docs/ux/mvp-screens.html screen 1, adapted for per-zone contracts): buyer
 * and people, the agreed price, a sale-level default split, and the zones and
 * piles being sold — each zone optionally naming its own worker and
 * percentage, picked from the people list (S16) rather than typed.
 *
 * Every save button here writes exactly one event immediately (matching how
 * the counter screen already works — an action is committed the moment it
 * happens, not held in a big unsaved form). Re-saving parties/price/split
 * appends another `sys` event rather than mutating one; the projection takes
 * the latest, and the earlier one stays in the log as a record that it was
 * changed — the same "last write wins, nothing is silently overwritten"
 * pattern `tare_confirmed` and `zone_contract_set` already use.
 *
 * "Start counting" stays disabled until FR-8.5's requirement is actually met:
 * a price, and a split resolvable for every zone (its own contract or the
 * sale default), and at least one pile to count into.
 */

import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button, Pill, TopBar } from '../../../components/chrome';
import { PeoplePicker } from '../../../components/PeoplePicker';
import { newId } from '../../../lib/id';
import { useSale } from '../../../store/SaleProvider';
import type { Person } from '../../../store/people';
import { useTheme } from '../../../theme';
import type { Zone } from '../../../core/types';

export default function SetupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { saleId, state, ready } = useSale();

  const splitResolvable = state.zones.length > 0 && state.zones.every((z) => z.contract || state.split);
  const hasPile = state.piles.length > 0;
  const canStart = !!state.price && splitResolvable && hasPile;

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.color.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: t.font.family.mono, color: t.color.inkSoft }}>กำลังโหลด…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <TopBar
        crumb="ตั้งค่าการขาย · sale setup"
        right={
          // router.back(), not a Link — see the same note on the counter and
          // settlement screens. The list screen this was pushed from is
          // already on the stack; reusing it is what keeps repeated
          // list → setup → list round trips from stacking up hidden screens.
          <Button testID="back-to-list" onPress={() => router.back()}>
            ← รายการ · list
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
            ? 'ทุกอย่างพร้อม · price, split and at least one pile are set'
            : !state.price
              ? 'ยังไม่ได้ตั้งราคา · price not set yet'
              : state.zones.length === 0
                ? 'ยังไม่มีโซน · add a zone'
                : !splitResolvable
                  ? 'บางโซนยังไม่มีส่วนแบ่ง · a zone has no split, and there is no default'
                  : 'ยังไม่มีกอง · add at least one pile'}
        </Text>
        <Button
          testID="start-counting"
          variant="primary"
          disabled={!canStart}
          onPress={() => router.replace({ pathname: '/sale/[id]/counter', params: { id: saleId } })}
        >
          เริ่มนับ — start counting →
        </Button>
      </View>
    </View>
  );
}

function PartiesCard() {
  const { state, append } = useSale();
  const p = state.parties;
  const [farmName, setFarmName] = useState(p?.farmName ?? '');
  const [buyer, setBuyer] = useState(p?.buyer ?? '');
  const [manager, setManager] = useState(p?.manager ?? '');
  const [workerLead, setWorkerLead] = useState(p?.workerLead ?? '');
  const [where, setWhere] = useState<'farm' | 'buyer'>(p?.where ?? 'farm');
  const [saved, setSaved] = useState(!!p);

  const dirty = <V,>(setter: (v: V) => void) => (v: V) => {
    setSaved(false);
    setter(v);
  };

  const canSave = farmName.trim().length > 0 && buyer.trim().length > 0;

  return (
    <Card title="ผู้ซื้อและคน · buyer & people">
      <LabeledInput testID="farm-name" label="ไร่ · farm" value={farmName} onChangeText={dirty(setFarmName)} />
      <LabeledInput testID="buyer" label="ล้ง · buyer" value={buyer} onChangeText={dirty(setBuyer)} />
      <LabeledInput testID="manager" label="ผู้จัดการ · manager" value={manager} onChangeText={dirty(setManager)} />
      <LabeledInput
        testID="worker-lead"
        label="หัวหน้าคนงาน · worker lead"
        value={workerLead}
        onChangeText={dirty(setWorkerLead)}
      />
      <Field label="สถานที่ · where">
        <Segmented
          options={[
            { value: 'farm' as const, label: 'ที่ไร่ · at farm' },
            { value: 'buyer' as const, label: 'ที่ล้ง · at buyer' },
          ]}
          value={where}
          onChange={dirty(setWhere)}
        />
      </Field>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button
          testID="save-parties"
          variant="primary"
          disabled={!canSave}
          onPress={() => {
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
            });
            setSaved(true);
          }}
        >
          บันทึก · save
        </Button>
        {saved ? <SavedBadge testID="saved-parties" /> : null}
      </View>
    </Card>
  );
}

function PriceCard() {
  const { state, append } = useSale();
  const [baht, setBaht] = useState(state.price ? String(state.price.satangPerKg / 100) : '');
  const [indexRef, setIndexRef] = useState(state.price?.indexRef ?? '');
  const [saved, setSaved] = useState(!!state.price);

  const parsed = Number(baht);
  const canSave = Number.isFinite(parsed) && parsed > 0;

  return (
    <Card title="ราคา · agreed price">
      <LabeledInput
        testID="price-baht"
        label="฿ ต่อ กก. · baht per kg"
        value={baht}
        onChangeText={(v) => {
          setSaved(false);
          setBaht(v);
        }}
        keyboardType="decimal-pad"
      />
      <LabeledInput
        testID="price-index-ref"
        label="อ้างอิงราคากลาง · market index reference"
        value={indexRef}
        onChangeText={(v) => {
          setSaved(false);
          setIndexRef(v);
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button
          testID="save-price"
          variant="primary"
          disabled={!canSave}
          onPress={() => {
            append({
              kind: 'sys',
              payload: { t: 'price_set', satangPerKg: Math.round(parsed * 100), indexRef: indexRef.trim() },
            });
            setSaved(true);
          }}
        >
          บันทึก · save
        </Button>
        {saved ? <SavedBadge testID="saved-price" /> : null}
      </View>
    </Card>
  );
}

function SplitCard() {
  const t = useTheme();
  const { state, append } = useSale();
  const [ownerPct, setOwnerPct] = useState(state.split?.ownerPct ?? 50);
  const [basis, setBasis] = useState<'gross' | 'final'>(state.split?.basis ?? 'gross');
  const [saved, setSaved] = useState(!!state.split);

  return (
    <Card title="ส่วนแบ่งเริ่มต้น · default split">
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.small, color: t.color.inkSoft, marginBottom: t.space.sm }}>
        ใช้กับโซนที่ไม่ได้ตั้งคนงานของตัวเอง · applies to any zone with no worker of its own
      </Text>
      <Field label="เจ้าของ / คนงาน · owner / worker">
        <Segmented
          options={[
            { value: 50, label: '50 / 50' },
            { value: 60, label: '60 / 40' },
            { value: 70, label: '70 / 30' },
          ]}
          value={ownerPct}
          onChange={(v) => {
            setSaved(false);
            setOwnerPct(v);
          }}
        />
      </Field>
      <Field label="คิดจาก · applies to">
        <Segmented
          options={[
            { value: 'gross' as const, label: 'ยอดรวม · gross' },
            { value: 'final' as const, label: 'ยอดสุทธิ · final' },
          ]}
          value={basis}
          onChange={(v) => {
            setSaved(false);
            setBasis(v);
          }}
        />
      </Field>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button
          testID="save-split"
          variant="primary"
          onPress={() => {
            append({ kind: 'sys', payload: { t: 'split_set', ownerPct, basis } });
            setSaved(true);
          }}
        >
          บันทึก · save
        </Button>
        {saved ? <SavedBadge testID="saved-split" /> : null}
      </View>
    </Card>
  );
}

function ZonesCard() {
  const t = useTheme();
  const { state, append } = useSale();
  const [newZoneName, setNewZoneName] = useState('');

  const addZone = () => {
    const name = newZoneName.trim();
    if (!name) return;
    append({ kind: 'sys', payload: { t: 'zone_added', zoneId: newId('zone-'), name } });
    setNewZoneName('');
  };

  return (
    <Card title="โซนและกอง · zones & piles">
      {state.zones.map((zone) => (
        <ZoneEditor key={zone.id} zone={zone} />
      ))}

      <View style={{ flexDirection: 'row', gap: t.space.xs, marginTop: state.zones.length ? t.space.md : 0 }}>
        <TextInput
          testID="new-zone-name"
          value={newZoneName}
          onChangeText={setNewZoneName}
          placeholder="ชื่อโซน · zone name"
          placeholderTextColor={t.color.inkFaint}
          onSubmitEditing={addZone}
          style={inputStyle(t)}
        />
        <Button testID="add-zone" variant="primary" onPress={addZone} disabled={!newZoneName.trim()}>
          + เพิ่มโซน · add zone
        </Button>
      </View>
    </Card>
  );
}

function ZoneEditor({ zone }: { zone: Zone }) {
  const t = useTheme();
  const { state, append } = useSale();
  const piles = state.piles.filter((p) => p.zoneId === zone.id);

  const [worker, setWorker] = useState<Person | null>(
    zone.contract ? { id: zone.contract.personId, name: zone.contract.workerName, createdTs: 0, archivedTs: null } : null,
  );
  const [ownerPct, setOwnerPct] = useState(zone.contract?.ownerPct ?? 50);
  const [contractSaved, setContractSaved] = useState(!!zone.contract);

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
      <Text style={{ fontFamily: t.font.family.sans, fontWeight: t.font.weight.bold, fontSize: t.font.size.small, color: t.color.ink }}>
        {zone.name}
      </Text>

      <View style={{ marginTop: t.space.sm }}>
        <Field label="คนงาน · worker (leave unset to use the default split)">
          <PeoplePicker
            testID={`zone-worker-${zone.id}`}
            value={worker}
            onChange={(v) => {
              setContractSaved(false);
              setWorker(v);
            }}
          />
        </Field>
        {worker ? (
          <>
            <Field label="เจ้าของ % · owner %">
              <Segmented
                options={[
                  { value: 50, label: '50 / 50' },
                  { value: 60, label: '60 / 40' },
                  { value: 70, label: '70 / 30' },
                ]}
                value={ownerPct}
                onChange={(v) => {
                  setContractSaved(false);
                  setOwnerPct(v);
                }}
              />
            </Field>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Button
                testID={`save-contract-${zone.id}`}
                variant="primary"
                onPress={() => {
                  append({
                    kind: 'sys',
                    payload: {
                      t: 'zone_contract_set',
                      zoneId: zone.id,
                      personId: worker.id,
                      workerName: worker.name,
                      ownerPct,
                    },
                  });
                  setContractSaved(true);
                }}
              >
                บันทึกสัญญา · save contract
              </Button>
              {contractSaved ? <SavedBadge testID={`saved-contract-${zone.id}`} /> : null}
            </View>
          </>
        ) : null}
      </View>

      <View style={{ marginTop: t.space.md, gap: 2 }}>
        {piles.map((p) => (
          <Text
            key={p.id}
            testID={`pile-${p.id}`}
            style={{ fontFamily: t.font.family.mono, fontSize: t.font.size.micro, color: t.color.inkSoft }}
          >
            {p.name} · ตะกร้า {p.tareG / 1000} + มาตรฐาน {p.stdNetG / 1000} กก.
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: t.space.xs, marginTop: t.space.sm, flexWrap: 'wrap' }}>
        <TextInput
          testID={`pile-name-${zone.id}`}
          value={pileName}
          onChangeText={setPileName}
          placeholder="ชื่อกอง · pile name"
          placeholderTextColor={t.color.inkFaint}
          style={[inputStyle(t), { flexBasis: 100, flexGrow: 1 }]}
        />
        <TextInput
          testID={`pile-tare-${zone.id}`}
          value={tareKg}
          onChangeText={setTareKg}
          placeholder="ตะกร้า กก."
          placeholderTextColor={t.color.inkFaint}
          keyboardType="decimal-pad"
          style={[inputStyle(t), { width: 70 }]}
        />
        <TextInput
          testID={`pile-std-${zone.id}`}
          value={stdKg}
          onChangeText={setStdKg}
          placeholder="มาตรฐาน กก."
          placeholderTextColor={t.color.inkFaint}
          keyboardType="decimal-pad"
          style={[inputStyle(t), { width: 70 }]}
        />
        <Button testID={`add-pile-${zone.id}`} onPress={addPile} disabled={!pileName.trim()}>
          + เพิ่มกอง
        </Button>
      </View>
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

/**
 * Every save button here writes an event immediately and silently — the
 * screen never re-renders around a field to prove it. Without this, a
 * successful save and a no-op look identical, which is exactly what led
 * someone testing the app to conclude the button did nothing. Shown until
 * the form is touched again, so it reads as "this state is saved," not as a
 * toast that could be missed.
 */
function SavedBadge({ testID }: { testID?: string }) {
  return (
    <Pill testID={testID} tone="accept" dot="filled">
      ✓ บันทึกแล้ว · saved
    </Pill>
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
