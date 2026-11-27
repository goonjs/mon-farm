import { CloseoutCashScreen } from '../../../../v2/sale/closeout/cash-screen';
import { moneyGated } from '../../../../v2/money/money-gate';

/** /v2/sale/<id>/cash — จัดเงินสดกับคนรับซื้อยาง (E05-S11 CO-19). */
export default moneyGated(CloseoutCashScreen);
