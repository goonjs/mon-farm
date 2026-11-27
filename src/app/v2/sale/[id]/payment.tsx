import { CloseoutPayScreen } from '../../../../v2/sale/closeout/pay-screen';
import { moneyGated } from '../../../../v2/money/money-gate';

/** /v2/sale/<id>/payment — จ่ายเงิน · ปิดการขาย (E05-S11 CO-10). */
export default moneyGated(CloseoutPayScreen);
