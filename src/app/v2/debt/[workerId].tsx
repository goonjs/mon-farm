import { DebtAccountScreen } from '../../../v2/money/debts-screens';
import { moneyGated } from '../../../v2/money/money-gate';

/** /v2/debt/<workerId> — บัญชีหนี้ (farm mockup 22). */
export default moneyGated(DebtAccountScreen);
