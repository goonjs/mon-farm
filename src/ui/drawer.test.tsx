import { fireEvent, screen } from '@testing-library/react-native';
import { Modal, Text, View } from 'react-native';

import { Drawer, MenuItem, MenuSection } from './drawer';
import { FactRow, IconTile } from './icon-tile';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

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

describe('MenuItem — mockup rows: icon tile + value + one fact per line (review S6, D-70)', () => {
  it('takes a leading IconTile and several FactRow lines under the label', () => {
    const onPress = jest.fn();
    wrap(
      <MenuItem
        testID="row-farm"
        label="ข้อมูลฟาร์ม"
        leading={<IconTile testID="row-tile" tone="accept" icon={(colour) => <View style={{ backgroundColor: colour }} />} />}
        onPress={onPress}
      >
        <FactRow>สวนและจุดชั่ง</FactRow>
        <FactRow>คน · คนรับซื้อยาง</FactRow>
        <FactRow>บัญชีรับเงิน</FactRow>
      </MenuItem>,
    );
    const row = screen.getByTestId('row-farm');
    expect(flat(row.props.style).minHeight).toBe(tokens.target.min);
    expect(screen.getByTestId('row-tile', { includeHiddenElements: true })).toBeTruthy();
    for (const fact of ['สวนและจุดชั่ง', 'คน · คนรับซื้อยาง', 'บัญชีรับเงิน']) {
      expect(flat(screen.getByText(fact).props.style).color).toBe(c.inkSoft);
    }
    expect(flat(screen.getByText('ข้อมูลฟาร์ม').props.style).color).toBe(c.ink);
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });

  it('takes a trailing badge between the text and the chevron (mockup 4, 8: ขัดกัน, ใช้ล่าสุด)', () => {
    wrap(<MenuItem testID="row" label="คนรับซื้อยาง ก" trailing={<Text testID="row-badge">ใช้ล่าสุด</Text>} />);
    expect(screen.getByTestId('row-badge')).toBeTruthy();
  });

  it('still renders the plain label + detail row', () => {
    wrap(<MenuItem testID="row" label="เครื่องนี้" detail="ขนาดตัวอักษร" />);
    expect(screen.getByText('ขนาดตัวอักษร')).toBeTruthy();
  });
});

describe('Drawer is modal (review S1)', () => {
  it('sits in a transparent Modal whose back request (Android back) closes it', () => {
    const onClose = jest.fn();
    wrap(
      <Drawer open onClose={onClose}>
        <Text>inside</Text>
      </Drawer>,
    );
    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.visible).toBe(true);
    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalled();
  });

  it('the overlay is a modal dialog that takes focus and hides what is behind', () => {
    const onClose = jest.fn();
    wrap(
      <Drawer open onClose={onClose}>
        <Text>inside</Text>
      </Drawer>,
    );
    const panel = screen.getByTestId('drawer');
    expect(panel.props.accessibilityViewIsModal).toBe(true);
    expect(panel.props['aria-modal']).toBe(true);
    expect(panel.props.role).toBe('dialog');
    expect(panel.props.accessibilityLabel).toBeTruthy();
  });
});
