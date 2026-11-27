import { PrepareScreen } from '../../../v2/prepare/prepare-screen';
import { moneyGated } from '../../../v2/money/money-gate';

/** /v2/prepare — เตรียมการขาย (E15-S01): the one-page checklist for the next sale. */
export default moneyGated(PrepareScreen);
