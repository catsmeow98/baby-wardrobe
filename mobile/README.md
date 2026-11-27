# Android app

A Capacitor shell that opens the live site (`server.url` in `capacitor.config.json`), so website changes reach the app as soon as
they are deployed, with no new app needed. A new app file is needed only for native changes (plugins, permissions, icon, app id).

## Builds

`.github/workflows/android.yml` builds a signed APK on GitHub whenever something in `mobile/` changes on `main`, or when run by hand
(Actions tab, "Android app", Run workflow). Each build is published as a GitHub release; the newest is always at
https://github.com/catsmeow98/baby-wardrobe/releases/latest . Install it on the phone and it updates the installed app in place.

The `android/` project is generated during the build (`npx cap add android`) and is not committed. Version code = the workflow run
number, so every build installs over the last.

## Signing key (keep it safe)

The APK is signed with a key stored in two GitHub secrets: `ANDROID_KEYSTORE_BASE64` (the keystore file, base64) and
`ANDROID_KEYSTORE_PASSWORD`. Key alias: `babywardrobe`. Updates only install over the app if they are signed with the same key,
so keep a backup copy of the keystore and password outside GitHub. Never commit the keystore: the repo is public.

## Play Store later

Upload the same app (same app id `com.babywardrobe.app`). When Play asks about app signing, using this same key keeps the
sideloaded install updatable; otherwise uninstall it once and reinstall from Play (all data lives in Supabase).
