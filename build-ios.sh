#!/bin/bash
# ============================================================
# QuranNotes - One-Command iOS Build Script
# ============================================================
# Usage: ./build-ios.sh
#
# This script handles everything:
# 1. Patches Expo/React Native scripts for spaces in path
# 2. Restores native configurations (background audio, icon)
# 3. Builds production archive
# 4. Exports IPA
# ============================================================

set -eo pipefail

PROJECT_DIR="/Users/mahmoudalaaeldin/Documents/Projects/Vibe Coding/Projects/Quran app"
SCHEME="QuranNotes"
WORKSPACE="ios/QuranNotes.xcworkspace"
ARCHIVE_PATH="./build/QuranNotes.xcarchive"
EXPORT_PATH="./build"
EXPORT_OPTIONS="ios/ExportOptions.plist"
TEAM_ID="2S42RLH67Y"

cd "$PROJECT_DIR"

echo ""
echo "🚀 QuranNotes iOS Build"
echo "========================"
echo ""

# ---- Step 1: Clean ----
echo "🧹 Step 1/6: Cleaning previous builds..."
rm -rf build/
mkdir -p build/
rm -rf ~/Library/Developer/Xcode/DerivedData/QuranNotes-*
echo "   ✅ Clean"

# ---- Step 2: Patch scripts for spaces in path ----
echo "🔧 Step 2/6: Patching build scripts..."

# Patch EXConstants script (unquoted $PROJECT_DIR)
EXCONST_SCRIPT="node_modules/expo-constants/scripts/get-app-config-ios.sh"
if [ -f "$EXCONST_SCRIPT" ]; then
  sed -i '' 's/PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)/PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")/' "$EXCONST_SCRIPT"
fi

# Patch react-native-xcode.sh invocation in project.pbxproj (unquoted backtick execution)
PBXPROJ="ios/QuranNotes.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
  python3 << 'PYEOF'
with open("ios/QuranNotes.xcodeproj/project.pbxproj", "r") as f:
    content = f.read()
old = '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`'
new = '. \\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"'
if old in content:
    content = content.replace(old, new)
    with open("ios/QuranNotes.xcodeproj/project.pbxproj", "w") as f:
        f.write(content)
PYEOF
fi

# Patch EXConstants invocation in Pods project (unquoted script path)
PODS_PBXPROJ="ios/Pods/Pods.xcodeproj/project.pbxproj"
if [ -f "$PODS_PBXPROJ" ]; then
  sed -i '' 's|bash -l -c \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"|bash -l -c \\"\\\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\\\"\\"|' "$PODS_PBXPROJ"
fi

echo "   ✅ Patched"

# ---- Step 3: Restore native configs ----
echo "📱 Step 3/6: Restoring native configurations..."

# Restore UIBackgroundModes if missing
PLIST="ios/QuranNotes/Info.plist"
if ! grep -q "UIBackgroundModes" "$PLIST" 2>/dev/null; then
  sed -i '' '/<key>UIRequiresFullScreen<\/key>/{
    N
    s|<key>UIRequiresFullScreen</key>\n.*<false/>|<key>UIRequiresFullScreen</key>\
    <false/>\
    <key>UIBackgroundModes</key>\
    <array>\
      <string>audio</string>\
    </array>|
  }' "$PLIST"
  echo "   Added UIBackgroundModes"
fi

# Restore app icon
sips -s format png -z 1024 1024 "assets/icon.png" --out "ios/QuranNotes/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png" > /dev/null 2>&1
echo "   ✅ Native configs restored"

# ---- Step 4: Ensure ExportOptions.plist exists ----
echo "📄 Step 4/6: Checking ExportOptions.plist..."
if [ ! -f "$EXPORT_OPTIONS" ]; then
  cat > "$EXPORT_OPTIONS" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>2S42RLH67Y</string>
    <key>uploadSymbols</key>
    <true/>
    <key>uploadBitcode</key>
    <false/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
PLIST
  echo "   Created ExportOptions.plist"
fi
echo "   ✅ Ready"

# ---- Step 5: Build Archive ----
echo "🔨 Step 5/6: Building archive (5-10 minutes)..."
echo ""

xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -quiet

if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "❌ Archive failed!"
    exit 1
fi
echo ""
echo "   ✅ Archive created"

# ---- Step 6: Export IPA ----
echo "📤 Step 6/6: Exporting IPA..."

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates \
  -quiet

if [ ! -f "$EXPORT_PATH/QuranNotes.ipa" ]; then
    echo "❌ Export failed!"
    exit 1
fi

echo "   ✅ IPA exported"
echo ""
echo "========================================"
echo "🎉 BUILD COMPLETE!"
echo "========================================"
echo ""
echo "📱 IPA: $PROJECT_DIR/build/QuranNotes.ipa"
echo ""
echo "📋 To upload to TestFlight:"
echo "   xcrun altool --upload-app --type ios \\"
echo "     --file build/QuranNotes.ipa \\"
echo "     --apiKey <KEY> --apiIssuer <ISSUER>"
echo ""
echo "   OR open Xcode → Window → Organizer → Distribute"
echo ""
