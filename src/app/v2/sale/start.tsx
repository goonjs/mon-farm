import { useState } from 'react';

import { newId } from '../../../lib/id';
import { SaleProvider } from '../../../store/SaleProvider';
import { StartSaleScreen } from '../../../v2/sale/start-screen';

/** /v2/sale/start — เริ่มการขาย (sale mockup page 5): a new sale's log, written on "ถัดไป". */
export default function StartSaleRoute() {
  const [id] = useState(() => newId('sale-'));
  return (
    <SaleProvider saleId={id}>
      <StartSaleScreen />
    </SaleProvider>
  );
}
