import { describe, expect, it } from 'vitest';

import { BANKS, checkAccount, crc16, isThaiId, isThaiMobile, promptPayPayload } from './promptpay';

describe('CRC-16/CCITT-FALSE (EMVCo tag 63)', () => {
  it('matches the standard check value', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('PromptPay payload (EMVCo merchant-presented QR)', () => {
  // Published vectors: pkg.go.dev/github.com/ultramcu/go-promptpay examples (checked 2026-10-09).
  it('mobile, no amount → static QR (published vector)', () => {
    expect(promptPayPayload({ type: 'mobile', id: '0812345678' }, null)).toBe(
      '00020101021129370016A0000006770101110113006681234567853037645802TH6304823E',
    );
  });

  it('mobile, 100.50 baht → dynamic QR (published vector)', () => {
    expect(promptPayPayload({ type: 'mobile', id: '0812345678' }, 10050)).toBe(
      '00020101021229370016A0000006770101110113006681234567853037645406100.505802TH6304FFE3',
    );
  });

  it('carries the exact baht.satang from integer satang', () => {
    const p = promptPayPayload({ type: 'mobile', id: '0812345678' }, 286025);
    expect(p.startsWith('000201010212')).toBe(true);
    expect(p).toContain('5407' + '2860.25');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it('national id uses sub-tag 02 with the 13 digits', () => {
    const p = promptPayPayload({ type: 'nationalId', id: '1101700207030' }, null);
    expect(p).toContain('0016A00000067701011102131101700207030');
  });
});

describe('number checks', () => {
  it('Thai national id checksum', () => {
    expect(isThaiId('1101700207030')).toBe(true);
    expect(isThaiId('1101700207031')).toBe(false);
    expect(isThaiId('110170020703')).toBe(false);
  });

  it('mobile: 10 digits starting with 0', () => {
    expect(isThaiMobile('0812345678')).toBe(true);
    expect(isThaiMobile('812345678')).toBe(false);
    expect(isThaiMobile('08123456789')).toBe(false);
  });

  it('account number length per bank', () => {
    expect(BANKS.find((b) => b.code === 'KBANK')?.digits).toBe(10);
    expect(checkAccount('KBANK', '1234567890')).toBe(true);
    expect(checkAccount('KBANK', '123456789')).toBe(false);
    expect(checkAccount('GSB', '123456789012')).toBe(true);
    expect(checkAccount('KBANK', '12345-67890')).toBe(false);
  });
});
