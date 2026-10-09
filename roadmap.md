# Firebase migration roadmap

- [x] Read-only inventory of current app tables, accounts, storage buckets, and code usage.
- [ ] Create a recoverable source export and record its completion before any transfer. **Blocked:** user must export through Lovable Cloud's Advanced settings → Export data; that export page does not import data.
- [ ] Connect a Firebase project and confirm Auth, Firestore, and Storage are enabled. **Blocked:** need Firebase project web-app configuration from the user.
- [ ] Confirm secure server-side migration access and determine password-hash compatibility before committing to password preservation.
- [ ] Add Firebase alongside the existing services; keep the current backend authoritative during migration.
- [ ] Transfer records and files; reconcile all counts, references, roles, and permissions.
- [ ] Verify sign-in and core music workflows against Firebase, then cut over with the old service retained for rollback.