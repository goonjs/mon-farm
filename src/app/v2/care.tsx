import { CareListScreen } from '../../v2/care/care-list-screen';
import { moneyGated } from '../../v2/money/money-gate';

/** /v2/care — การดูแลสวน (E16-S01). */
export default moneyGated(CareListScreen);
