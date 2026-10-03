import { screen } from '@testing-library/react-native';

import { DataStateBadge } from './DataStateBadge';
import { FIELD_DATA_STATES } from '../core/field-state';
import { wrap } from '../test/render';
import { tokens } from '../../design/tokens';

describe('DataStateBadge — one badge for all six states (E01-S15, design-system §12.9 item 9)', () => {
  it.each(FIELD_DATA_STATES)('%s shows a word and has a Thai accessibility label — never colour alone', (state) => {
    wrap(<DataStateBadge state={state} />);
    const badge = screen.getByTestId(`data-state-${state}`);
    expect(badge.props.accessibilityLabel).toMatch(/^สถานะข้อมูล: [฀-๿A-Z]/);
    expect(screen.getByTestId(`data-state-${state}-label`).props.children).toBeTruthy();
  });

  it('marks Estimated with ≈ before the word', () => {
    wrap(<DataStateBadge state="estimated" />);
    expect(screen.getByTestId('data-state-estimated-label').props.children).toBe('≈ ประมาณ');
  });

  it('draws the "no value" states with a dashed border, and AI as a chip on the sunk surface', () => {
    wrap(
      <>
        <DataStateBadge state="unknown" />
        <DataStateBadge state="not-recorded" />
        <DataStateBadge state="ai-suggested" />
        <DataStateBadge state="user-provided" />
      </>,
    );
    const style = (id: string) => Object.assign({}, ...[screen.getByTestId(id).props.style].flat());
    const text = (id: string) => Object.assign({}, ...[screen.getByTestId(id).props.style].flat());
    expect(style('data-state-unknown')).toMatchObject({ borderStyle: 'dashed', borderColor: tokens.color.light.ruleStrong });
    expect(text('data-state-unknown-label').color).toBe(tokens.color.light.inkSoft);
    expect(style('data-state-not-recorded').borderStyle).toBe('dashed');
    expect(style('data-state-ai-suggested').backgroundColor).toBe(tokens.color.light.surfaceSunk);
    expect(style('data-state-user-provided').borderStyle).toBeUndefined();
  });
});
