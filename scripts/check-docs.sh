#!/usr/bin/env bash
# Checks project docs against the CLAUDE.md word limits and for broken relative links. Exit 1 on any failure.
cd "$(dirname "$0")/.." || exit 1
fail=0

while read -r file limit; do
  [ -f "$file" ] || { echo "MISSING  $file"; fail=1; continue; }
  words=$(wc -w < "$file")
  if [ "$words" -gt "$limit" ]; then echo "OVER     $file $words/$limit"; fail=1; else echo "ok       $file $words/$limit"; fi
done <<'EOF'
CLAUDE.md 800
MEMORY.md 400
architecture.md 1200
progress.md 500
docs/PRD.md 1500
docs/TRD.md 1500
docs/UI-UX.md 1200
docs/DB-SCHEMA.md 1000
docs/SECURITY.md 1000
docs/DESIGN.md 1200
docs/README.md 300
docs/DOCUMENTATION-CHECKLIST.md 300
EOF

# Relative markdown links ](path) or ](path#anchor) must point at existing files.
for md in README.md *.md docs/*.md contracts/README.md mobile/README.md; do
  dir=$(dirname "$md")
  grep -oE '\]\([^)#[:space:]]+' "$md" | sed 's/^](//' | grep -vE '^(https?:|mailto:)' | sort -u | while read -r target; do
    path="$dir/$(printf '%b' "${target//%/\\x}")"
    [ -e "$path" ] || echo "BROKEN   $md -> $target"
  done
done | tee /dev/stderr | grep -q BROKEN && fail=1

exit $fail
