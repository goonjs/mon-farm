/**
 * Web people store. Same localStorage trade-off as `store.web.ts`: this is the
 * verification surface, not the field surface, so simplicity wins over write
 * efficiency. See that file's header for the full reasoning.
 */

import { newId } from '../lib/id';
import type { PersonId } from '../core/types';
import type { PeopleStore, Person } from './people';

const KEY = 'mon-farm:people';

function read(): Person[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Person[]) : [];
  } catch {
    return [];
  }
}

function write(rows: Person[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* a quota error must not take the app down */
  }
}

export class WebPeopleStore implements PeopleStore {
  async list(): Promise<Person[]> {
    return read()
      .filter((p) => p.archivedTs === null)
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }

  async get(id: PersonId): Promise<Person | null> {
    return read().find((p) => p.id === id) ?? null;
  }

  async create(name: string): Promise<Person> {
    const person: Person = { id: newId('person-'), name, createdTs: Date.now(), archivedTs: null };
    write([...read(), person]);
    return person;
  }

  async rename(id: PersonId, name: string): Promise<void> {
    write(read().map((p) => (p.id === id ? { ...p, name } : p)));
  }

  async archive(id: PersonId): Promise<void> {
    write(read().map((p) => (p.id === id ? { ...p, archivedTs: Date.now() } : p)));
  }
}

export const peopleStore: PeopleStore = new WebPeopleStore();
