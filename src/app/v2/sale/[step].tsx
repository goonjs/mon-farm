import { Redirect } from 'expo-router';

/**
 * /v2/sale/<anything> with no page of its own. The reserved sale-step
 * placeholders are gone — the sale flow is built (`/v2/sale/start`,
 * `/v2/sale/<id>/…`) — so an old or mistyped address lands on the sale list.
 * Kept only because removing a file waits on the owner; nothing links here.
 */
export function generateStaticParams() {
  return [];
}

export default function OldSaleStep() {
  return <Redirect href="/v2/sales" />;
}
