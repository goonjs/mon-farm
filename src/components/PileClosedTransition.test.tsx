import { fireEvent, screen } from '@testing-library/react-native';

import { PileClosedTransition } from './PileClosedTransition';
import { wrap } from '../test/render';


const baseProps = {
  pileName: 'กอง 1',
  baskets: 12,
  netG: 480_000,
  hasNextPileInZone: true,
  noPileStillCounting: true,
  onNextPile: jest.fn(),
  onSwitchZone: jest.fn(),
  onCloseZone: jest.fn(),
  onCloseSale: jest.fn(),
};

describe('PileClosedTransition', () => {
  it('shows the closed pile total', () => {
    wrap(<PileClosedTransition {...baseProps} />);
    const text = screen.getByTestId('pile-closed-total').props.children;
    expect(text).toContain('กอง 1');
    expect(text).toContain('12');
  });

  it('offers "next pile" only when another pile in the zone is waiting', () => {
    wrap(<PileClosedTransition {...baseProps} hasNextPileInZone={false} />);
    expect(screen.queryByTestId('decision-next-pile')).toBeNull();
  });

  it('withholds "close sale" while any pile in the sale is still counting', () => {
    wrap(<PileClosedTransition {...baseProps} noPileStillCounting={false} />);

    // The operator's real next step is another pile, not the sale.
    expect(screen.queryByTestId('decision-close-sale')).toBeNull();
    expect(screen.getByTestId('decision-switch-zone')).toBeTruthy();
    expect(screen.getByTestId('decision-close-zone')).toBeTruthy();
  });

  it('offers "close sale" once nothing anywhere is still counting', () => {
    wrap(<PileClosedTransition {...baseProps} noPileStillCounting />);
    expect(screen.getByTestId('decision-close-sale')).toBeTruthy();
  });

  it('names all four options as one-tap buttons, not a single continue', () => {
    const onNextPile = jest.fn();
    const onSwitchZone = jest.fn();
    const onCloseZone = jest.fn();
    const onCloseSale = jest.fn();
    wrap(
      <PileClosedTransition
        {...baseProps}
        onNextPile={onNextPile}
        onSwitchZone={onSwitchZone}
        onCloseZone={onCloseZone}
        onCloseSale={onCloseSale}
      />,
    );

    fireEvent.press(screen.getByTestId('decision-next-pile'));
    expect(onNextPile).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('decision-switch-zone'));
    expect(onSwitchZone).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('decision-close-zone'));
    expect(onCloseZone).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('decision-close-sale'));
    expect(onCloseSale).toHaveBeenCalled();
  });
});
