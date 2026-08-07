/**
 * The git hook payload this plugin installs.
 *
 * This file is the source of truth for ~/.githooks/*. The plugin writes these
 * strings out during bootstrap, so editing here + reinstalling is the
 * maintenance path — never hand-edit the installed copies.
 */

/** Hook names we install stubs for, so a global hooksPath shadows nothing. */
export const HOOK_NAMES = [
  "post-checkout",
  "pre-commit",
  "prepare-commit-msg",
  "commit-msg",
  "pre-push",
  "post-merge",
  "pre-rebase",
  "post-rewrite",
] as const;

/** Bumped whenever DISPATCH changes, so the plugin can detect a stale install. */
export const DISPATCH_VERSION = 2;

export const DISPATCH = `#!/usr/bin/env bash
# Shared git hook dispatcher.  bb-plugin-worktree-setup v${DISPATCH_VERSION}
#
# Managed by the Worktree Setup bb plugin — regenerated on bootstrap.
# Edit hooks.ts in the plugin repo, not this file.
#
# Two jobs:
#   1. On post-checkout into a fresh bb worktree, run the matching per-repo
#      setup script from ~/.bb-setup/<repo>.sh.
#   2. Always hand control back to whatever hook the repo itself installed
#      (husky, lefthook, pre-commit), so nothing this file shadows is lost.
#
# Invoked as: _dispatch <hook-name> [original hook args...]

set -uo pipefail

hook_name="$1"; shift

BB_WORKTREE_ROOT="\${BB_WORKTREE_ROOT:-$HOME/.bb/worktrees}"
SETUP_DIR="\${BB_SETUP_DIR:-$HOME/.bb-setup}"
NULL_SHA=0000000000000000000000000000000000000000

run_bb_setup() {
  # post-checkout args: $1=prev-sha $2=new-sha $3=1 if branch checkout
  [ "$#" -ge 3 ] || return 0
  [ "$3" = "1" ] || return 0
  # A brand-new worktree checks out from the null sha. An ordinary
  # \`git checkout\` in an existing tree does not, so this filters those out.
  [ "$1" = "$NULL_SHA" ] || return 0

  local workspace; workspace="$(pwd -P)"
  # Canonicalize the root the same way as the workspace, or a symlink
  # anywhere in the path (e.g. macOS /tmp -> /private/tmp) breaks the compare.
  local root
  root="$(cd "$BB_WORKTREE_ROOT" 2>/dev/null && pwd -P)" || return 0
  case "$workspace" in
    "$root"/*) ;;
    *) return 0 ;;
  esac

  # A repo is identified by its source root, not its directory name: two
  # different repos can share a basename. Prefer the disambiguated key
  # <name>-<hash8>, fall back to the plain readable <name>.
  local name source_root key setup log
  name="$(basename "$workspace")"
  source_root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")"

  key="$name"
  if [ -n "$source_root" ] && [ "$source_root" != "." ]; then
    local hash8
    hash8="$(printf '%s' "$source_root" | shasum -a 256 2>/dev/null | cut -c1-8)"
    [ -n "$hash8" ] && [ -f "$SETUP_DIR/$name-$hash8.sh" ] && key="$name-$hash8"
  fi

  setup="$SETUP_DIR/$key.sh"
  log="$SETUP_DIR/logs/$key.log"
  [ -f "$setup" ] || return 0

  mkdir -p "$SETUP_DIR/logs"
  {
    echo "=== $(date '+%Y-%m-%d %H:%M:%S')  $workspace"
    echo "=== running $setup"
  } >>"$log"

  # Tee output to the log and keep it on stderr so bb's provisioning
  # output shows it too.
  if bash "$setup" "$workspace" 2>&1 | tee -a "$log" >&2; then
    echo "=== ok" >>"$log"
    return 0
  fi
  # tee swallows the real status; recover it from PIPESTATUS.
  local status=\${PIPESTATUS[0]}
  echo "=== FAILED (exit $status)" >>"$log"
  return "$status"
}

if [ "$hook_name" = "post-checkout" ]; then
  # A non-zero exit here becomes the exit status of \`git worktree add\`,
  # which makes bb fail provisioning instead of opening a broken worktree.
  run_bb_setup "$@" || exit $?
fi

# Delegate to the repo's own hook. husky owns .husky/_, and everything else
# lands in the repo's real hooks directory.
git_dir="$(git rev-parse --git-common-dir 2>/dev/null)" || git_dir=""
repo_root="\${git_dir:+$(dirname "$git_dir")}"

for candidate in \\
  "\${repo_root:+$repo_root/.husky/_/$hook_name}" \\
  "\${git_dir:+$git_dir/hooks/$hook_name}"
do
  [ -n "$candidate" ] || continue
  if [ -x "$candidate" ]; then
    exec "$candidate" "$@"
  fi
done

exit 0
`;

export function stub(hookName: string): string {
  return `#!/usr/bin/env bash
exec "$(dirname "$0")/_dispatch" ${hookName} "$@"
`;
}

/** Starter content offered when a repo has no setup script yet. */
export function starterScript(repoName: string): string {
  return `#!/usr/bin/env bash
# Setup for fresh bb worktrees of ${repoName}.
# Runs with cwd = the new worktree; $1 is that path too.
#
# Exit non-zero to abort provisioning (bb will not open a broken worktree).
# Guard anything optional with \`|| true\` so it cannot do that by accident.

set -uo pipefail

workspace="\${1:-$(pwd -P)}"
source_root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"

echo "bb-setup: $workspace"

# --- gitignored files a fresh worktree does not get -------------------------
# Explicit list on purpose: globbing .env* silently misses nested ones.
for rel in .env .env.local; do
  if [ -f "$source_root/$rel" ] && [ ! -f "$workspace/$rel" ]; then
    mkdir -p "$(dirname "$workspace/$rel")"
    cp "$source_root/$rel" "$workspace/$rel" || echo "bb-setup: WARNING could not copy $rel" >&2
  fi
done

# --- dependencies ----------------------------------------------------------
# Fatal on purpose: a worktree without deps is not usable.
if [ -f "$workspace/pnpm-lock.yaml" ]; then
  pnpm install --frozen-lockfile || exit 1
elif [ -f "$workspace/package-lock.json" ]; then
  npm ci || exit 1
fi

echo "bb-setup: done"
`;
}
