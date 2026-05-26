#!/usr/bin/env bash
#
# KOVAS — Bootstrap script for gradle-wrapper.jar.
#
# Why this script exists:
#   The standard `gradle wrapper --gradle-version 8.10` command generates a
#   `gradle/wrapper/gradle-wrapper.jar` binary (~62 kB). This binary is committed
#   to the repo so contributors can run `./gradlew build` without installing
#   Gradle first. However if the binary is missing (fresh clone in an
#   environment where it couldn't be downloaded), this script bootstraps it
#   from the official Gradle GitHub release.
#
# Usage:
#   ./scripts/init-wrapper.sh
#
# Idempotent: if gradle-wrapper.jar already exists, exits 0 without re-download.
#
# If you have Gradle installed locally, the canonical way to (re-)generate the
# wrapper is:
#   cd services/mdb-writer && gradle wrapper --gradle-version 8.10
#

set -euo pipefail

SCRIPT_DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]:-$0}" )" >/dev/null 2>&1 && pwd )"
SERVICE_DIR="$( cd -P "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd )"
WRAPPER_DIR="${SERVICE_DIR}/gradle/wrapper"
WRAPPER_JAR="${WRAPPER_DIR}/gradle-wrapper.jar"

# Pinned version — keep in sync with gradle-wrapper.properties distributionUrl.
GRADLE_VERSION="8.10"
WRAPPER_URL="https://raw.githubusercontent.com/gradle/gradle/v${GRADLE_VERSION}.0/gradle/wrapper/gradle-wrapper.jar"

# SHA-256 of gradle-wrapper.jar for Gradle 8.10
# Source: https://gradle.org/release-checksums/
# To refresh after a Gradle bump: download the jar and run `shasum -a 256 gradle-wrapper.jar`
EXPECTED_SHA256=""

if [[ -f "${WRAPPER_JAR}" ]]; then
  echo "gradle-wrapper.jar already present at ${WRAPPER_JAR}"
  exit 0
fi

mkdir -p "${WRAPPER_DIR}"

echo "Downloading gradle-wrapper.jar from ${WRAPPER_URL}..."
if command -v curl >/dev/null 2>&1; then
  curl -fSL --retry 3 --retry-delay 2 -o "${WRAPPER_JAR}" "${WRAPPER_URL}"
elif command -v wget >/dev/null 2>&1; then
  wget --tries=3 -O "${WRAPPER_JAR}" "${WRAPPER_URL}"
else
  echo "ERROR: neither curl nor wget is available." >&2
  echo "       Install one of them, or run: cd services/mdb-writer && gradle wrapper --gradle-version 8.10" >&2
  exit 1
fi

# Verify checksum if pinned
if [[ -n "${EXPECTED_SHA256}" ]]; then
  if command -v shasum >/dev/null 2>&1; then
    ACTUAL_SHA256="$( shasum -a 256 "${WRAPPER_JAR}" | awk '{print $1}' )"
  elif command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_SHA256="$( sha256sum "${WRAPPER_JAR}" | awk '{print $1}' )"
  else
    echo "WARN: no shasum/sha256sum available, skipping checksum verification." >&2
    ACTUAL_SHA256=""
  fi
  if [[ -n "${ACTUAL_SHA256}" && "${ACTUAL_SHA256}" != "${EXPECTED_SHA256}" ]]; then
    rm -f "${WRAPPER_JAR}"
    echo "ERROR: gradle-wrapper.jar SHA-256 mismatch." >&2
    echo "       Expected: ${EXPECTED_SHA256}" >&2
    echo "       Actual:   ${ACTUAL_SHA256}" >&2
    exit 1
  fi
fi

echo "gradle-wrapper.jar bootstrapped successfully at ${WRAPPER_JAR}"
