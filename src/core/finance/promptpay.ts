/**
 * Receiving accounts (E05-S07): number checks and the PromptPay QR payload,
 * built on the device so it works offline (EMVCo merchant-presented QR as
 * PromptPay uses it). The amount is written from integer satang, never a
 * float, so the QR carries exactly the owner transfer (NFR-3).
 */

export type PromptPayType = 'mobile' | 'nationalId';

export interface PromptPay {
  readonly type: PromptPayType;
  /** Digits only: 10 for a mobile, 13 for a national id. */
  readonly id: string;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 upper-case hex digits — EMVCo tag 63. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

/** The string the QR encodes. `amountSatang` null → a static QR the payer types an amount into. */
export function promptPayPayload(pp: PromptPay, amountSatang: number | null): string {
  const target = pp.type === 'mobile' ? tlv('01', `0066${pp.id.replace(/^0/, '')}`) : tlv('02', pp.id);
  const body =
    tlv('00', '01') +
    tlv('01', amountSatang === null ? '11' : '12') +
    tlv('29', tlv('00', 'A000000677010111') + target) +
    tlv('53', '764') +
    (amountSatang === null ? '' : tlv('54', `${Math.floor(amountSatang / 100)}.${String(amountSatang % 100).padStart(2, '0')}`)) +
    tlv('58', 'TH') +
    '6304';
  return body + crc16(body);
}

export function isThaiMobile(s: string): boolean {
  return /^0\d{9}$/.test(s);
}

/** 13 digits; the last is (11 − Σ dᵢ·(13−i) mod 11) mod 10. */
export function isThaiId(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(s[12]);
}

export function isPromptPayId(pp: PromptPay): boolean {
  return pp.type === 'mobile' ? isThaiMobile(pp.id) : isThaiId(pp.id);
}

/** Thai banks the owner is likely to use, with their account-number length. */
export const BANKS: readonly { readonly code: string; readonly name: string; readonly digits: number }[] = [
  { code: 'KBANK', name: 'กสิกรไทย', digits: 10 },
  { code: 'SCB', name: 'ไทยพาณิชย์', digits: 10 },
  { code: 'BBL', name: 'กรุงเทพ', digits: 10 },
  { code: 'KTB', name: 'กรุงไทย', digits: 10 },
  { code: 'BAY', name: 'กรุงศรีอยุธยา', digits: 10 },
  { code: 'TTB', name: 'ทหารไทยธนชาต', digits: 10 },
  { code: 'GSB', name: 'ออมสิน', digits: 12 },
  { code: 'BAAC', name: 'ธ.ก.ส.', digits: 12 },
];

export function checkAccount(bankCode: string, number: string): boolean {
  const bank = BANKS.find((b) => b.code === bankCode);
  return !!bank && new RegExp(`^\\d{${bank.digits}}$`).test(number);
}
