/**
 * Thai words for an amount, to check a long figure by ear/eye (MoneyField, E11-S11).
 * 115000 satang → "หนึ่งพันหนึ่งร้อยห้าสิบบาทถ้วน"; 115050 → "หนึ่งพันหนึ่งร้อยห้าสิบบาทห้าสิบสตางค์".
 */

const DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
// Place names below ล้าน, from the units place up (the units place has none).
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** One block of up to six digits ("000" … "999999"). `leading` = no higher block exists, so a lone 1 is หนึ่ง, not เอ็ด. */
const block = (digits: string, leading: boolean): string => {
  const n = Number(digits);
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    const d = Number(digits[i]);
    const place = digits.length - 1 - i;
    if (d === 0) continue;
    if (place === 1) out += (d === 1 ? '' : d === 2 ? 'ยี่' : DIGITS[d]) + PLACES[1];
    else if (place === 0) out += d === 1 && !(leading && n === 1) ? 'เอ็ด' : DIGITS[d];
    else out += DIGITS[d] + PLACES[place];
  }
  return out;
};

/** A whole number as words; ล้าน repeats for each million block. */
const integerWords = (n: number): string => {
  if (n === 0) return 'ศูนย์';
  const s = String(n);
  const blocks: string[] = [];
  for (let end = s.length; end > 0; end -= 6) blocks.unshift(s.slice(Math.max(0, end - 6), end));
  return blocks.map((b, i) => block(b, i === 0) + (i < blocks.length - 1 ? 'ล้าน' : '')).join('');
};

export const bahtWords = (satang: number): string => {
  if (!Number.isSafeInteger(satang) || satang < 0) throw new RangeError(`satang must be a non-negative integer: ${satang}`);
  const baht = Math.floor(satang / 100);
  const rest = satang % 100;
  const head = `${integerWords(baht)}บาท`;
  return rest === 0 ? `${head}ถ้วน` : `${head}${integerWords(rest)}สตางค์`;
};
