import { fireEvent, screen } from '@testing-library/react-native';

/**
 * Pick `iso` in the date picker of DateField `testID` (E01-S22): open the field, step months until the day is
 * on screen, tap it, confirm. The picker's cells are `${testID}-picker-day-YYYY-MM-DD`.
 */
export function pickDate(testID: string, iso: string): void {
  fireEvent.press(screen.getByTestId(testID));
  const tid = `${testID}-picker`;
  for (let i = 0; i < 600 && !screen.queryByTestId(`${tid}-day-${iso}`); i++) {
    const shown = screen.getAllByTestId(new RegExp(`^${tid}-day-`))[0].props.testID.slice(`${tid}-day-`.length) as string;
    fireEvent.press(screen.getByTestId(`${tid}-${iso < shown ? 'prev' : 'next'}`));
  }
  fireEvent.press(screen.getByTestId(`${tid}-day-${iso}`));
  fireEvent.press(screen.getByTestId(`${tid}-done`));
}
