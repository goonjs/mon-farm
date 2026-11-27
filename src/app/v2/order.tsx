import { OrderScreen } from '../../v2/money/order/order-screen';
import { moneyGated } from '../../v2/money/money-gate';

/** /v2/order — ใบซื้อ (E11-S11). Params: date, stage, payerId + payerName, amount (a typed total), repeatOf (an orderId). */
export default moneyGated(OrderScreen);
