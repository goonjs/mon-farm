import { fireEvent, screen } from '@testing-library/react-native';
import { Modal, Text } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('BottomSheet (E01-S17 X7)', () => {
  it('renders nothing while closed', () => {
    wrap(
      <BottomSheet open={false} onClose={() => {}} title="เปลี่ยนจุด">
        <Text>body</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('body')).toBeNull();
  });

  it('a raised panel with large top corners and a handle, over a scrim that closes it', () => {
    const onClose = jest.fn();
    wrap(
      <BottomSheet open onClose={onClose} title="เปลี่ยนจุด" testID="sheet">
        <Text>body</Text>
      </BottomSheet>,
    );
    expect(flat(screen.getByTestId('sheet-panel').props.style)).toMatchObject({
      backgroundColor: c.surfaceRaised,
      borderTopLeftRadius: tokens.radius.xxl,
      borderTopRightRadius: tokens.radius.xxl,
    });
    expect(flat(screen.getByTestId('sheet-handle', { includeHiddenElements: true }).props.style).backgroundColor).toBe(
      c.rule,
    );
    expect(flat(screen.getByText('เปลี่ยนจุด').props.style)).toMatchObject({ color: c.ink, fontSize: tokens.font.size.headingMd });
    const scrim = screen.getByTestId('sheet-scrim');
    expect(flat(scrim.props.style)).toMatchObject({ backgroundColor: c.scrim, opacity: tokens.opacity.scrim });
    fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('body')).toBeTruthy();
  });
});

describe('BottomSheet is modal (review S1)', () => {
  it('sits in a transparent Modal whose back request (Android back) closes it', () => {
    const onClose = jest.fn();
    wrap(
      <BottomSheet open onClose={onClose} title="เปลี่ยนจุด" testID="sheet">
        <Text>body</Text>
      </BottomSheet>,
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
      <BottomSheet open onClose={onClose} title="เปลี่ยนจุด" testID="sheet">
        <Text>body</Text>
      </BottomSheet>,
    );
    const panel = screen.getByTestId('sheet');
    expect(panel.props.accessibilityViewIsModal).toBe(true);
    expect(panel.props['aria-modal']).toBe(true);
    expect(panel.props.role).toBe('dialog');
    expect(panel.props.accessibilityLabel).toBeTruthy();
  });
});
