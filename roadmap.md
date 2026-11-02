# Firebase migration roadmap

- [x] Read-only inventory of current app tables, accounts, storage buckets, and code usage.
- [x] Fix "Download all" in playlists so every song downloads/caches offline (was only saving one).
- [x] Database backup export created in Lovable Cloud (database_export_10_10_26). Storage files: user downloads them file-by-file (folders can't be downloaded directly).
- [x] Connect the user's existing Firebase project (never create a new one). Firebase web-app config received for `nyra-music-566bf`.
- [x] Confirm secure server-side migration access (Firebase service account, stored as a secret). First key was mangled on paste; user re-saved a valid one. Key signs and gets accepted by Google (token exchange OK).
- [ ] Set up Firebase project services (user, in Firebase Console): 1) Authentication → Get started → enable Email/Password (Auth is unconfigured: CONFIGURATION_NOT_FOUND). 2) Firestore Database → Create database (API disabled). 3) Storage → Get started (no buckets exist; GCS reports billing account absent). 4) Regenerate the service-account key from Project settings → Service accounts → Firebase Admin SDK section (current key has near-zero project permissions; 403 on IAM/API enable).
- [ ] After console setup: re-run validate, then transfer users (BCRYPT import), tables (Firestore), and storage files.
- [ ] Add Firebase alongside the existing services; keep the current backend authoritative during migration.
- [ ] Transfer records and files; reconcile all counts, references, roles, and permissions.
- [ ] Verify sign-in and core music workflows against Firebase, then cut over with the old service retained for rollback.
