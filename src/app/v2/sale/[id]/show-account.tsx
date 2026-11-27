import { ShowAccountScreen } from '../../../../v2/sale/money-screens';
import { moneyGated } from '../../../../v2/money/money-gate';

/** /v2/sale/<id>/show-account — ให้คนรับซื้อยางดูบัญชี. */
export default moneyGated(ShowAccountScreen);
