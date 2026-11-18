#!/usr/bin/env bash
# Netlify "ignore" step: exit 0 = skip this deploy, exit 1 = build it.
# Builds the first deploy, a manual "Trigger deploy", and any push that contains a [release] commit.
if [ -z "$CACHED_COMMIT_REF" ] || [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then exit 1; fi
if git log --format=%s "$CACHED_COMMIT_REF..$COMMIT_REF" 2>/dev/null | grep -q '\[release\]'; then exit 1; fi
exit 0
