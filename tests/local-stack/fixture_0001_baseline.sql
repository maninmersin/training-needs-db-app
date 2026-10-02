-- Test fixture: a cut-down schema in the style of a cleaned Supabase dump (see
-- db/pull-from-supabase.js cleanDump). Used only by tests/local-stack/run.mjs.
SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS "public"."auth_users" ("id" uuid PRIMARY KEY, "email" text NOT NULL, "password_hash" text NOT NULL, "is_verified" boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS "public"."auth_roles" ("id" serial PRIMARY KEY, "name" text UNIQUE NOT NULL, "description" text);
CREATE TABLE IF NOT EXISTS "public"."auth_user_roles" ("user_id" uuid REFERENCES "public"."auth_users"("id") ON DELETE CASCADE, "role_id" int REFERENCES "public"."auth_roles"("id"), PRIMARY KEY ("user_id","role_id"));
CREATE TABLE IF NOT EXISTS "public"."projects" ("id" uuid DEFAULT "extensions"."uuid_generate_v4"() PRIMARY KEY, "name" text NOT NULL, "description" text, "is_active" boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS "public"."project_users" ("id" uuid DEFAULT "extensions"."uuid_generate_v4"() PRIMARY KEY, "project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE, "user_id" uuid NOT NULL, "role" text DEFAULT 'member' NOT NULL, "is_active" boolean DEFAULT true, UNIQUE ("project_id","user_id"));
CREATE TABLE IF NOT EXISTS "public"."end_users" ("id" serial PRIMARY KEY, "project_id" uuid REFERENCES "public"."projects"("id"), "name" text);
CREATE OR REPLACE FUNCTION "public"."get_my_project_count"() RETURNS integer LANGUAGE sql STABLE AS $$ SELECT count(*)::int FROM public.project_users WHERE user_id = auth.uid() $$;
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."end_users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memberships" ON "public"."project_users" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "member projects" ON "public"."projects" FOR SELECT USING (("id" IN (SELECT "pu"."project_id" FROM "public"."project_users" "pu" WHERE "pu"."user_id" = "auth"."uid"())));
CREATE POLICY "member end users" ON "public"."end_users" USING (("project_id" IN (SELECT "pu"."project_id" FROM "public"."project_users" "pu" WHERE "pu"."user_id" = "auth"."uid"() AND "pu"."is_active")));
RESET ALL;
