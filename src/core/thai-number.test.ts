import { describe, expect, it } from 'vitest';

import { thaiNumber } from './thai-number';

/**
 * FR-11.8: Thai numerals are irregular in compounds — ยี่สิบเอ็ด, not
 * สองสิบหนึ่ง — and a count that sounds wrong destroys the trust the spoken
 * count exists to create. These cases are the irregularities by hand, not a
 * sample: ยี่สิบ replacing สองสิบ at every tens place, เอ็ด replacing หนึ่ง in
 * the units place of any multi-digit number, and both carried into ร้อย/พัน.
 */
describe('thaiNumber', () => {
  it('spells the digits 0–9', () => {
    expect(thaiNumber(0)).toBe('ศูนย์');
    expect(thaiNumber(1)).toBe('หนึ่ง');
    expect(thaiNumber(2)).toBe('สอง');
    expect(thaiNumber(3)).toBe('สาม');
    expect(thaiNumber(4)).toBe('สี่');
    expect(thaiNumber(5)).toBe('ห้า');
    expect(thaiNumber(6)).toBe('หก');
    expect(thaiNumber(7)).toBe('เจ็ด');
    expect(thaiNumber(8)).toBe('แปด');
    expect(thaiNumber(9)).toBe('เก้า');
  });

  it('spells the teens, with สิบ alone for 10 and สิบเอ็ด for 11', () => {
    expect(thaiNumber(10)).toBe('สิบ');
    expect(thaiNumber(11)).toBe('สิบเอ็ด');
    expect(thaiNumber(12)).toBe('สิบสอง');
    expect(thaiNumber(15)).toBe('สิบห้า');
    expect(thaiNumber(19)).toBe('สิบเก้า');
  });

  it('uses ยี่สิบ for 20, never สองสิบ', () => {
    expect(thaiNumber(20)).toBe('ยี่สิบ');
    expect(thaiNumber(21)).toBe('ยี่สิบเอ็ด');
    expect(thaiNumber(22)).toBe('ยี่สิบสอง');
    expect(thaiNumber(29)).toBe('ยี่สิบเก้า');
  });

  it('spells the other tens regularly, with เอ็ด for a trailing 1', () => {
    expect(thaiNumber(30)).toBe('สามสิบ');
    expect(thaiNumber(35)).toBe('สามสิบห้า');
    expect(thaiNumber(41)).toBe('สี่สิบเอ็ด');
    expect(thaiNumber(99)).toBe('เก้าสิบเก้า');
  });

  it('spells the hundreds, carrying ยี่สิบ/เอ็ด through', () => {
    expect(thaiNumber(100)).toBe('หนึ่งร้อย');
    expect(thaiNumber(101)).toBe('หนึ่งร้อยเอ็ด');
    expect(thaiNumber(110)).toBe('หนึ่งร้อยสิบ');
    expect(thaiNumber(111)).toBe('หนึ่งร้อยสิบเอ็ด');
    expect(thaiNumber(120)).toBe('หนึ่งร้อยยี่สิบ');
    expect(thaiNumber(121)).toBe('หนึ่งร้อยยี่สิบเอ็ด');
    expect(thaiNumber(200)).toBe('สองร้อย');
    expect(thaiNumber(250)).toBe('สองร้อยห้าสิบ');
    expect(thaiNumber(256)).toBe('สองร้อยห้าสิบหก');
    expect(thaiNumber(999)).toBe('เก้าร้อยเก้าสิบเก้า');
  });

  it('spells into the thousands — a large sale runs well past 100 (FR-11.8)', () => {
    expect(thaiNumber(1000)).toBe('หนึ่งพัน');
    expect(thaiNumber(1001)).toBe('หนึ่งพันเอ็ด');
    expect(thaiNumber(1234)).toBe('หนึ่งพันสองร้อยสามสิบสี่');
  });

  it('rejects anything that is not a real basket count', () => {
    expect(() => thaiNumber(-1)).toThrow();
    expect(() => thaiNumber(1.5)).toThrow();
  });
});
