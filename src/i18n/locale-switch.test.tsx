import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useI18n, useT } from '.';
import { ShortBasketPanel } from '../components/ShortBasketPanel';
import { wrap } from '../test/render';

/**
 * Two claims the pure resolver tests cannot make, because both are about a
 * live React tree rather than about a string:
 *
 *   1. a screen renders ONE language — no `ไทย · English` pair survives
 *   2. switching language re-renders labels WITHOUT remounting, so a
 *      half-finished entry is not thrown away
 *
 * The second is the one that matters in the field. Someone typing a short
 * basket's weight at the scale, who taps the wrong thing and lands on the
 * language setting, must not come back to an empty box — that is a weight
 * they now have to ask the buyer to read out again.
 */

describe('a screen renders one language', () => {
  it('shows no ไทย · English pair anywhere in the output', () => {
    wrap(
      <ShortBasketPanel
        tareG={2000}
        stdNetG={50000}
        readingG={43000}
        onChangeReading={jest.fn()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    // The separator only ever joined two languages in this component, so its
    // absence is the assertion. (Where a middle dot separates two DATA values
    // it stays — see the catalogue header — but this panel has none.)
    expect(screen.toJSON()).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain(' · ');
  });

  it('renders Thai by default and English when asked', () => {
    const { unmount } = wrap(
      <ShortBasketPanel
        tareG={2000}
        stdNetG={50000}
        readingG={43000}
        onChangeReading={jest.fn()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByTestId('short-confirm')).toHaveTextContent('บันทึกเข่งนี้');
    unmount();

    wrap(
      <ShortBasketPanel
        tareG={2000}
        stdNetG={50000}
        readingG={43000}
        onChangeReading={jest.fn()}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
      { locale: 'en' },
    );
    expect(screen.getByTestId('short-confirm')).toHaveTextContent('log this basket');
  });
});

/**
 * A stand-in for "a screen with something half-entered on it". Deliberately
 * not one of the real screens: those need a sale, a store and a router, none
 * of which has anything to do with the claim being tested.
 */
function ScreenWithTypedState() {
  const msg = useT();
  const { toggle } = useI18n();
  const [draft, setDraft] = useState('');

  return (
    <View>
      <Text testID="label">{msg('short.log')}</Text>
      <TextInput testID="draft" value={draft} onChangeText={setDraft} />
      <Text testID="switch" onPress={toggle}>
        switch
      </Text>
    </View>
  );
}

describe('switching language', () => {
  it('changes the labels and keeps what was already typed', () => {
    wrap(<ScreenWithTypedState />);

    fireEvent.changeText(screen.getByTestId('draft'), '43.5');
    expect(screen.getByTestId('label')).toHaveTextContent('บันทึกเข่งนี้');

    fireEvent.press(screen.getByTestId('switch'));

    expect(screen.getByTestId('label')).toHaveTextContent('log this basket');
    // The point of the test: a re-render, not a remount.
    expect(screen.getByTestId('draft').props.value).toBe('43.5');
  });
});
