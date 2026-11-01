import { FarmMateIcon } from './FarmMateIcon';
import { FARMMATE_ICONS, FARMMATE_ICON_CATEGORY_LABEL_TH, getFarmMateIcon, type FarmMateIconCategory } from './registry';
import { wrap } from '../../test/render';

describe('FarmMate icon registry (nav, farm, sale, finance, people)', () => {
  it('has 40 icons: 8 per category, no duplicate ids', () => {
    expect(FARMMATE_ICONS).toHaveLength(40);
    const byCategory: Record<FarmMateIconCategory, number> = { nav: 0, farm: 0, sale: 0, finance: 0, people: 0 };
    for (const icon of FARMMATE_ICONS) byCategory[icon.category]++;
    expect(byCategory).toEqual({ nav: 8, farm: 8, sale: 8, finance: 8, people: 8 });
    expect(new Set(FARMMATE_ICONS.map((i) => i.id)).size).toBe(40);
  });

  // E05-S11 CO-16 / UI-5: the close-out pages need these. Labels match
  // design/icons/farmmate/manifest.json labelTh.
  it.each([
    ['finance.income', 'รายรับ'],
    ['finance.expense', 'รายจ่าย'],
    ['finance.profitCost', 'กำไร/ต้นทุน'],
    ['finance.summary', 'สรุปการเงิน'],
    ['finance.split50', 'เงินที่ต้องแบ่ง 50%'],
    ['finance.workerPay', 'ค่าตอบแทนคนงาน'],
    ['finance.otherCost', 'ค่าใช้จ่ายอื่นๆ'],
    ['finance.financeReport', 'รายงานการเงิน'],
    ['people.tapper', 'คนกรีดยาง'],
    ['people.manager', 'ผู้จัดการสวน'],
    ['people.buyer', 'ผู้ซื้อ/ลูกค้า'],
    ['people.transporter', 'ผู้ขนส่ง'],
    ['people.contacts', 'รายชื่อผู้ติดต่อ'],
    ['people.commsLog', 'บันทึกการสื่อสาร'],
    ['people.workerInfo', 'ข้อมูลคนงาน'],
    ['people.profitShare', 'แบ่งผลประโยชน์'],
  ] as const)('getFarmMateIcon(%s) is labelled %s', (id, labelTh) => {
    expect(getFarmMateIcon(id)?.labelTh).toBe(labelTh);
  });

  it('labels the finance and people categories in Thai', () => {
    expect(FARMMATE_ICON_CATEGORY_LABEL_TH).toMatchObject({ finance: 'หมวดการเงิน', people: 'หมวดผู้เกี่ยวข้อง' });
  });

  it('every icon has a Thai label and a usage note', () => {
    for (const icon of FARMMATE_ICONS) {
      expect(icon.labelTh.length).toBeGreaterThan(0);
      expect(icon.note.length).toBeGreaterThan(0);
    }
  });

  it('category labels cover every category used by the registry', () => {
    const categories = new Set(FARMMATE_ICONS.map((i) => i.category));
    for (const category of categories) {
      expect(FARMMATE_ICON_CATEGORY_LABEL_TH[category]).toBeTruthy();
    }
  });

  it('getFarmMateIcon finds a known id and misses an unknown one', () => {
    expect(getFarmMateIcon('nav.home')?.labelTh).toBe('หน้าแรก');
    expect(getFarmMateIcon('does.not.exist')).toBeUndefined();
  });

  it.each(FARMMATE_ICONS.map((icon) => [icon.id, icon.labelTh] as const))(
    'renders %s (%s) without crashing, hidden from screen readers',
    (id) => {
      wrap(<FarmMateIcon id={id} />);
    },
  );

  it('an unknown id renders nothing instead of crashing', () => {
    expect(() => wrap(<FarmMateIcon id="nope" />)).not.toThrow();
  });
});
