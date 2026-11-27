import { FertilizingScreen } from '../../v2/care/fertilizing/fertilizing-screen';
import { moneyGated } from '../../v2/money/money-gate';

/** /v2/fertilizing — ใส่ปุ๋ย (E16-S02/S03). Params: id (edit a saved one), fromOrder (start with that order's fertilizer). */
export default moneyGated(FertilizingScreen);
