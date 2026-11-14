/** Routes of fertilizing (E16). One place so the screens that link to it do not guess. */
import type { Href } from 'expo-router';

/** New fertilizing. Optional `fromOrder` (an orderId): that order's cards start chosen ("ใส่ปุ๋ยจากใบนี้", E11-S17 RM-1). */
export const FERTILIZING_NEW = '/v2/fertilizing' as const;
export const fertilizingNewFrom = (orderId: string): Href => ({ pathname: FERTILIZING_NEW, params: { fromOrder: orderId } }) as Href;
/** One saved fertilizing, to edit (GC-3). */
export const fertilizingHref = (id: string): Href => ({ pathname: FERTILIZING_NEW, params: { id } }) as Href;
/** Where orders not yet received are listed ("สั่งไว้ ยังไม่ได้ของ ›", FZ-4). */
export const ORDER_LIST = '/v2/expenses' as const;
