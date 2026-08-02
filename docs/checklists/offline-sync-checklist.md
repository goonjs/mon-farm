# Offline / Sync Gate Checklist

Run this for any story that touches local storage, sync, connectivity
state, or conflict resolution. Attach the completed checklist to the
story's QA notes.

- [ ] Feature is fully usable with no network connection (verified, not
      assumed)
- [ ] Local writes made while offline are queued/persisted correctly
- [ ] Sync triggers correctly on reconnect (if in scope for this story)
- [ ] Sync can also be triggered manually (if in scope for this story)
- [ ] Conflicting local/remote changes are resolved per the strategy in
      `docs/architecture.md` — not silently dropped or overwritten
      unexpectedly
- [ ] Partial/failed sync leaves local data in a consistent, retryable
      state
- [ ] User has some visibility into sync status (pending / synced / error)
      appropriate to this story's scope
- [ ] No data loss scenario identified during testing
