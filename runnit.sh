#!/bin/bash
rm -rf release dist
npm install && npm run dist

# Detect platform and launch the appropriate app
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open ./release/mac-arm64/renide.app
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - launch AppImage
    chmod +x ./release/*.AppImage
    ./release/*.AppImage &
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    # Windows
    ./release/win-unpacked/renide.exe &
else
    echo "Unsupported platform: $OSTYPE"
    echo "Please launch the app manually from the release/ directory"
    exit 1
fi
