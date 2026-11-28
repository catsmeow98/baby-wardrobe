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
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/60_prefs_gender.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/70_settings_color_outfits.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/90_current_size_range.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/95_trips.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/97_orders.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/98_trip_items.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/99_tags.test.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "do \$\$ begin if (select count(*) from public.categories where owner_id is null and name in ('Warm hat / beanie', 'Sun hat')) <> 2 or exists (select 1 from public.categories where owner_id is null and name = 'Hat') then raise exception 'hats migration failed'; end if; end \$\$; select 'HATS OK';"

# Upgrade check: a database that has only migrations 01 to 11, with an account like a real one, then migration 12.
DB2="bw_upgrade_$$"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB2"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null; psql -q -d postgres -c "drop database if exists $DB2" >/dev/null' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do case "$f" in *000012*|*000013*|*000014*|*000015*|*000016*|*000017*|*000018*|*000019*|*000020*|*000021*|*000022*) ;; *) psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f "$f" ;; esac; done
psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f tests/80_upgrade_12.test.sql

# Migration 17 on top of the upgraded database, twice (it must be safe to re-run).
for n in 1 2; do psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f migrations/20260101000017_current_size_range.sql; done
for n in 1 2; do psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f migrations/20260101000018_trips_needing_photos.sql; done
for n in 1 2; do psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f migrations/20260101000019_named_orders.sql; done
for n in 1 2; do psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f migrations/20260101000020_trip_items_and_not_purchased.sql; done
for n in 1 2; do psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f migrations/20260101000021_tags.sql; done
for n in 1 2; do psql -v ON_ERROR_STOP=1 -q -d "$DB2" -f migrations/20260101000022_hats.sql; done
echo "migrations 17 to 22 applied twice on the upgraded database"
