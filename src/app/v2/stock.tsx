import { StockScreen } from '../../v2/care/stock-screen';
import { moneyGated } from '../../v2/money/money-gate';

/** /v2/stock — ปุ๋ยคงเหลือ (E16-S04): the fertilizer stock, the home "stock" module. */
export default moneyGated(StockScreen);
