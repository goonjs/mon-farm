import { act, fireEvent, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { DateText } from './DateText';
import { wrap } from '../test/render';

const ts = Date.UTC(2026, 9, 9, 5); // 9 Oct 2026, Bangkok

// React Native has no localStorage; the preference reads it when present (web).
const store = new Map<string, string>();
beforeAll(() => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
});
afterAll(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('DateText (D-74 F14)', () => {
  beforeEach(() => store.clear());

  it('shows the Buddhist Era by default', () => {
    wrap(<DateText ts={ts} testID="d" />);
    expect(screen.getByTestId('d')).toHaveTextContent('9 ต.ค. 2569');
  });

  it('tapping any date switches every date in the app, and remembers it', () => {
    wrap(
      <View>
        <DateText ts={ts} testID="a" />
        <DateText ts={ts} testID="b" />
      </View>,
    );
    act(() => fireEvent.press(screen.getByTestId('a')));
    expect(screen.getByTestId('a')).toHaveTextContent('9 ต.ค. 2026');
    expect(screen.getByTestId('b')).toHaveTextContent('9 ต.ค. 2026');
    expect(store.get('mon-farm:era')).toBe('ce');

    act(() => fireEvent.press(screen.getByTestId('b')));
    expect(screen.getByTestId('a')).toHaveTextContent('9 ต.ค. 2569');
  });

  it('says in Thai which era it shows and what a tap does', () => {
    wrap(<DateText ts={ts} testID="d" />);
    expect(screen.getByTestId('d').props.accessibilityLabel).toBe('9 ต.ค. 2569 (พ.ศ.) แตะเพื่อแสดงเป็น ค.ศ.');
  });
});
