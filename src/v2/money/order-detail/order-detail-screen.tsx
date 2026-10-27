/**
 * ใบซื้อปุ๋ย (E11-S11 FD-0…FD-5): the order's header (total, stage, payer, progress, repeat, "ของมาแล้ว"),
 * one card per item, and the three "tell later" sheets of a fertilizer item.
 * Route /v2/order/[orderId]; a legacy single expense reads as a one-item order under its own id.
 * Every write is `expense_changed` naming the item's head; a failed write is said out loud.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { deliverOrder, groupOrders, missingDetails, orderProgress, patchOrderFields, type DetailKey, type OrderPatchWrite, type OrderView } from '../../../core/finance/fert-order';
import { FERTILIZER_CATEGORY } from '../../../core/finance/fert-order';
import { reasonLabel } from '../../../core/finance/fertilizer';
import type { Expense } from '../../../core/finance/ledger';
import { formatDate, formatSatang } from '../../../core/finance/money';
import type { ExpensePatch, Payer } from '../../../core/finance/types';
import { filterPeople, type MasterState } from '../../../core/master';
import { useFinance, type UseFinance } from '../../../finance/use-finance';
import { useInFlight } from '../../../finance/use-in-flight';
import { useT } from '../../../i18n';
import { useSyncStatus } from '../../../sync/use-sync-status';
import { useTheme } from '../../../theme';
import { AppText, Card, Check, Chip, ScreenHeader } from '../../../ui';
import { useMaster } from '../../farm/pieces';
import { ORDER_NEW } from '../order-routes';
import { EditItemSheet } from './edit-item-sheet';
import { HeaderSheet, type HeaderEdit } from './header-sheet';
import { ItemCard } from './item-card';
import { ConfirmSheet } from './parts';
import { ReasonsSheet } from './reasons-sheet';
import { TappersSheet } from './tappers-sheet';
import { unifyOrder } from './tell';
import { ZonesSheet } from './zones-sheet';

export function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const fin = useFinance();
  const master = useMaster();
  const sync = useSyncStatus();
  const msg = useT();
  const t = useTheme();
  const order = useMemo(() => {
    if (!fin.state) return null;
    const live = groupOrders(fin.state.expenses).find((o) => o.orderId === orderId);
    if (live) return live;
    // Every item deleted: the order still opens, empty, so its items can be restored.
    const gone = deletedOf(fin.state.expenses, orderId);
    if (!gone.length) return null;
    const last = gone[gone.length - 1];
    return { orderId, legacy: !last.orderId, items: [], date: last.date, stage: last.stage, payer: last.payer, shop: '', netSatang: 0, billDiscountSatang: 0, consistent: true } as OrderView;
  }, [fin.state, orderId]);
  if (fin.state && order) return <OrderDetailView order={order} fin={fin} master={master.state} onZoneSaved={master.reload} sync={sync} onBack={leave} onRepeat={() => router.push({ pathname: ORDER_NEW, params: { repeatOf: order.orderId } })} />;
  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('ordd.title')} back={{ label: msg('v2.back'), onPress: leave, testID: 'ordd-back' }} sync={sync} />
      <AppText testID="ordd-empty" variant="bodySm" style={{ padding: t.space.lg }}>{msg(fin.state ? 'ordd.notFound' : 'ordd.loading')}</AppText>
    </View>
  );
}

type Sheet = { kind: DetailKey | 'edit' | 'delItem'; id: string } | 'header' | 'delOrder' | null;

/** The deleted items of one order (a legacy single expense is an order under its own id). */
function deletedOf(expenses: readonly Expense[], orderId: string): Expense[] {
  return expenses.filter((e) => e.deleted && (e.orderId ?? e.id) === orderId).sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function OrderDetailView({
  order,
  fin,
  master,
  onZoneSaved,
  sync,
  onBack,
  onRepeat,
}: {
  order: OrderView;
  fin: Pick<UseFinance, 'events' | 'write' | 'state'>;
  master: MasterState | null;
  onZoneSaved: () => void;
  sync?: ReturnType<typeof useSyncStatus>;
  onBack: () => void;
  onRepeat: () => void;
}) {
  const t = useTheme();
  const msg = useT();
  const inFlight = useInFlight();
  const state = fin.state!;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [failed, setFailed] = useState(false);

  const progress = orderProgress(order);
  const sacks = order.items.reduce((s, e) => s + (e.categoryId === FERTILIZER_CATEGORY ? (e.fertilizer?.sacks ?? e.share?.totalSacks ?? 0) : 0), 0);
  const committed = order.stage === 'committed';
  const reasonName = (id: string) => reasonLabel(id, state.fertOptions);
  const catPct = state.categories.find((c) => c.id === FERTILIZER_CATEGORY)?.workerPct ?? 50;
  const tappers: Payer[] = master ? filterPeople(master.people, 'tapper').map((p) => ({ id: p.id, name: p.name })) : [];
  const open = typeof sheet === 'object' && sheet ? (order.items.find((e) => e.id === sheet.id) ?? null) : null;
  const deleted = deletedOf(state.expenses, order.orderId);
  const kind = typeof sheet === 'object' && sheet ? sheet.kind : null;
  const patchAll = (items: readonly Expense[], patch: ExpensePatch): OrderPatchWrite[] => items.map((e) => ({ id: e.id, baseEventId: e.headEventId, patch }));
  const remove = async (items: readonly Expense[]) => {
    if (await writeAll(patchAll(items, { deleted: true }))) setSheet(null);
  };

  /** One write per item; the first failure stops and is shown, the rest can be retried. */
  const writeAll = async (writes: readonly OrderPatchWrite[]): Promise<boolean> => {
    setFailed(false);
    try {
      for (const w of writes) await fin.write(w.id, w.baseEventId, { t: 'expense_changed', patch: w.patch });
      return true;
    } catch (err) {
      console.error('Fertilizer order could not be stored.', err);
      setFailed(true);
      return false;
    }
  };
  const saveItem = (e: Expense) => (patch: ExpensePatch) => writeAll([{ id: e.id, baseEventId: e.headEventId, patch }]);
  const saveHeader = (n: HeaderEdit) => writeAll(patchOrderFields(order, { date: n.date, stage: n.stage, payer: n.payer, shop: n.shop }));

  const subtitle = order.shop ? msg('ordd.subtitle', { shop: order.shop, date: formatDate(order.date) }) : msg('ordd.subtitleNoShop', { date: formatDate(order.date) });
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.color.surface }}>
      <ScreenHeader title={msg('ordd.title')} subtitle={subtitle} back={{ label: msg('v2.back'), onPress: onBack, testID: 'ordd-back' }} sync={sync} />
      <ScrollView contentContainerStyle={{ padding: t.layout.screenPaddingX, gap: t.space.md, paddingBottom: t.space.xl }}>
        {order.items.length === 0 ? <AppText testID="ordd-all-deleted" variant="bodySm">{msg('ordd.allDeleted')}</AppText> : null}
        {order.items.length > 0 ? (
        <Card testID="ordd-head" style={{ gap: t.space.xs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: t.space.sm }}>
            <AppText variant="bodySm" style={{ flexShrink: 1 }}>{sacks > 0 ? msg('ordd.total', { items: order.items.length, sacks }) : msg('ordd.totalNoSacks', { items: order.items.length })}</AppText>
            <Chip testID="ordd-stage" tone={committed ? 'warn' : order.stage === 'planned' ? 'neutral' : 'accept'} label={msg(`ordd.stage.${order.stage}`)} />
          </View>
          <Text testID="ordd-total" adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.displayLg, fontWeight: t.font.weight.bold, fontVariant: ['tabular-nums'], color: t.color.ink }}>
            {formatSatang(order.netSatang)}
          </Text>
          {!order.consistent ? (
            <View testID="ordd-mismatch" style={{ gap: t.space.xs, backgroundColor: t.color.warnSunk, borderRadius: t.radius.lg, padding: t.space.md }}>
              <AppText style={{ color: t.color.warn, fontWeight: t.font.weight.bold }}>{msg('ordd.mismatch')}</AppText>
              <HeaderLink testID="ordd-mismatch-fix" label={msg('ordd.mismatchFix')} onPress={() => void inFlight.run(async () => void (await writeAll(unifyOrder(order))))} />
            </View>
          ) : null}
          {progress.total > 0 ? (
            <>
              <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: progress.total, now: progress.done }} style={{ height: 8, borderRadius: t.radius.pill, backgroundColor: t.color.surfaceSunk, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: 8, backgroundColor: t.color.accept }} />
              </View>
              <AppText testID="ordd-progress" variant="bodySm">{msg('ordd.progress', { done: progress.done, total: progress.total })}</AppText>
            </>
          ) : null}
          {committed ? (
            <Pressable
              testID="ordd-deliver"
              accessibilityRole="button"
              disabled={inFlight.busy}
              onPress={() => void inFlight.run(async () => void (await writeAll(deliverOrder(order))))}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.space.sm, minHeight: t.target.comfortable, borderRadius: t.radius.pill, backgroundColor: t.color.accept, opacity: inFlight.busy ? 0.6 : 1 }}
            >
              <Check color={t.color.inkInverse} />
              <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyLg, fontWeight: t.font.weight.bold, color: t.color.inkInverse }}>{msg('ordd.deliver')}</Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: t.space.xl }}>
            <HeaderLink testID="ordd-repeat" label={msg('ordd.repeat')} onPress={onRepeat} />
            <HeaderLink testID="ordd-edit-header" label={msg('ordd.editHeader')} onPress={() => setSheet('header')} />
          </View>
        </Card>
        ) : null}
        {failed ? <AppText testID="ordd-failed" style={{ color: t.color.reject }}>{msg('ordd.saveFailed')}</AppText> : null}
        {order.items.map((e) => (
          <ItemCard key={e.id} item={e} missing={missingDetails(e)} reasonName={reasonName} onOpen={(k) => setSheet({ kind: k, id: e.id })} onEdit={() => setSheet({ kind: 'edit', id: e.id })} onConflict={() => router.push({ pathname: '/v2/expense/[id]', params: { id: e.id } })} />
        ))}
        {order.items.length > 0 ? (
          <HeaderLink testID="ordd-delete-order" label={msg('ordd.deleteOrder')} onPress={() => setSheet('delOrder')} />
        ) : null}
        {deleted.length > 0 ? (
          <View testID="ordd-deleted" style={{ gap: t.space.sm }}>
            <AppText variant="label">{msg('ordd.deleted', { n: deleted.length })}</AppText>
            {deleted.map((e) => (
              <Card key={e.id} testID={`ordd-deleted-${e.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText style={{ fontWeight: t.font.weight.bold }}>{e.item}</AppText>
                  <AppText variant="bodySm">{e.amountSatang === null ? '-' : formatSatang(e.amountSatang)}</AppText>
                </View>
                <HeaderLink testID={`ordd-restore-${e.id}`} label={msg('ordd.restore')} onPress={() => void inFlight.run(async () => void (await writeAll(patchAll([e], { deleted: false }))))} />
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {sheet === 'header' ? <HeaderSheet order={order} onSave={saveHeader} onClose={() => setSheet(null)} /> : null}
      {open && kind === 'edit' ? <EditItemSheet key={open.id} item={open} onSave={saveItem(open)} onDelete={() => setSheet({ kind: 'delItem', id: open.id })} onClose={() => setSheet(null)} /> : null}
      {open && kind === 'delItem' ? <ConfirmSheet testID="ordd-delete-item-sheet" title={msg('ordd.deleteItem.title')} body={msg('ordd.deleteItem.body', { item: open.item })} confirmLabel={msg('ordd.deleteItem.yes')} cancelLabel={msg('ordd.deleteNo')} failed={failed ? msg('ordd.saveFailed') : undefined} onConfirm={() => void inFlight.run(() => remove([open]))} onClose={() => setSheet(null)} /> : null}
      {sheet === 'delOrder' ? <ConfirmSheet testID="ordd-delete-order-sheet" title={msg('ordd.deleteOrder.title')} body={msg('ordd.deleteOrder.body', { n: order.items.length })} confirmLabel={msg('ordd.deleteOrder.yes')} cancelLabel={msg('ordd.deleteNo')} failed={failed ? msg('ordd.saveFailed') : undefined} onConfirm={() => void inFlight.run(() => remove(order.items))} onClose={() => setSheet(null)} /> : null}
      {open && typeof sheet === 'object' && sheet && sheet.kind === 'reasons' ? <ReasonsSheet key={open.id} item={open} state={state} fin={fin} onSave={saveItem(open)} onClose={() => setSheet(null)} /> : null}
      {open && typeof sheet === 'object' && sheet && sheet.kind === 'zones' ? <ZonesSheet key={open.id} item={open} master={master} onZoneSaved={onZoneSaved} onSave={saveItem(open)} onClose={() => setSheet(null)} /> : null}
      {open && typeof sheet === 'object' && sheet && sheet.kind === 'tappers' ? <TappersSheet key={open.id} item={open} tappers={tappers} catPct={catPct} onSave={saveItem(open)} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

/** A text link with a ≥ 48 target. */
function HeaderLink({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const t = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={{ minHeight: t.target.min, justifyContent: 'center', flexShrink: 1 }}>
      <Text style={{ fontFamily: t.font.family.sans, fontSize: t.font.size.bodyMd, fontWeight: t.font.weight.bold, color: t.color.action }}>{label}</Text>
    </Pressable>
  );
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/v2/expenses');
}
