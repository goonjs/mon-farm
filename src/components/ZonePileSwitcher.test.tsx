import { fireEvent, render, screen } from '@testing-library/react-native';

import { ZonePileSwitcher } from './ZonePileSwitcher';
import { LogBuilder, setUpSale } from '../core/fixtures';
import { projectSale } from '../core/project';
import { ThemeProvider } from '../theme';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initial="light">{ui}</ThemeProvider>);

describe('ZonePileSwitcher', () => {
  it('lists every zone with its piles, grouped', () => {
    const state = projectSale(setUpSale(new LogBuilder()).build());
    wrap(<ZonePileSwitcher state={state} onPick={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByText(/โซน A/)).toBeTruthy();
    expect(screen.getByText(/โซน B/)).toBeTruthy();
    expect(screen.getByTestId('switcher-pile-p1')).toBeTruthy();
    expect(screen.getByTestId('switcher-pile-p2')).toBeTruthy();
    expect(screen.getByTestId('switcher-pile-p3')).toBeTruthy();
  });

  it('picking a pile reports its id', () => {
    const state = projectSale(setUpSale(new LogBuilder()).build());
    const onPick = jest.fn();
    wrap(<ZonePileSwitcher state={state} onPick={onPick} onClose={jest.fn()} />);

    fireEvent.press(screen.getByTestId('switcher-pile-p2'));
    expect(onPick).toHaveBeenCalledWith('p2');
  });

  it('close calls onClose', () => {
    const state = projectSale(setUpSale(new LogBuilder()).build());
    const onClose = jest.fn();
    wrap(<ZonePileSwitcher state={state} onPick={jest.fn()} onClose={onClose} />);

    fireEvent.press(screen.getByTestId('switcher-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
