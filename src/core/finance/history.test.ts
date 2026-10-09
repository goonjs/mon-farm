import { describe, expect, it } from 'vitest';

import { LogBuilder, setUpSale, workedExample } from '../fixtures';
import { projectSale } from '../project';
import { saleHistory, summarizeSale } from './history';

describe('sale history (E05-S06)', () => {
  it('a row carries buyer, kg, baskets, amount and status from the log', () => {
    const events = workedExample('s-1');
    const row = summarizeSale(events, projectSale(events, 's-1'));
    expect(row).toMatchObject({
      saleId: 's-1',
      buyer: 'ล้งเจริญทรัพย์',
      farmName: 'ไร่คุณพ่อ',
      netG: 11_273_000,
      grossSatang: 29_873_450,
      satangPerKg: 2650,
      status: 'closed',
      deleted: false,
    });
    expect(row.baskets).toBeGreaterThan(0);
  });

  it('a sale with no price shows no amount instead of a guessed one', () => {
    const b = new LogBuilder('s-2');
    b.sys({ t: 'sale_started', farmName: 'ไร่', buyer: 'ล้ง', manager: '', workerLead: '', where: 'farm' });
    const events = b.build();
    expect(summarizeSale(events, projectSale(events, 's-2')).grossSatang).toBeNull();
  });

  it('history hides deleted sales from the list and totals, newest first', () => {
    const a = workedExample('s-a');
    const gone = setUpSale(new LogBuilder('s-b')).remove('s-b').build();
    const rows = saleHistory([
      { id: 's-a', events: a },
      { id: 's-b', events: gone },
    ]);
    expect(rows.visible.map((r) => r.saleId)).toEqual(['s-a']);
    expect(rows.deletedCount).toBe(1);
    expect(rows.totalSatang).toBe(29_873_450);
    expect(rows.totalNetG).toBe(11_273_000);
  });
});
