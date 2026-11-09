-- 001 · Extensions
-- PostGIS powers distance search and the coarse public location (SRS §4.4).
-- pgcrypto is used by seed.sql to hash demo passwords.
-- Both live in the `extensions` schema, as on every Supabase project.

create schema if not exists extensions;

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
