import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TopBar } from './top-bar';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('TopBar — the thin counter bar', () => {
  it('shows a string crumb on the app bar in sans', () => {
    wrap(<TopBar crumb="นับตะกร้า" right={<Text>R</Text>} />);
    expect(flat(screen.getByTestId('top-bar').props.style).backgroundColor).toBe(c.appBar);
    expect(flat(screen.getByTestId('crumb').props.style)).toMatchObject({
      color: c.appBarInk,
      fontFamily: tokens.font.family.sans,
    });
    expect(screen.getByText('R')).toBeTruthy();
  });

  it('separates path parts with a drawn chevron, not a glyph', () => {
    wrap(<TopBar crumb={['การขาย', 'นับ']} />);
    expect(screen.getAllByTestId('crumb-sep', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryByText(/▸/)).toBeNull();
  });

  it('a path is read with separators, not run together', () => {
    wrap(<TopBar crumb={['ไร่คุณพ่อ', 'โซน A', 'กอง 1']} />);
    expect(screen.getByTestId('crumb').props.accessibilityLabel).toBe('ไร่คุณพ่อ, โซน A, กอง 1');
  });
});
