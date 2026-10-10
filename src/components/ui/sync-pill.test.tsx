import { screen } from '@testing-library/react-native';

import { SyncPill } from './sync-pill';
import { wrap } from '../../test/render';
import { tokens } from '../../../design/tokens';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const c = tokens.color.light;

describe('SyncPill — icon + word, never colour alone (SYNC-3, NFR-4)', () => {
  it.each([
    ['synced', 0, 'ซิงก์แล้ว', c.acceptSunk, c.statusSynced],
    ['pending', 3, 'รอส่ง 3', c.warnSunk, c.statusPending],
    ['conflict', 1, 'ขัดกัน 1', c.rejectSunk, c.statusConflict],
  ] as const)('%s shows its word, a shape and its signal colours', (state, count, word, bg, fg) => {
    wrap(<SyncPill status={{ state, count }} />);
    const pill = screen.getByTestId('sync-pill');
    expect(pill.props.accessibilityLabel).toBe(`สถานะซิงก์: ${word}`);
    expect(flat(pill.props.style).backgroundColor).toBe(bg);
    expect(flat(screen.getByText(word).props.style)).toMatchObject({ color: fg, fontFamily: tokens.font.family.sans });
    expect(screen.getByTestId(`sync-shape-${state}`, { includeHiddenElements: true })).toBeTruthy();
  });

  it('speaks English when the locale is English', () => {
    wrap(<SyncPill status={{ state: 'pending', count: 2 }} />, { locale: 'en' });
    expect(screen.getByText('2 pending')).toBeTruthy();
  });
});
