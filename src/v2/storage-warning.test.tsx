import { act, screen } from '@testing-library/react-native';

import { StorageWarning } from './storage-warning';
import { markNotDurable } from '../store/durability';
import { store as mockStore } from '../store/store';
import { wrap } from '../test/render';

jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));
jest.mock('../store/store', () => {
  const { MemoryStore } = jest.requireActual('../store/memory-store');
  return { store: new MemoryStore() };
});

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/**
 * E01-S03 on v2: a Thai warning on every screen when the event store cannot
 * keep anything — at launch, or the moment storage fails later.
 */
describe('StorageWarning (v2)', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('shows nothing while the store is durable', async () => {
    jest.spyOn(mockStore, 'isDurable').mockResolvedValue(true);
    wrap(<StorageWarning />);
    await flush();
    expect(screen.queryByTestId('storage-warning')).toBeNull();
  });

  it('warns in Thai, as an alert, when the store says it keeps nothing', async () => {
    jest.spyOn(mockStore, 'isDurable').mockResolvedValue(false);
    wrap(<StorageWarning />);
    await flush();
    const warning = screen.getByTestId('storage-warning');
    expect(warning.props.accessibilityRole).toBe('alert');
    expect(screen.getByText(/ไม่ได้บันทึกถาวร/)).toBeTruthy();
  });

  it('treats not knowing as not safe', async () => {
    jest.spyOn(mockStore, 'isDurable').mockRejectedValue(new Error('blocked'));
    wrap(<StorageWarning />);
    await flush();
    expect(screen.getByTestId('storage-warning')).toBeTruthy();
  });

  it('appears when storage fails after launch', async () => {
    jest.spyOn(mockStore, 'isDurable').mockResolvedValue(true);
    wrap(<StorageWarning />);
    await flush();
    expect(screen.queryByTestId('storage-warning')).toBeNull();
    act(() => markNotDurable(new Error('quota')));
    expect(screen.getByTestId('storage-warning')).toBeTruthy();
  });
});
