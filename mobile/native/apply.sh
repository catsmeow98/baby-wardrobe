#!/usr/bin/env bash
# Adds the app's own native code to the generated Android project (run from mobile/ after `npx cap add android`).
set -euo pipefail
SRC=android/app/src/main/java/com/babywardrobe/app
mkdir -p "$SRC"
# Replace the generated MainActivity (Java or Kotlin) with ours, which registers the plugins.
rm -f "$SRC/MainActivity.java" "$SRC/MainActivity.kt"
cp native/MainActivity.java native/SubjectSegmenterPlugin.java "$SRC/"

# Google ML Kit subject segmentation (unbundled: the model comes from Play services).
GRADLE=android/app/build.gradle
grep -q "play-services-mlkit-subject-segmentation" "$GRADLE" || \
  perl -0pi -e 's/\ndependencies \{/\ndependencies {\n    implementation "com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1"/' "$GRADLE"
grep -q "play-services-mlkit-subject-segmentation" "$GRADLE" || { echo "::error::could not add the ML Kit dependency to $GRADLE"; exit 1; }

# Ask Play services to fetch the model when the app is installed, not on the first cutout.
MANIFEST=android/app/src/main/AndroidManifest.xml
grep -q "com.google.mlkit.vision.DEPENDENCIES" "$MANIFEST" || \
  perl -0pi -e 's/(<application[^>]*>)/$1\n        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="subject_segment" \/>/' "$MANIFEST"
grep -q "com.google.mlkit.vision.DEPENDENCIES" "$MANIFEST" || { echo "::error::could not add the ML Kit meta-data to $MANIFEST"; exit 1; }

# The camera: for the in-app camera (live view) and the phone camera from a photo button. Not required, so the app still
# installs on a device without one.
grep -q "android.permission.CAMERA" "$MANIFEST" || \
  perl -0pi -e 's/(<application)/<uses-permission android:name="android.permission.CAMERA" \/>\n    <uses-feature android:name="android.hardware.camera" android:required="false" \/>\n    $1/' "$MANIFEST"
grep -q "android.permission.CAMERA" "$MANIFEST" || { echo "::error::could not add the camera permission to $MANIFEST"; exit 1; }

echo "Native code added:"; ls "$SRC"; grep -n "mlkit" "$GRADLE" "$MANIFEST"
