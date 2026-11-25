import { PayDebtScreen } from '../../v2/money/debt-forms';
import { moneyGated } from '../../v2/money/money-gate';

/** /v2/debt-pay — บันทึกจ่ายคืน (farm mockup 24). */
export default moneyGated(PayDebtScreen);
