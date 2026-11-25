import { DebtsScreen } from '../../v2/money/debts-screens';
import { moneyGated } from '../../v2/money/money-gate';

/** /v2/debts — บัญชีหนี้คนงาน. */
export default moneyGated(DebtsScreen);
