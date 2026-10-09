# Project architecture rules

- Keep the current backend active until Firebase data, files, and access rules are reconciled and end-to-end checks pass; this preserves a rollback path and avoids losing user data during migration.