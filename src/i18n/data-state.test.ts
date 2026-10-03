import { describe, expect, it } from 'vitest';

import { FIELD_DATA_STATES } from '../core/field-state';
import { messages } from './messages';

describe('data-state labels — one place, Thai first (E01-S15, D-20)', () => {
  it('every state has a Thai and an English label', () => {
    for (const s of FIELD_DATA_STATES) {
      expect(messages.th[`dataState.${s}`], s).toBeTruthy();
      expect(messages.en[`dataState.${s}`], s).toBeTruthy();
    }
  });

  it('uses the agreed Thai wording', () => {
    expect(messages.th['dataState.unknown']).toBe('ไม่ทราบ');
    expect(messages.th['dataState.not-recorded']).toBe('ไม่ได้บันทึก');
    expect(messages.th['dataState.estimated']).toBe('ประมาณ');
    expect(messages.th['dataState.ai-suggested']).toBe('AI แนะนำ');
    expect(messages.th['dataState.user-provided']).toBe('ผู้ใช้ใส่');
    expect(messages.th['dataState.system-calculated']).toBe('ระบบคำนวณ');
    expect(messages.th['dataState.estimatedMark']).toBe('≈');
  });
});
