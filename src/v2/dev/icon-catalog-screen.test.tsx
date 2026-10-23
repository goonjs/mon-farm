import { fireEvent, screen } from '@testing-library/react-native';

import { IconCatalogScreen } from './icon-catalog-screen';
import { FARMMATE_ICONS, FARMMATE_ICON_CATEGORY_LABEL_TH } from '../../ui';
import { wrap } from '../../test/render';

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: () => false };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

/** /v2/dev/icons — dev-only catalog of the FarmMate icon pilot batch. */
describe('IconCatalogScreen', () => {
  it('shows every pilot icon, grouped under its Thai category heading', () => {
    wrap(<IconCatalogScreen />);
    for (const label of Object.values(FARMMATE_ICON_CATEGORY_LABEL_TH)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    for (const icon of FARMMATE_ICONS) {
      expect(screen.getByTestId(`dev-icon-${icon.id}`)).toBeTruthy();
      expect(screen.getByText(icon.labelTh)).toBeTruthy();
    }
  });

  it('says how many icons and that this is not a real menu entry', () => {
    wrap(<IconCatalogScreen />);
    expect(screen.getByText(`${FARMMATE_ICONS.length} ไอคอน — เครื่องมือสำหรับทีม ไม่อยู่ในเมนูจริง`)).toBeTruthy();
  });

  it('Back falls back to /v2 home when there is nothing to pop', () => {
    wrap(<IconCatalogScreen />);
    fireEvent.press(screen.getByTestId('dev-icons-back'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2');
  });
});
