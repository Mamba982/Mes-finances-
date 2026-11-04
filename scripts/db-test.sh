#!/usr/bin/env bash
# Démarre un Postgres 16 local pour les tests RLS et affiche la variable à exporter.
# Usage : eval "$(bash scripts/db-test.sh)"
set -euo pipefail
PORT="${PGPORT_TEST:-54329}"
DIR="${PGDATA_TEST:-/tmp/mes-finances-pg}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
run() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
if [ ! -f "$DIR/PG_VERSION" ]; then
  mkdir -p "$DIR"; [ "$(id -u)" = "0" ] && chown postgres:postgres "$DIR"
  run "$BIN/initdb -D $DIR -U postgres --auth=trust -E UTF8 >/dev/null"
fi
if ! run "$BIN/pg_isready -h 127.0.0.1 -p $PORT >/dev/null 2>&1"; then
  run "$BIN/pg_ctl -D $DIR -o '-p $PORT -k /tmp' -l $DIR/journal.log start >/dev/null"
  for _ in $(seq 1 30); do run "$BIN/pg_isready -h 127.0.0.1 -p $PORT >/dev/null 2>&1" && break; sleep 0.3; done
fi
run "$BIN/psql -h 127.0.0.1 -p $PORT -U postgres -tc \"select 1 from pg_database where datname='mes_finances_test'\" | grep -q 1 || $BIN/createdb -h 127.0.0.1 -p $PORT -U postgres mes_finances_test"
echo "export DATABASE_URL_TEST=postgres://postgres@127.0.0.1:$PORT/mes_finances_test"
