import { PrepareBuyerScreen } from '../../../v2/prepare/prepare-screen';
import { moneyGated } from '../../../v2/money/money-gate';

/** /v2/prepare/buyer — นัดคนรับซื้อ (E15-S01 PREP-3): pick the buyer on a full page. */
export default moneyGated(PrepareBuyerScreen);
