import { BuyerViewScreen } from '../../../../v2/sale/closeout/buyer-view-screen';
import { moneyGated } from '../../../../v2/money/money-gate';

/** /v2/sale/<id>/buyer-view — ให้คนรับซื้อดู (E05-S11 CO-20). */
export default moneyGated(BuyerViewScreen);
