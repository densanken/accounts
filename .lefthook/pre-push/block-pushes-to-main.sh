#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../lib/remote-org.sh"

remote_name="${1:-origin}"
remote_url="${2:-}"

if ! has_densanken_remote "$remote_name" "$remote_url"; then
  exit 0
fi

# main ブランチへの push を禁止
target_main=false
while read -r local_ref _ remote_ref _; do
  if [ "$local_ref" = "refs/heads/main" ] || [ "$remote_ref" = "refs/heads/main" ]; then
    target_main=true
    break
  fi
done

if [ "$target_main" = true ]; then
  printf '\033[31m%s\033[0m\n%s\n%s\033[34m%s\033[0m%s\n%s\033[34m%s\033[0m%s\n' \
    "main ブランチへの push は禁止されています。" \
    "別のブランチを push してください。" \
    "新たにブランチを作成する場合は " \
    "git switch -c <新たなブランチ名>" \
    " で行うことができます。" \
    "なお、直前の commit を取り消したい場合は " \
    "git reset --soft HEAD^" \
    " で行うことができます。"
  exit 1
fi
