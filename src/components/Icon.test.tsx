import { screen } from '@testing-library/react-native';

import { Button } from './chrome';
import { Icon } from './Icon';
import { wrap } from '../test/render';

/**
 * E01-S13 AC: every icon that carries meaning has a Thai accessibilityLabel.
 * An icon beside its own text label is decoration and must stay out of the
 * accessibility tree, or a screen reader says the same thing twice.
 */
describe('Icon', () => {
  test('a standalone icon is announced by its Thai label', () => {
    wrap(<Icon name="settings" label="ตั้งค่า" />);
    expect(screen.getByLabelText('ตั้งค่า')).toBeOnTheScreen();
  });

  test('an icon without a label is hidden from accessibility', () => {
    wrap(<Icon name="plus" testID="deco" />);
    const el = screen.getByTestId('deco', { includeHiddenElements: true });
    expect(el.props.accessible).toBe(false);
    expect(el.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  test('a button with an icon is still named by its text alone', () => {
    wrap(<Button testID="b" icon="settings">ตั้งค่า</Button>);
    expect(screen.getByRole('button', { name: 'ตั้งค่า' })).toBeOnTheScreen();
  });
});
