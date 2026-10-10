import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Drawer, MenuItem, MenuSection } from './drawer';
import { wrap } from '../../test/render';
import { tokens } from '../../../design/tokens';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('Drawer — the ☰ menu (v1.1.0 farm screen 1)', () => {
  it('renders nothing while closed', () => {
    wrap(
      <Drawer open={false} onClose={() => {}}>
        <Text>inside</Text>
      </Drawer>,
    );
    expect(screen.queryByText('inside')).toBeNull();
  });

  it('opens as a surface panel over a scrim that closes it', () => {
    const onClose = jest.fn();
    wrap(
      <Drawer open onClose={onClose}>
        <Text>inside</Text>
      </Drawer>,
    );
    expect(screen.getByText('inside')).toBeTruthy();
    expect(flat(screen.getByTestId('drawer-panel').props.style).backgroundColor).toBe(c.surface);
    const scrim = screen.getByTestId('drawer-scrim');
    expect(flat(scrim.props.style)).toMatchObject({ backgroundColor: c.scrim, opacity: tokens.opacity.scrim });
    expect(scrim.props.accessibilityLabel).toBe('ปิดเมนู');
    fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalled();
  });

  it('groups items in titled card sections; an item is a 48pt row', () => {
    const onPress = jest.fn();
    wrap(
      <MenuSection title="เฉพาะเครื่องนี้">
        <MenuItem testID="open-settings" label="ตั้งค่า" onPress={onPress} />
      </MenuSection>,
    );
    expect(flat(screen.getByText('เฉพาะเครื่องนี้').props.style).color).toBe(c.inkSoft);
    const item = screen.getByTestId('open-settings');
    expect(flat(item.props.style).minHeight).toBe(tokens.target.min);
    expect(screen.getByText('ตั้งค่า')).toBeTruthy();
    fireEvent.press(item);
    expect(onPress).toHaveBeenCalled();
  });
});
