import { ExpenseFormScreen } from '../../../v2/money/expense-form-screen';
import { moneyGated } from '../../../v2/money/money-gate';

/** /v2/expense/<id|new> — บันทึกค่าใช้จ่าย (farm mockup 18). */
export default moneyGated(ExpenseFormScreen);
