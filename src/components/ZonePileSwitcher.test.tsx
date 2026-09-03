import { fireEvent, screen } from '@testing-library/react-native';

import { ZonePileSwitcher } from './ZonePileSwitcher';
import { LogBuilder, setUpSale } from '../core/fixtures';
import { projectSale } from '../core/project';
import { wrap } from '../test/render';


describe('ZonePileSwitcher', () => {
  it('lists every zone with its piles, grouped', () => {
    const state = projectSale(setUpSale(new LogBuilder()).build());
    wrap(<ZonePileSwitcher state={state} bulkPileIds={new Set()} onPick={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByText(/โซน A/)).toBeTruthy();
    expect(screen.getByText(/โซน B/)).toBeTruthy();
    expect(screen.getByTestId('switcher-pile-p1')).toBeTruthy();
    expect(screen.getByTestId('switcher-pile-p2')).toBeTruthy();
    expect(screen.getByTestId('switcher-pile-p3')).toBeTruthy();
  });

  it('picking a pile reports its id', () => {
    const state = projectSale(setUpSale(new LogBuilder()).build());
    const onPick = jest.fn();
    wrap(<ZonePileSwitcher state={state} bulkPileIds={new Set()} onPick={onPick} onClose={jest.fn()} />);

    fireEvent.press(screen.getByTestId('switcher-pile-p2'));
    expect(onPick).toHaveBeenCalledWith('p2');
  });

  // S23: a pile whose numbers were entered in bulk has to be distinguishable
  // from an ordinarily-closed one at the point the operator picks a pile.
  it('marks a bulk-entered pile, and only that pile', () => {
    const state = projectSale(setUpSale(new LogBuilder()).build());
    wrap(
      <ZonePileSwitcher
        state={state}
        bulkPileIds={new Set(['p2'])}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('switcher-pile-p2')).toHaveTextContent(/กรอกย้อนหลัง/);
    expect(screen.getByTestId('switcher-pile-p1')).not.toHaveTextContent(/กรอกย้อนหลัง/);
  });

  it('close calls onClose', () => {
    const state = projectSale(setUpSale(new LogBuilder()).build());
    const onClose = jest.fn();
    wrap(<ZonePileSwitcher state={state} bulkPileIds={new Set()} onPick={jest.fn()} onClose={onClose} />);

    fireEvent.press(screen.getByTestId('switcher-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
