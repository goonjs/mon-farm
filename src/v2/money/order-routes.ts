/** Routes of the shop order (E11-S11). One place so the screens that link to it do not guess. */
import type { Href } from 'expo-router';

/** New order. Optional params: `date`, `stage` ('committed'|'actual'), `payerId`, `payerName` ('none' = not recorded), `amount` (a typed total from the expense form → opens the first item with it). */
export const ORDER_NEW = '/v2/order' as const;

/** An order's detail page: header + items + the three "tell later" buttons. `orderId` of a legacy single expense is its own id. */
export const orderHref = (orderId: string): Href => ({ pathname: '/v2/order/[orderId]', params: { orderId } }) as Href;
