import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { tokens } from '../../design/tokens';
import { CHIP_MIN_WIDTH } from '../ui';
import { ToggleChip } from '../v2/farm/pieces';
import { ChoiceChip } from '../v2/money/pieces';
import { wrap } from '../test/render';

jest.mock('expo-router', () => ({ useRouter: () => ({}), useFocusEffect: () => undefined }));

/**
 * A chip with a short name ("นัด", one letter) is at least 64 wide at every text size (owner,
 * decision page q1 = ค, 2026-11-08): 48 would make it a circle with a word inside, which the owner
 * ruled out on 2026-11-06. Before, the width was only held above M, so short names were 39–47 wide
 * at S and M. e2e `v2-text-size` measures the real build at S, M and L.
 */
const min = tokens.target.min;
const box = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style) as { minWidth?: number; minHeight?: number };

it('CHIP_MIN_WIDTH is 64: wider than a 48 circle', () => {
  expect(CHIP_MIN_WIDTH).toBe(64);
  expect(CHIP_MIN_WIDTH).toBeGreaterThan(min);
});

it('ChoiceChip is at least 64 wide for a one-letter name', () => {
  wrap(<ChoiceChip testID="c" label="ก" onPress={() => undefined} />);
  expect(box('c').minWidth).toBe(CHIP_MIN_WIDTH);
  expect(box('c').minHeight).toBeGreaterThanOrEqual(min);
});

it('ToggleChip is at least 64 wide for a one-letter role', () => {
  wrap(<ToggleChip testID="t" label="ก" on={false} onPress={() => undefined} />);
  expect(box('t').minWidth).toBe(CHIP_MIN_WIDTH);
  expect(box('t').minHeight).toBeGreaterThanOrEqual(min);
});
