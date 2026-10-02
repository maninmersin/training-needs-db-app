-- Applied by db/migrate.js after every run (idempotent). Ensures every object created by
-- migrations is reachable through PostgREST exactly as on Supabase (grants only - RLS
-- still restricts rows).

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Ask PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
