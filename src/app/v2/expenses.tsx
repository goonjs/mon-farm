import { ExpensesScreen } from '../../v2/money/expenses-screen';
import { moneyGated } from '../../v2/money/money-gate';

/** /v2/expenses — ค่าใช้จ่ายทั้งหมด (farm mockup 19). */
export default moneyGated(ExpensesScreen);
