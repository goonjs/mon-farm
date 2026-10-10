import { act, fireEvent, screen } from '@testing-library/react-native';

import { DeductionForm } from './DeductionForm';
import { peopleStore as mockStore } from '../store/people';
import { wrap } from '../test/render';

// Same jest.mock pattern as PeoplePicker.test.tsx — see that file's header
// for why the MemoryPeopleStore is built inside the factory.
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

describe('DeductionForm', () => {
  beforeEach(async () => {
    for (const p of await mockStore.list()) await mockStore.remove(p.id);
  });

  it('keeps the add button disabled until a person, an amount, a reason and who agreed are all present', async () => {
    const onAdd = jest.fn();
    await mockStore.create('ประยุทธ', ['tapper']);
    wrap(<DeductionForm onAdd={onAdd} />);
    await flush();

    const addButton = screen.getByTestId('deduction-add');
    expect(addButton.props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('deduction-amount'), '50');
    expect(screen.getByTestId('deduction-add').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('deduction-reason'), 'ค่าปุ๋ย');
    expect(screen.getByTestId('deduction-add').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('deduction-agreed-by'), 'สมชาย');
    // Still disabled — no person picked yet.
    expect(screen.getByTestId('deduction-add').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByTestId(/deduction-person-option-/));
    expect(screen.getByTestId('deduction-add').props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(screen.getByTestId('deduction-add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      satang: 5_000, // ฿50.00
      reason: 'ค่าปุ๋ย',
      agreedBy: 'สมชาย',
    });
  });

  it('does not submit when amount is zero or non-numeric', async () => {
    const onAdd = jest.fn();
    await mockStore.create('ประยุทธ', ['tapper']);
    wrap(<DeductionForm onAdd={onAdd} />);
    await flush();

    fireEvent.press(screen.getByTestId(/deduction-person-option-/));
    fireEvent.changeText(screen.getByTestId('deduction-amount'), '0');
    fireEvent.changeText(screen.getByTestId('deduction-reason'), 'ค่าปุ๋ย');
    fireEvent.changeText(screen.getByTestId('deduction-agreed-by'), 'สมชาย');

    expect(screen.getByTestId('deduction-add').props.accessibilityState?.disabled).toBe(true);
  });
});
