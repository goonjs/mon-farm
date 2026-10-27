/**
 * DatePickerSheet (E11-S11 FO-8) — a bottom sheet with quick picks (วันนี้ / เมื่อวาน / 2 วันก่อน) and a month
 * calendar in พ.ศ. (the era setting). No dependency. STUB: the props are the fixed contract; the body is written
 * test-first in `date-picker-sheet.test.tsx`.
 */

export interface DatePickerSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** ISO "YYYY-MM-DD". */
  readonly value: string;
  readonly onChange: (iso: string) => void;
  readonly title?: string;
  /** Days after this ISO date are disabled (e.g. today, for a bought order). Absent = no limit. */
  readonly max?: string;
  readonly testID?: string;
}

export function DatePickerSheet(_props: DatePickerSheetProps): React.ReactNode {
  throw new Error('not implemented');
}
