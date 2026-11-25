#!/usr/bin/env bash
# Applies the migrations to a throwaway database on a local Postgres 15+ and runs the SQL tests.
# Usage: PGHOST=/tmp/pg PGPORT=54329 PGUSER=postgres ./supabase/tests/run_local_tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="bw_test_$$"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do echo "applying $f"; psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/10_rls_and_rules.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/20_forecast.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/30_categories.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/40_item_form.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/50_category_groups.test.sql
