# Epic E01: Foundation — sync engine, backend, CI

Status: Draft
PRD: SYNC, NFR-2/3/5/6 · architecture.md "2026-10-02 Direction"

## Goal
- One event log syncs across 3 phones + web, offline-first, never overwriting money silently.

## Scope
- Re-key event log: global ids (UUIDv7/ULID), per-device seq, actor = user + device
- Web store: localStorage → IndexedDB
- Firebase dev + prod projects (Blaze, budget alert, asia-southeast1)
- Firestore: immutable event docs, create-only rules, per-group isolation
- Outbox push + snapshot pull; auto sync on reconnect; auto retry
- Status per record + global: Synced / Pending Sync / Conflict; retry action on error
- Conflict detection (two edits on same base) + resolve UI
- Soft delete / restore events; provenance fields
- Media queue → Cloud Storage
- CI: push main + PR only, docs-only skip, verify → e2e → preview, browser cache
- Cloud Run preview per PR; delete on close + 7-day sweep; registry keep 2 / 30 days
- First native Android run (dev client)

## Out
- Handoff/QR (E04), Bluetooth (post-MVP)

## Open
- 
