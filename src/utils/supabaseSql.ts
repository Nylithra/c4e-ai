/**
 * The canonical Supabase setup script shown in Settings → Database.
 *
 * It is imported verbatim from `supabase_schema.sql` in the repository root so there is a
 * single source of truth: the script users paste into the Supabase SQL editor is exactly the
 * hardened schema (restrictive RLS policies, privilege-protecting triggers and read-only
 * grants for the anonymous role) that ships with the codebase.
 */
import schemaSql from '../../supabase_schema.sql?raw';

export const SUPABASE_SETUP_SQL: string = schemaSql;
