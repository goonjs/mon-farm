/**
 * `MemoryPeopleStore`, in its own file rather than inside `people.ts`.
 *
 * This is not a style choice. `people.native.ts` / `people.web.ts` shadow any
 * bare `./people` (or `../store/people`) specifier under React Native's
 * platform-extension resolution — and jest-expo applies that same resolution
 * inside `jest.requireActual`, not just inside Metro. A test importing
 * `MemoryPeopleStore` from `./people` under Jest silently receives whichever
 * platform adapter jest defaults to instead of the base file, and the class
 * it's looking for isn't there. Vitest has no such platform layer, so the same
 * import works fine there — which is exactly the kind of test-runner-dependent
 * behaviour that is worth naming a file to avoid rather than working around at
 * every call site.
 *
 * `people.ts` re-exports this for convenience; import directly from here in
 * anything that must run under Jest.
 */

import type { PersonId } from '../core/types';
import type { PeopleStore, Person } from './people';

/** In-memory. Used by tests and as the fallback when no persistent backend is available. */
export class MemoryPeopleStore implements PeopleStore {
  private rows = new Map<PersonId, Person>();

  async list(): Promise<Person[]> {
    return [...this.rows.values()]
      .filter((p) => p.archivedTs === null)
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }

  async get(id: PersonId): Promise<Person | null> {
    return this.rows.get(id) ?? null;
  }

  async create(name: string): Promise<Person> {
    const id = `person-${this.rows.size}-${Date.now()}`;
    const person: Person = { id, name, createdTs: Date.now(), archivedTs: null };
    this.rows.set(id, person);
    return person;
  }

  async rename(id: PersonId, name: string): Promise<void> {
    const p = this.rows.get(id);
    if (p) this.rows.set(id, { ...p, name });
  }

  async archive(id: PersonId): Promise<void> {
    const p = this.rows.get(id);
    if (p) this.rows.set(id, { ...p, archivedTs: Date.now() });
  }
}
