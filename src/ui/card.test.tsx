import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card, CardLabel, cardStyle } from './card';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';
import { useTheme } from '../theme';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('Card — the v1.1.0 raised card', () => {
  it('cardStyle is a raised surface with a faint hairline and lg radius', () => {
    let style: object = {};
    function Probe() {
      style = cardStyle(useTheme());
      return null;
    }
    wrap(<Probe />);
    expect(style).toMatchObject({
      backgroundColor: c.surfaceRaised,
      borderColor: c.ruleFaint,
      borderWidth: tokens.border.hair,
      borderRadius: tokens.radius.lg,
    });
  });

  it('Card wraps children in that style', () => {
    wrap(
      <Card testID="card">
        <Text>inside</Text>
      </Card>,
    );
    expect(flat(screen.getByTestId('card').props.style)).toMatchObject({ backgroundColor: c.surfaceRaised });
    expect(screen.getByText('inside')).toBeTruthy();
  });

  it('CardLabel is a soft sans heading, never mono', () => {
    wrap(<CardLabel>ยอดขาย</CardLabel>);
    expect(flat(screen.getByText('ยอดขาย').props.style)).toMatchObject({
      color: c.inkSoft,
      fontFamily: tokens.font.family.sans,
    });
  });
});
