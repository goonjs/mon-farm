import { act, fireEvent, screen } from '@testing-library/react-native';

import { PeoplePicker } from './PeoplePicker';
import { peopleStore as mockStore } from '../store/people';
import { wrap } from '../test/render';

/**
 * The bare `../store/people` import that `PeoplePicker` uses resolves to a
 * platform adapter (people.web.ts / people.native.ts) that Metro picks at
 * build time. Jest's haste resolver does the same, so the module is mocked
 * directly for this test rather than exercising a real adapter — the
 * adapters themselves are covered by people.test.ts (Vitest, the pure
 * MemoryPeopleStore) and by Playwright once a real screen uses them.
 *
 * The instance is created INSIDE the factory and re-imported afterwards as
 * `peopleStore` — not created in an outer `const` and captured by reference.
 * That ordering matters: `jest.mock` calls are hoisted above every import in
 * the file, including `import { PeoplePicker } from './PeoplePicker'`, and
 * that import is what triggers the factory (via PeoplePicker's own
 * `../store/people` import). An outer `const mockStore = new
 * MemoryPeopleStore()` would still be unassigned at that moment, so the
 * factory would silently capture `undefined`. Building the instance inside
 * the factory sidesteps the ordering problem — the two `require('../store/people-memory')`
 * calls below happen inside the (lazy, memoised-once) factory body, not at
 * module-evaluation time.
 */
jest.mock('../store/people', () => {
  const actual = jest.requireActual('../store/people');
  const { MemoryPeopleStore } = jest.requireActual('../store/people-memory');
  return { ...actual, peopleStore: new MemoryPeopleStore() };
});


async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('PeoplePicker', () => {
  beforeEach(async () => {
    // Same store instance across the whole file (jest.mock's factory only
    // runs once and is memoised), so tests clear it rather than recreate it.
    for (const p of await mockStore.list()) await mockStore.archive(p.id);
  });

  it('shows nobody selected and an empty list initially', async () => {
    const onChange = jest.fn();
    wrap(<PeoplePicker value={null} onChange={onChange} />);
    await flush();
    expect(screen.getByText(/ยังไม่มีรายชื่อ/)).toBeTruthy();
  });

  it('lists an existing person and selecting them calls onChange', async () => {
    const p = await mockStore.create('ประยุทธ');
    const onChange = jest.fn();
    wrap(<PeoplePicker value={null} onChange={onChange} />);
    await flush();

    fireEvent.press(screen.getByTestId(`people-picker-option-${p.id}`));
    expect(onChange).toHaveBeenCalledWith(p);
  });

  it('typing a new name and confirming creates the person and selects them', async () => {
    const onChange = jest.fn();
    wrap(<PeoplePicker value={null} onChange={onChange} />);
    await flush();

    fireEvent.press(screen.getByTestId('people-picker-add'));
    fireEvent.changeText(screen.getByTestId('people-picker-new-name'), 'สมหญิง');
    await act(async () => {
      fireEvent.press(screen.getByTestId('people-picker-confirm-new'));
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const created = onChange.mock.calls[0][0];
    expect(created.name).toBe('สมหญิง');

    const listed = await mockStore.list();
    expect(listed.some((p) => p.id === created.id)).toBe(true);
  });

  it('shows the selected person and "change" clears the selection', async () => {
    const p = await mockStore.create('มานพ');
    const onChange = jest.fn();
    wrap(<PeoplePicker value={p} onChange={onChange} />);
    await flush();

    // The selected-row container also wraps the "change" button, so its full
    // text content includes both — check the name is present rather than an
    // exact match.
    expect(screen.getByTestId('people-picker-selected').props.children).toBeTruthy();
    expect(screen.getByText('มานพ')).toBeTruthy();
    fireEvent.press(screen.getByTestId('people-picker-change'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
