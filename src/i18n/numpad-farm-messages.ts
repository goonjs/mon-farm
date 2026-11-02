/**
 * E01-S20 strings for the farm screens' number fields. Thai is the source; English is complete.
 * Spread into `messages.ts`. Keys use the prefix `npfarm.` so parallel workers never touch the same file.
 */
export const th = {
  'npfarm.unitRai': 'ไร่',
  'npfarm.unitPct': '%',
  'npfarm.areaAboveZero': 'ต้องมากกว่า 0',
} as const;

export const en: Record<keyof typeof th, string> = {
  'npfarm.unitRai': 'rai',
  'npfarm.unitPct': '%',
  'npfarm.areaAboveZero': 'must be above 0',
};
