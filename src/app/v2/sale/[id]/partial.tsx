import { CounterScreen } from '../../../../v2/sale/counter-screen';

/** /v2/sale/<id>/partial?point= — the recorder with the short-basket sheet open. */
export default function PartialRoute() {
  return <CounterScreen initialSheet="partial" />;
}
