#!/bin/sh
set -eu

if [ "${1:-}" = "node" ] && [ "${2:-}" = "server.js" ]; then
  mkdir -p /dynamic
  if [ ! -f /dynamic/bootstrap.yml ]; then
    cp /app/bootstrap.yml /dynamic/bootstrap.yml.tmp
    mv /dynamic/bootstrap.yml.tmp /dynamic/bootstrap.yml
  fi
fi

exec "$@"
