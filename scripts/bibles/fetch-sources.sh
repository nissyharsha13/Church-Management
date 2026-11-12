#!/usr/bin/env bash
# Downloads the raw Bible source texts used by build.mjs.
# Usage: scripts/bibles/fetch-sources.sh <dest-dir>
# Sources and licences are documented in docs/BIBLES.md.
set -euo pipefail
DEST="${1:?usage: fetch-sources.sh <dest-dir>}"
mkdir -p "$DEST"
cd "$DEST"
clone() { [ -d "$2" ] || git clone -q --depth 1 "$1" "$2"; }
clone https://github.com/FreeBiblesIndia/Telugu_Bible te-irv   # Telugu IRV, CC BY-SA 4.0 (USFM)
clone https://github.com/aruljohn/Bible-telugu        te-ov    # Telugu Old Version (BSI 1880 text), JSON
clone https://github.com/seven1m/open-bibles          open-bibles # KJV, BSB, WEB, ASV, BBE, Darby (public domain)
echo "Sources ready in $DEST"
