import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { WeightInput } from './WeightInput';
import { ThemeProvider } from '../theme';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initial="light">{ui}</ThemeProvider>);

describe('WeightInput', () => {
  it('shows the value formatted as kg in the typed field', () => {
    wrap(<WeightInput label="x" valueG={43_000} minG={0} maxG={100_000} onChange={jest.fn()} />);
    expect(screen.getByTestId('weight-input-typed').props.value).toBe('43');
  });

  it('typing a precise value that is not a multiple of the step is not snapped', () => {
    const onChange = jest.fn();
    wrap(<WeightInput label="x" valueG={0} minG={0} maxG={100_000} stepG={500} onChange={onChange} />);
    fireEvent.changeText(screen.getByTestId('weight-input-typed'), '43.2');
    expect(onChange).toHaveBeenCalledWith(43_200); // not rounded to a 500g step
  });

  it('plus and minus nudge by the step', () => {
    const onChange = jest.fn();
    wrap(<WeightInput label="x" valueG={10_000} minG={0} maxG={100_000} stepG={500} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('weight-input-plus'));
    expect(onChange).toHaveBeenCalledWith(10_500);
    fireEvent.press(screen.getByTestId('weight-input-minus'));
    expect(onChange).toHaveBeenCalledWith(9_500);
  });

  it('a controlled re-render after + updates the typed field too, not just onChange', () => {
    // Regression test: `commit()` originally updated the parent (onChange)
    // and its own "don't re-derive from my own change" bookkeeping, but never
    // called setText — so +/− and the drag track silently never reached the
    // visible number, and only the text field's own edits kept themselves in
    // sync. Caught by e2e/short-basket.spec.ts, pinned here so it can't
    // regress silently again.
    function Controlled() {
      const [g, setG] = useState(40_000);
      return <WeightInput label="x" valueG={g} minG={0} maxG={100_000} stepG={500} onChange={setG} />;
    }
    wrap(<Controlled />);
    expect(screen.getByTestId('weight-input-typed').props.value).toBe('40');
    fireEvent.press(screen.getByTestId('weight-input-plus'));
    expect(screen.getByTestId('weight-input-typed').props.value).toBe('40.5');
  });

  it('clamps to the given bounds', () => {
    const onChange = jest.fn();
    wrap(<WeightInput label="x" valueG={100_000} minG={0} maxG={100_000} stepG={500} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('weight-input-plus'));
    expect(onChange).toHaveBeenCalledWith(100_000); // clamped, not 100_500

    fireEvent.changeText(screen.getByTestId('weight-input-typed'), '999');
    expect(onChange).toHaveBeenLastCalledWith(100_000);
  });

  it('the thumb position reflects value within the range', () => {
    wrap(<WeightInput label="x" valueG={50_000} minG={0} maxG={100_000} onChange={jest.fn()} />);
    const thumb = screen.getByTestId('weight-input-thumb');
    expect(thumb.props.style).toEqual(expect.objectContaining({ left: '50%' }));
  });
});
