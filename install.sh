#!/bin/bash
set -e

# ==============================================================================
# Horizon PM — Automated macOS Installer
# Installs Horizon PM to /Applications and configures macOS permissions cleanly.
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${BLUE}${BOLD}"
echo "  _    _            _                  _____  __  __ "
echo " | |  | |          (_)                |  __ \|  \/  |"
echo " | |__| | ___  _ __ _ _______  _ __   | |__) | \  / |"
echo " |  __  |/ _ \| '__| |_  / _ \| '_ \  |  ___/| |\/| |"
echo " | |  | | (_) | |  | |/ / (_) | | | | | |    | |  | |"
echo " |_|  |_|\___/|_|  |_/___\___/|_| |_| |_|    |_|  |_|"
echo -e "${RESET}"
echo -e "${BOLD}Horizon PM — Product Management. Clarity to impact.${RESET}"
echo "======================================================"

# 1. Check OS
if [ "$(uname -s)" != "Darwin" ]; then
    echo -e "${RED}Error: This script is intended for macOS only.${RESET}"
    exit 1
fi

# 2. Detect Architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    MAC_ARCH="arm64"
    ARCH_DESC="Apple Silicon (M1/M2/M3/M4)"
elif [ "$ARCH" = "x86_64" ]; then
    MAC_ARCH="x64"
    ARCH_DESC="Intel Mac (x64)"
else
    echo -e "${RED}Unsupported architecture: $ARCH${RESET}"
    exit 1
fi

VERSION="1.1.0"
DMG_NAME="Horizon-${VERSION}-mac-${MAC_ARCH}.dmg"
DOWNLOAD_URL="https://github.com/HumanNai/Horizon/releases/download/v${VERSION}/${DMG_NAME}"
TMP_DIR=$(mktemp -d /tmp/horizon-install.XXXXXX)
DMG_PATH="${TMP_DIR}/${DMG_NAME}"

cleanup() {
    if [ -d "/Volumes/Horizon" ]; then
        hdiutil detach "/Volumes/Horizon" -quiet -force 2>/dev/null || true
    fi
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo -e "${BLUE}▶ Detected Platform:${RESET} ${ARCH_DESC}"
echo -e "${BLUE}▶ Downloading Horizon PM v${VERSION}...${RESET}"

curl -L --progress-bar "$DOWNLOAD_URL" -o "$DMG_PATH"

echo -e "${BLUE}▶ Mounting Disk Image...${RESET}"
MOUNT_DIR=$(mktemp -d /tmp/horizon-mount.XXXXXX)
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

echo -e "${BLUE}▶ Installing to /Applications...${RESET}"
if [ -d "/Applications/Horizon.app" ]; then
    echo -e "${YELLOW}  Replacing existing /Applications/Horizon.app...${RESET}"
    rm -rf "/Applications/Horizon.app"
fi

cp -R "$MOUNT_DIR/Horizon.app" "/Applications/"

echo -e "${BLUE}▶ Unmounting temporary disk image...${RESET}"
hdiutil detach "$MOUNT_DIR" -quiet -force

echo -e "${BLUE}▶ Clearing macOS Gatekeeper quarantine attributes...${RESET}"
xattr -cr "/Applications/Horizon.app" || true

echo ""
echo -e "${GREEN}${BOLD}✔ Installation Successful!${RESET}"
echo -e "${GREEN}Horizon PM is now installed at: /Applications/Horizon.app${RESET}"
echo ""

# Launch application
read -p "Would you like to launch Horizon PM now? [Y/n] " -n 1 -r || true
echo ""
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo -e "${BLUE}Launching Horizon PM...${RESET}"
    open "/Applications/Horizon.app"
fi
