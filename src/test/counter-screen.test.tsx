import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import CounterScreen from '../app/sale/[id]/counter';
import { LogBuilder, readyPile, setUpSale } from '../core/fixtures';
import type { SaleEvent } from '../core/types';
import { SpeechProvider } from '../speech';
import { SaleProvider } from '../store/SaleProvider';
import { store } from '../store/store';
import { wrap } from './render';

/**
 * The counter screen at the component tier (S22).
 *
 * Lives here rather than beside the screen: everything under `src/app/` is a
 * ROUTE to expo-router, and a `counter.test.tsx` sitting next to
 * `counter.tsx` is exported as a real `/sale/[id]/counter.test` page in the
 * web build. The screen is imported by path instead.
 *
 * The two collaborators that cannot run under jest-expo are replaced rather
 * than worked around: `expo-router` ships untranspiled ESM, and the platform
 * event store is a browser/SQLite adapter. Everything else — the projection,
 * `pileTotals`, the real `append` path in `SaleProvider` — is the production
 * code, so a basket confirmed through the panel below is a real event in a
 * real log, not a prop handed to a presentational component.
 */

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

// A four-method in-memory adapter. `MemoryStore` itself cannot be reached
// from here: jest resolves the bare './store' specifier to the platform file
// (store.web.ts), exactly as Metro does, and that file exports only `store`.
jest.mock('../store/store', () => {
  const rows: { saleId: string }[] = [];
  return {
    store: {
      append: async (e: { saleId: string }) => void rows.push(e),
      load: async (saleId: string) => rows.filter((e) => e.saleId === saleId),
      pending: async () => [],
      markSynced: async () => {},
      listSales: async () => [...new Set(rows.map((e) => e.saleId))],
    },
  };
});

// jest-expo defines a `window` with no `location` on it, and the screen reads
// `?holdMs=` off the URL to shorten holds in the browser suite.
Object.defineProperty(window, 'location', { value: { search: '' }, configurable: true });

// A fresh sale id per test: the mocked store is module state and outlives an
// individual test, and two tests seeding the same log would collide on seq.
let sale = '';
let n = 0;
beforeEach(() => {
  sale = `sale-${++n}`;
});

async function renderCounter(events: readonly SaleEvent[]) {
  for (const e of events) await store.append(e);
  const view = wrap(
    <SpeechProvider initial={false}>
      <SaleProvider saleId={sale}>
        <CounterScreen />
      </SaleProvider>
    </SpeechProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('count')).toBeTruthy());
  return view;
}

/** p1 ready and counting, with whatever the caller wants on top. */
function scenario(build: (b: LogBuilder) => void): SaleEvent[] {
  const b = readyPile(setUpSale(new LogBuilder(sale)), 'p1');
  build(b);
  return b.build();
}

describe('the operator register — short baskets on the Count tab', () => {
  it('says nothing about short baskets when the pile has none', async () => {
    await renderCounter(scenario((b) => b.accept('p1')));

    expect(screen.getByTestId('caption')).toHaveTextContent(/2 \+ 50 = 52/);
    expect(screen.queryByTestId('short-so-far')).toBeNull();
  });

  it('shows the count and the summed weight once the pile has one', async () => {
    await renderCounter(
      scenario((b) => {
        b.accept('p1');
        b.short('p1', 14_400); // 14.4 − 2 = 12.4 kg
      }),
    );

    const line = screen.getByTestId('short-so-far');
    expect(line).toHaveTextContent(/1 เข่งไม่เต็ม/);
    expect(line).toHaveTextContent(/12\.4/);
    // The public numeral is untouched: 1 standard + 1 short = 2 baskets.
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('sums, rather than replaces, when a second short basket is confirmed', async () => {
    await renderCounter(scenario((b) => b.short('p1', 14_400))); // 12.4 kg
    expect(screen.getByTestId('short-so-far')).toHaveTextContent(/12\.4/);

    fireEvent.press(screen.getByTestId('short'));
    fireEvent.changeText(screen.getByTestId('short-reading-typed'), '10');
    fireEvent.press(screen.getByTestId('short-confirm'));

    // 12.4 + 8.0 = 20.4 kg across two baskets
    await waitFor(() => {
      const line = screen.getByTestId('short-so-far');
      expect(line).toHaveTextContent(/2 เข่งไม่เต็ม/);
      expect(line).toHaveTextContent(/20\.4/);
    });
  });

  it('is per pile: switching pile shows the newly selected pile own figure', async () => {
    await renderCounter(
      scenario((b) => {
        readyPile(b, 'p2');
        b.short('p1', 14_400); // 12.4 kg
        b.short('p2', 10_000); // 8.0 kg
      }),
    );
    expect(screen.getByTestId('short-so-far')).toHaveTextContent(/12\.4/);

    // The Pill's press handler sits on its Text child, not the testID'd View.
    fireEvent.press(screen.getByText(/โซน\/กอง/));
    fireEvent.press(screen.getByTestId('switcher-pile-p2'));

    await waitFor(() => expect(screen.getByTestId('short-so-far')).toHaveTextContent(/1 เข่งไม่เต็ม · สั้น 8 /));
    expect(screen.getByTestId('short-so-far')).not.toHaveTextContent(/12\.4/);
  });

  it('drops the line entirely when the only short basket is undone', async () => {
    await renderCounter(
      scenario((b) => {
        b.accept('p1');
        b.short('p1', 14_400); // 12.4 kg — the last live basket
      }),
    );
    expect(screen.getByTestId('short-so-far')).toBeTruthy();

    fireEvent.press(screen.getByTestId('undo'));
    fireEvent.press(screen.getByTestId('undo-confirm'));

    await waitFor(() => expect(screen.queryByTestId('short-so-far')).toBeNull());
  });
});

describe('the Pile tab — short weight and the net breakdown', () => {
  it('shows a bare zero and a zero-term breakdown for a pile nobody has shorted', async () => {
    await renderCounter(scenario((b) => b.accept('p1')));
    fireEvent.press(screen.getByTestId('tab-pile'));

    expect(screen.getByTestId('pile-short-weight')).toHaveTextContent('0');
    expect(screen.getByTestId('pile-short-weight')).not.toHaveTextContent(/กก\./);
    expect(screen.getByTestId('pile-weight-breakdown')).toHaveTextContent('50 + 0 = 50 กก.');
  });

  it('shows the short count beside its weight, and the breakdown that adds up', async () => {
    await renderCounter(
      scenario((b) => {
        b.accept('p1'); // 50 kg
        b.short('p1', 14_400); // 12.4 kg
      }),
    );
    fireEvent.press(screen.getByTestId('tab-pile'));

    const short = screen.getByTestId('pile-short-weight');
    expect(short).toHaveTextContent(/^1 · /);
    expect(short).toHaveTextContent(/12\.4/);
    expect(screen.getByTestId('pile-weight-breakdown')).toHaveTextContent('50 + 12.4 = 62.4 กก.');
  });
});
