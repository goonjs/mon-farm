import { CheckScreen } from '../../../../v2/sale/money-screens';
import { moneyGated } from '../../../../v2/money/money-gate';

/** /v2/sale/<id>/check — ตรวจยอดกับคนรับซื้อยาง. */
export default moneyGated(CheckScreen);
