# Macos localhost connection issue
_Exported on 1/28/2026 at 12:56:19 GMT+7 from Cursor (2.4.21)_

---

**User**

Fix @client/macos/ can't make http request to localhost

---

**Cursor**

Updated macOS sandbox and ATS settings so the app can make HTTP calls to `localhost`.

Changes:
- Added `com.apple.security.network.client` to both `DebugProfile.entitlements` and `Release.entitlements`.
- Added ATS exceptions for `localhost` and `127.0.0.1` in `Info.plist`.

Next steps:
- Rebuild the macOS app (a clean build if it still fails).
- If your server is bound to `0.0.0.0`, call it via `localhost` or `127.0.0.1` from the app.

---

**User**

Verify these issues exist and fix them:

Bug 1:
The SQLite WAL (Write-Ahead Log) files `quiz.sqlite-shm` and `quiz.sqlite-wal` are temporary runtime artifacts automatically created by SQLite. These should never be committed to version control as they contain in-progress transactions specific to each environment. Committing them causes merge conflicts, database consistency issues across environments, and unnecessary repository bloat. These files should be added to `.gitignore` instead.



---

**Cursor**

Fixed by adding a root `.gitignore` that ignores SQLite WAL/shm files and removing the tracked runtime artifacts from `server/`. This prevents them from being committed and avoids merge conflicts and repo bloat.

If you want me to also update any server-specific ignore files or restore a clean database state, say the word.

