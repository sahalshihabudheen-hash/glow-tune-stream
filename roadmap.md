# Firebase migration roadmap

- [x] Read-only inventory of current app tables, accounts, storage buckets, and code usage.
- [x] Fix "Download all" in playlists so every song downloads/caches offline (was only saving one).
- [x] Database backup export created in Lovable Cloud (database_export_10_10_26). Storage files: user downloads them file-by-file (folders can't be downloaded directly).
- [ ] Connect the user's existing Firebase project (never create a new one). **Blocked:** need the Firebase web-app config from the user.
- [ ] Confirm secure server-side migration access (Firebase service account, stored as a secret) and determine password-hash compatibility.
- [ ] Add Firebase alongside the existing services; keep the current backend authoritative during migration.
- [ ] Transfer records and files; reconcile all counts, references, roles, and permissions.
- [ ] Verify sign-in and core music workflows against Firebase, then cut over with the old service retained for rollback.
