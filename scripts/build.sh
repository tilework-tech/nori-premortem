#!/bin/bash
set -e

echo "Building premortem package..."
echo "[1/3] Compiling TypeScript..."
tsc

echo "[2/3] Resolving path aliases..."
tsc-alias

echo "[3/3] Setting file permissions..."
chmod +x build/cli.js

echo "Build complete! ✓"
