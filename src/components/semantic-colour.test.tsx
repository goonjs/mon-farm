import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemedText } from './themed-text';
import { TopBar } from './chrome';
import { Colors } from '../constants/theme';
import { wrap } from '../test/render';

/**
 * E01-S17: the Expo-template leftovers read semantic roles, and the top bar
 * reads the new app-bar roles. `appBar`/`appBarInk` equal `surface`/`ink` in
 * palette A, so the tokens are swapped for sentinels here — otherwise a
 * TopBar still wired to `surface`/`ink` would pass unnoticed.
 */
jest.mock('../../design/tokens', () => {
  const actual = jest.requireActual('../../design/tokens');
  const mark = (scheme: 'light' | 'dark') => ({
    ...actual.tokens.color[scheme],
    appBar: `sentinel-app-bar-${scheme}`,
    appBarInk: `sentinel-app-bar-ink-${scheme}`,
  });
  return {
    ...actual,
    tokens: { ...actual.tokens, color: { light: mark('light'), dark: mark('dark') } },
  };
});

const { tokens } = jest.requireActual('../../design/tokens');

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('template colours come from semantic roles (E01-S17)', () => {
  it.each(['light', 'dark'] as const)('Colors.%s maps onto the role table', (scheme) => {
    const c = tokens.color[scheme];
    expect(Colors[scheme]).toEqual({
      text: c.ink,
      background: c.surface,
      backgroundElement: c.surfaceSunk,
      backgroundSelected: c.actionSunk,
      textSecondary: c.inkSoft,
      link: c.action,
    });
  });

  it('ThemedText linkPrimary uses the action colour, not Expo blue', () => {
    wrap(<ThemedText type="linkPrimary" testID="link">docs</ThemedText>);
    expect(flat(screen.getByTestId('link').props.style).color).toBe(tokens.color.light.action);
  });

  it.each(['light', 'dark'] as const)('TopBar paints appBar / appBarInk (%s)', (scheme) => {
    wrap(<TopBar crumb="หน้า" right={<Text>r</Text>} />, { scheme });
    const crumb = screen.getByTestId('crumb');
    expect(flat(crumb.props.style).color).toBe(`sentinel-app-bar-ink-${scheme}`);
    expect(flat(screen.getByTestId('top-bar').props.style).backgroundColor).toBe(`sentinel-app-bar-${scheme}`);
  });
});
