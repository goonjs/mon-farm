import { CloseoutSummaryScreen } from '../../../../v2/sale/closeout/summary-screen';
import { moneyGated } from '../../../../v2/money/money-gate';

/** /v2/sale/<id>/settlement — สรุปจ่ายเงิน (E05-S11). */
export default moneyGated(CloseoutSummaryScreen);
