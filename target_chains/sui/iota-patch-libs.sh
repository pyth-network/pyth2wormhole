#!/bin/bash

set -euo pipefail

# This script patches the SUI code to be compatible with IOTA.  IOTA is a fork
# of SUI but is not compatible with SUI.  You'd need to run this script for
# deploying Pyth contracts and updating the vendored libs.
#
# Note: Do not commit the patched Pyth code to the repo.

# Check if at least one argument (glob pattern) is provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <glob-pattern>"
    exit 1
fi

# Detect OS to determine correct sed syntax. sed --version is not available on macOS/BSD sed.
if sed --version >/dev/null 2>&1; then
    SED_CMD=sed
else
    if ! command -v gsed >/dev/null 2>&1; then
        echo "Error: GNU sed (gsed) is required for macOS/BSD. Install core-utils via Homebrew."
        exit 1
    fi

    SED_CMD=gsed
fi

# Expand glob pattern and iterate over files
for file in $@; do
    if [[ -f "$file" ]]; then
        echo "Processing: $file"
        $SED_CMD -i -e 's/\bSUI\b/IOTA/g' \
               -e 's/\bSui\b/Iota/g' \
               -e 's/\bsui\b/iota/g' "$file"
    else
        echo "Skipping: $file (not a regular file)"
    fi
done

echo "Replacements complete."
