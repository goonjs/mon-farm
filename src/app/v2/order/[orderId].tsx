import { OrderDetailScreen } from '../../../v2/money/order-detail/order-detail-screen';
import { moneyGated } from '../../../v2/money/money-gate';

/** /v2/order/<orderId> — ใบซื้อปุ๋ย: header, items and the "tell later" sheets (E11-S11). */
export default moneyGated(OrderDetailScreen);
