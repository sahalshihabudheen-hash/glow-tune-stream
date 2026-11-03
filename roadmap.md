# Firebase migration roadmap

- [x] Read-only inventory of current app tables, accounts, storage buckets, and code usage.
- [x] Fix "Download all" in playlists so every song downloads/caches offline (was only saving one).
- [x] Database backup export created in Lovable Cloud (database_export_10_10_26). Storage files: user downloads them file-by-file (folders can't be downloaded directly).
- [x] Connect the user's existing Firebase project (never create a new one). Firebase web-app config received for `nyra-music-566bf`.
- [x] Confirm secure server-side migration access (Firebase service account, stored as a secret). First key was mangled on paste; user re-saved a valid one. Key signs and gets accepted by Google (token exchange OK).
- [x] Set up Firebase project services: Email/Password + Google auth enabled, Firestore database created (asia-south1). Firebase Storage SKIPPED by user decision — images/files stay on Lovable Cloud; never re-propose migrating storage to Firebase.
- [ ] After console setup: re-run validate, then transfer users (BCRYPT import) and tables (Firestore). Storage migration is out of scope.
- [ ] Add Firebase alongside the existing services; keep the current backend authoritative during migration.
- [ ] Transfer records and files; reconcile all counts, references, roles, and permissions.
- [ ] Verify sign-in and core music workflows against Firebase, then cut over with the old service retained for rollback.
