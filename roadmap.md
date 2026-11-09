# Firebase migration roadmap

- [x] Read-only inventory of current app tables, accounts, storage buckets, and code usage.
- [x] Fix "Download all" in playlists so every song downloads/caches offline (was only saving one).
- [x] Make song-share links open the matching YouTube Music track instead of the NYRA/JioSaavn preview.
- [x] Database backup export created in Lovable Cloud (database_export_10_10_26).
- [x] Connect the user's existing Firebase project (never create a new one). Firebase web-app config received for `nyra-music-566bf`.
- [x] Confirm secure server-side migration access (Firebase service account, stored as a secret, valid).
- [x] Set up Firebase project services: Email/Password + Google auth enabled, Firestore database created (asia-south1). Firebase Storage SKIPPED by user decision — images/files stay on Lovable Cloud; never re-propose migrating storage to Firebase.
- [x] Validate Firebase access: auth OK, Firestore OK (fixed bare-documents probe; auth-schema reads now via Auth admin API).
- [x] Transfer users: 69/69 accounts imported to Firebase Auth via accounts:batchCreate (BCRYPT, passwords preserved, zero errors).
- [x] Transfer tables: all 17 public tables copied to Firestore (3942 listening_history rows, 136 playlist_items, 47 lyrics, 47 admin_chat_messages, etc.), zero failures; status reconciled.
- [ ] Add Firebase SDK alongside the existing services in the app code; keep the current backend authoritative during migration.
- [ ] Swap data access + auth to Firebase behind the same app interfaces; image URLs keep pointing at Lovable Cloud storage.
- [ ] Verify sign-in (existing passwords) and core music workflows against Firebase, then cut over with the old service retained for rollback.
