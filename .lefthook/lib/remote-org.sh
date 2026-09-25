#!/usr/bin/env bash

# ホスト名は SSH エイリアスなどで変わりうるため、パスの owner が densanken かどうかで判定する
has_densanken_remote() {
  local remote_name="${1:-origin}"
  local remote_url="${2:-}"

  if [ -z "$remote_url" ]; then
    remote_url="$(git remote get-url "$remote_name" 2>/dev/null || true)"
  fi

  # 大文字小文字の揺れを吸収する
  remote_url="$(printf '%s' "$remote_url" | tr '[:upper:]' '[:lower:]')"

  case "$remote_url" in
    *[:/]densanken/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}
