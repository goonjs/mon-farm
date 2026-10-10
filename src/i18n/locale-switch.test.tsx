import { fireEvent, screen } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useI18n, useT } from '.';
import { wrap } from '../test/render';
import { Placeholder } from '../v2/placeholder-screen';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useFocusEffect: () => undefined,
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }),
}));

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
    wrap(<Placeholder titleId="v2.people" />);
    expect(screen.toJSON()).toBeTruthy();
    const out = JSON.stringify(screen.toJSON());
    expect(out).not.toContain(' · ');
    expect(out).toContain('กำลังสร้าง');
    expect(out).not.toContain('under construction');
  });

  it('renders Thai by default and English when asked', () => {
    const { unmount } = wrap(<Placeholder titleId="v2.people" />);
    expect(screen.getByTestId('v2-building')).toHaveTextContent(/กำลังสร้าง/);
    unmount();

    wrap(<Placeholder titleId="v2.people" />, { locale: 'en' });
    expect(screen.getByTestId('v2-building')).toHaveTextContent(/under construction/);
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
