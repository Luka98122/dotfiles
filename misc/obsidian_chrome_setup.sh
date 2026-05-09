#!/bin/bash

# 1. Define paths
BIN_DIR="$HOME/.local/bin"
APP_DIR="$HOME/.local/share/applications"
SCRIPT_PATH="$BIN_DIR/chrome-profile-launcher.sh"
DESKTOP_FILE="$APP_DIR/chrome-profile-handler.desktop"

echo "🚀 Starting setup for custom Chrome profile protocol..."

# 2. Create local bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# 3. Create the launcher script
cat << 'EOF' > "$SCRIPT_PATH"
#!/bin/bash
# Parses chrome-profile://ProfileName/URL
PROTO_URL="$1"
CLEAN_URL=${PROTO_URL#chrome-profile://}
PROFILE=$(echo "$CLEAN_URL" | cut -d'/' -f1)
TARGET_URL=$(echo "$CLEAN_URL" | cut -d'/' -f2-)

# Execute Chrome with the specific profile
google-chrome --profile-directory="$PROFILE" "https://$TARGET_URL"
EOF

# 4. Make the script executable
chmod +x "$SCRIPT_PATH"
echo "✅ Launcher script created at $SCRIPT_PATH"

# 5. Create the .desktop entry for Ubuntu
cat << EOF > "$DESKTOP_FILE"
[Desktop Entry]
Name=Chrome Profile Launcher
Exec=$SCRIPT_PATH %u
Type=Application
Terminal=false
MimeType=x-scheme-handler/chrome-profile;
EOF

echo "✅ Desktop entry created at $DESKTOP_FILE"

# 6. Register the protocol handler
xdg-mime default chrome-profile-handler.desktop x-scheme-handler/chrome-profile

echo "✨ Registration complete!"
echo "-------------------------------------------------------"
echo "You can now use this link in Obsidian:"
echo "[Open Gmail](chrome-profile://Default/mail.google.com)"
echo "-------------------------------------------------------"