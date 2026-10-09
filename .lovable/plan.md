# Safe migration from Lovable Cloud to Firebase

## Goal
Move account sign-in and all existing music-app data to Firebase while preserving the current website experience and keeping the current backend intact until the new system is proven complete.

## Migration approach
1. **Inventory and backup** — enumerate every user, app table, storage bucket/file, and server function involved; establish a recoverable export before any writes or cutover.
2. **Prepare Firebase** — connect the chosen Firebase project, configure Authentication, Firestore, Storage, and restrictive access rules. Keep service credentials private and out of browser code.
3. **Build a parallel Firebase data layer** — add Firebase alongside the existing services and migrate the app in small, testable areas without replacing or deleting the current implementation early.
4. **Transfer and reconcile data** — map relational records and file URLs into Firebase, preserve user IDs and timestamps where possible, then compare source and destination counts and verify representative playlists, favorites, listening history, artist uploads, lyrics, roles, and settings.
5. **Migrate sign-in safely** — determine whether existing password hashes and user exports are available in a compatible form. Preserve passwords only if Firebase supports the exact source hash format; otherwise provide a secure password-reset path. Never copy plaintext passwords.
6. **End-to-end verification** — test sign-in, permissions, playback references, uploads, playlists, admin-only actions, and mobile behavior against Firebase before switching users over.
7. **Controlled cutover and rollback window** — switch traffic only after reconciliation passes; retain the original backend and backups during a defined rollback window. Do not delete the old data as part of the cutover.

## Technical details
- The current app has broad direct usage of its existing auth/data/storage client across dozens of frontend files, 18+ database tables, and more than 20 server functions. This requires a staged rewrite, not a one-click database conversion.
- PostgreSQL relationships and row-level permissions must be mapped to Firestore document structure and Firebase Security Rules; file links and access rules also need migration.
- Firebase project configuration and a securely supplied server credential are required before implementation can connect to the destination. No credential belongs in frontend source.
- Existing passwords may or may not be portable depending on access to exportable password hashes and Firebase's supported import format. If compatibility cannot be confirmed, users must reset passwords; no data will be discarded to hide that limitation.

## Safety gates
- No production cutover, source-data deletion, or auth-provider removal before a verified backup and row/file reconciliation.
- Stop and report any export, credential, or password-hash limitation before risking data integrity.
- Preserve the existing music dashboard, player, and YouTube integration except where a backend call must be redirected to Firebase.
