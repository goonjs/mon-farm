import { fireEvent, screen } from '@testing-library/react-native';

import { NewProductSheet } from './item-sheets';
import { ShopSheet } from './order-sheets';
import { expectChoiceTile } from '../../../test/choice-shape';
import { wrap } from '../../../test/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));

/** E01-S25 CT-7: the order's own picks are A tiles (owner r2-cc-form: "ใบซื้อใช้ A"). */
describe('order sheets use style A', () => {
  it('shop and who ordered: A tiles, picking another switches at once', () => {
    const onChange = jest.fn();
    wrap(<ShopSheet shop="ร้านบ้านนา" orderedBy="สมชาย" recentShops={['ร้านบ้านนา', 'ร้านเกษตร']} recentPeople={['สมชาย', 'สมหญิง']} onChange={onChange} onClose={() => {}} />);
    for (const id of ['ordc-shop-opt-ร้านบ้านนา', 'ordc-shop-opt-ร้านเกษตร', 'ordc-by-opt-สมชาย', 'ordc-by-opt-สมหญิง']) expectChoiceTile(screen.getByTestId(id), 'fill');
    expect(screen.getByTestId('ordc-shop-opt-ร้านบ้านนา').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('ordc-shop-opt-ร้านเกษตร'));
    expect(onChange).toHaveBeenLastCalledWith({ shop: 'ร้านเกษตร' });
    fireEvent.press(screen.getByTestId('ordc-by-opt-สมหญิง'));
    expect(onChange).toHaveBeenLastCalledWith({ orderedBy: 'สมหญิง' });
  });

  it('brand: A tiles', () => {
    wrap(
      <NewProductSheet
        options={[{ id: 'b1', kind: 'brand', name: 'ตราใบไม้', description: '', hidden: false }]}
        initial={{ type: 'chemical', formula: '', brand: '', sackKg: 50 }}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    expectChoiceTile(screen.getByTestId('ordc-brand-opt-ตราใบไม้'), 'fill');
    expect(screen.getByTestId('ordc-kg-50').props.accessibilityState).toMatchObject({ selected: true });
  });
});
