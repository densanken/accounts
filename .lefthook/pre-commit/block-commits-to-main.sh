#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/../lib/remote-org.sh"

# fork 先では main への commit を許可するため、origin のみで判定する
if ! has_densanken_remote origin; then
  exit 0
fi

# main ブランチへのコミットを禁止
if [ "$(git branch --show-current)" = "main" ]; then
  printf '\033[31m%s\033[0m\n%s\n%s\033[34m%s\033[0m%s\n' \
    "main ブランチへの commit は禁止されています。" \
    "別のブランチへ commit してください。" \
    "新たにブランチを作成する場合は " \
    "git switch -c <新しいブランチ名>" \
    " で行うことができます。"
  exit 1
fi
