# NYRA for Android (native app, no Capacitor)

A small native Kotlin app that shows the NYRA website full-screen and adds the things a browser tab can't do:

- **Background playback** with notification, lock-screen and Bluetooth/headset controls (Media3)
- A **custom "now playing" notification**: album art, title/artist, seek bar, previous / play-pause / next,
  a **heart button** that adds/removes the song from your favourites, NYRA treble-clef icon and a coral accent taken from the logo
- **Plays with the screen off**: a foreground service plus a wake lock (held only while music plays) keep
  streaming and auto-advance going for playlists, albums, radio, anything the site plays. The notification and
  lock-screen buttons control whatever is playing.
- **Saving songs to the phone** (`Downloads/NYRA`) from the site's download buttons
- Proper **back button**, links to other sites open in the browser, **offline page**, splash screen,
  fullscreen video, file picker, microphone prompt for the admin voice recorder

The app loads the live site, so **website updates reach the app immediately**; you only rebuild the APK
when you change the native shell.

Package: `com.nyra.pulse` · Min Android: 8.0 (API 26) · Site URL: `app/build.gradle.kts` → `SITE_URL`

---

## Get an APK

### Option A: GitHub Actions (no installs needed)
1. Push this repo to GitHub (the workflow is `.github/workflows/android.yml`).
2. Open the **Actions** tab → **Build Android app** → pick the latest run (or *Run workflow*).
3. Download **nyra-debug-apk** from *Artifacts*, unzip, copy the `.apk` to your phone and install it
   (allow "install unknown apps" when asked).

### Option B: Android Studio
Open the `android-app` folder, wait for Gradle sync, then **Build → Build APK(s)** (or press Run with a phone attached).

### Option C: Command line
```bash
cd android-app
./gradlew assembleDebug        # -> app/build/outputs/apk/debug/app-debug.apk
```
Needs JDK 17 and the Android SDK (platform 36).

The debug build uses the id `com.nyra.pulse.debug` and is named **NYRA Debug**, so it installs next to
the old Capacitor app or a release build without clashing.

---

## Release build / Play Store

1. Create a signing key **once** and back it up somewhere safe (lose it = can't update the app):
   ```bash
   keytool -genkeypair -v -keystore nyra-release.jks -alias nyra -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android-app/keystore.properties` (git-ignored, never commit it):
   ```properties
   storeFile=nyra-release.jks
   storePassword=...
   keyAlias=nyra
   keyPassword=...
   ```
3. `./gradlew assembleRelease` (APK) or `./gradlew bundleRelease` (AAB for Play Store).
4. Bump `versionCode` / `versionName` in `app/build.gradle.kts` for every update you publish.

**To have GitHub Actions build signed releases**, add these repository secrets
(Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_BASE64` (output of `base64 -w0 nyra-release.jks`),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

---

## How it works

```
 NYRA website (in WebView)                          Android app
 ─────────────────────────                          ───────────
 src/lib/nyraMediaBridge.ts ── window.NyraAndroid ─▶ MainActivity.handleWebMessage
   {type:'track'|'playback'}   (WebMessageListener)        │
                                                           ▼
                                                    NyraMediaBridge ─▶ NyraVirtualPlayer ─▶ Media3 session
                                                                                            (notification / lock screen)
   'message' events  ◀──── replyProxy.postMessage ◀─ play / pause / next / previous / seek
```

- The page plays the audio. `NyraVirtualPlayer` only *mirrors* its state so Android can show controls,
  and sends button presses back to the page.
- `window.NyraAndroid` is created with a **WebMessageListener restricted to the site's origin**, so embedded
  third-party frames (YouTube, ads) cannot talk to the app.
- `assets/nyra-helpers.js` is injected after each page load. It catches the site's `<a download href="blob:…">`
  clicks and streams the file to `DownloadSaver` in chunks.
- The same website code still works in a normal browser and in the old Capacitor app; the bridge simply does
  nothing when `window.NyraAndroid` isn't there.

| File | Role |
|---|---|
| `MainActivity.kt` | WebView setup, navigation rules, bridge, downloads, back button, fullscreen, permissions |
| `NyraMediaService.kt` | Media3 foreground service: keeps playback alive, heart button, wake lock |
| `NyraNotificationProvider.kt` | Styles the notification (icon, accent colour, channel name) |
| `NyraVirtualPlayer.kt` | Mirrors the page's player state into Media3 |
| `NyraMediaBridge.kt` | Hand-off between the page and the service |
| `DownloadSaver.kt` | Writes downloaded files to `Downloads/NYRA` |
| `assets/offline.html` | Shown if the site can't be reached on launch |
| `tools/make_icons.py` | Regenerates all logo images from `branding/app-logo.png` |

---

## Things to know

- **Screen-off playback on Xiaomi / Oppo / Vivo / Samsung etc.:** these phones can kill background music to save
  battery. The first time a song plays, the app shows a tip that opens its settings page; set **Battery →
  Unrestricted**. (It is shown once, and not at all if the app is already unrestricted.)
- The heart button needs the user to be logged in on the site (same as the heart inside the site); otherwise the
  site shows its usual "Please login" message.

- **Google sign-in doesn't work inside any WebView** (Google blocks it). The site currently has no Google
  login, but keep this in mind for the Firebase migration: prefer email/password, or add a native/Custom Tabs
  sign-in flow. The same applies to the optional "upload playlist to YouTube" popup flow.
- Lock-screen controls need Android System WebView with `WEB_MESSAGE_LISTENER` support (any reasonably
  up-to-date phone). Without it the site still works; only the system media controls are missing.
- On Android 13+ the app asks for notification permission, which is required to show the media controls.
- On Android 8–9, downloads go to the app's own folder (`Android/data/com.nyra.pulse/files/Download`)
  because writing to the public Downloads folder needs an extra storage permission.
- **Changing the logo:** the launcher icon, themed icon, splash screen, notification icon and offline-page logo are all
  generated from `branding/app-logo.png`. To switch logos run `python3 tools/make_icons.py path/to/new-logo.png`
  (needs `pip install pillow numpy scipy`), then update `splash_bg` / `ic_launcher_background` in
  `res/values/colors.xml` to the new logo's background colour (the script prints it).
- If a build fails with *"file failed to compile"* on a `.png`, the image got corrupted on the way into the repo
  (some upload tools mangle binary files). Re-upload the PNGs, or re-run `tools/make_icons.py`.
- The old Capacitor project in `/android` is untouched; delete it once you no longer need it.

## Quick test checklist (first install)
1. App opens on the splash, then the site. Rotate the phone; the page should survive.
2. Play a song → notification with title/artwork appears; pause/next/previous from the notification work.
3. Lock the phone / switch apps → music keeps playing; controls work on the lock screen.
4. Save a song from the site → toast "Saved to Downloads/NYRA…" and the file appears in Files.
5. Tap the heart on the notification → the song is favourited on the site (heart fills in); tap again to remove.
6. Turn off the screen and wait a few minutes → music keeps playing and moves on to the next song.
7. Turn on airplane mode, force-close, reopen → the offline page appears; reconnect → site loads by itself.
8. Tap an external link → opens in the browser. Press Back → navigates back; at the root it backgrounds (music continues).
