import { fireEvent, screen, within } from '@testing-library/react-native';

import { IconCatalogScreen } from './icon-catalog-screen';
import { FARMMATE_MASTER_LABEL_TH } from '../../../design/icons/farmmate-masters';
import { FARMMATE_ART_CATEGORIES, FarmMateArt } from '../../ui';
import { wrap } from '../../test/render';

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: () => false };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

/** /v2/dev/icons — dev-only catalogue of every traced FarmMate original (E03-S11). */
describe('IconCatalogScreen', () => {
  it('shows all 72 originals, each drawn from its master and labelled in Thai', () => {
    const { UNSAFE_getAllByType } = wrap(<IconCatalogScreen />);
    const ids = Object.keys(FARMMATE_MASTER_LABEL_TH);
    expect(ids).toHaveLength(72);
    for (const id of ids) {
      expect(screen.getByTestId(`dev-icon-${id}`)).toBeTruthy();
      expect(screen.getByText(id)).toBeTruthy();
    }
    expect(UNSAFE_getAllByType(FarmMateArt).map((a) => a.props.id).sort()).toEqual(ids.sort());
  });

  it('groups them under the nine Thai category headings, eight icons each, each in its own group', () => {
    wrap(<IconCatalogScreen />);
    expect(FARMMATE_ART_CATEGORIES).toHaveLength(9);
    for (const c of FARMMATE_ART_CATEGORIES) {
      const group = screen.getByTestId(`dev-icons-group-${c.key}`);
      expect(within(group).getByText(c.labelTh)).toBeTruthy();
      const cards = within(group).getAllByTestId(/^dev-icon-/).map((n) => String(n.props.testID));
      expect(cards).toHaveLength(8);
      for (const id of cards) expect(id.startsWith(`dev-icon-${c.key}.`)).toBe(true);
    }
  });

  it('says how many icons and that this is not a real menu entry', () => {
    wrap(<IconCatalogScreen />);
    expect(screen.getByText('72 ไอคอน — เครื่องมือสำหรับทีม ไม่อยู่ในเมนูจริง')).toBeTruthy();
  });

  it('Back falls back to /v2 home when there is nothing to pop', () => {
    wrap(<IconCatalogScreen />);
    fireEvent.press(screen.getByTestId('dev-icons-back'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/v2');
  });
});
