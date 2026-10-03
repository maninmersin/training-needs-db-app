-- Baseline schema pulled from Supabase on 2026-10-02 by db/pull-from-supabase.js
-- Structure only (no data). Do not edit - add new numbered migrations instead.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS public;








CREATE OR REPLACE FUNCTION "public"."bulk_assign_courses"("p_project_id" "uuid", "p_user_ids" integer[], "p_course_ids" "text"[], "p_assigned_by" "text" DEFAULT 'bulk'::"text", "p_replace_mode" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id INTEGER;
    v_course_id TEXT;
    v_count INTEGER := 0;
BEGIN
    -- If replace mode, delete existing assignments for these users
    IF p_replace_mode THEN
        DELETE FROM user_course_mappings
        WHERE end_user_id = ANY(p_user_ids)
            AND project_id = p_project_id;
    END IF;

    -- Insert new assignments
    FOREACH v_user_id IN ARRAY p_user_ids
    LOOP
        FOREACH v_course_id IN ARRAY p_course_ids
        LOOP
            INSERT INTO user_course_mappings (
                project_id,
                end_user_id,
                course_id,
                assigned_by,
                assigned_date
            ) VALUES (
                p_project_id,
                v_user_id,
                v_course_id,
                p_assigned_by,
                NOW()
            )
            ON CONFLICT (end_user_id, course_id) DO NOTHING;

            IF FOUND THEN
                v_count := v_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN v_count;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."get_course_users"("p_course_id" "text", "p_project_id" "uuid") RETURNS TABLE("end_user_id" integer, "name" "text", "email" "text", "project_role" "text", "training_location" "text", "assigned_by" "text", "assigned_date" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        eu.id,
        eu.name,
        eu.email,
        eu.project_role,
        eu.training_location,
        ucm.assigned_by,
        ucm.assigned_date
    FROM user_course_mappings ucm
    JOIN end_users eu ON ucm.end_user_id = eu.id
    WHERE ucm.course_id = p_course_id
        AND ucm.project_id = p_project_id
    ORDER BY eu.name;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."get_distinct_functional_areas"("p_project_id" "uuid") RETURNS TABLE("functional_area" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT td.functional_area
  FROM training_data td
  WHERE td.project_id = p_project_id
    AND td.functional_area IS NOT NULL
  ORDER BY td.functional_area;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."get_distinct_training_locations"("p_project_id" "uuid") RETURNS TABLE("training_location" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT td.training_location
  FROM training_data td
  WHERE td.project_id = p_project_id
    AND td.training_location IS NOT NULL
  ORDER BY td.training_location;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."get_project_courses"("p_project_id" "uuid") RETURNS TABLE("course_id" "text", "course_name" "text", "duration_hrs" numeric, "functional_area" "text", "course_topic" "text", "course_priority" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    td.course_id,
    td.course_name,
    td.duration_hrs,
    td.functional_area,
    td.course_topic,
    td.course_priority
  FROM training_data td
  WHERE td.project_id = p_project_id
  ORDER BY td.course_id;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."get_project_users"("p_project_id" "uuid") RETURNS TABLE("user_id" "text", "user_name" "text", "user_email" "text", "training_location" "text", "user_project_role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    td.user_id,
    td.user_name,
    td.user_email,
    td.training_location,
    td.user_project_role
  FROM training_data td
  WHERE td.project_id = p_project_id
  ORDER BY td.user_name;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."get_training_data_stats"("p_project_id" "uuid") RETURNS TABLE("total_assignments" integer, "unique_users" integer, "unique_courses" integer, "unique_locations" integer, "unique_functional_areas" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_assignments,
    COUNT(DISTINCT td.user_id)::INTEGER AS unique_users,
    COUNT(DISTINCT td.course_id)::INTEGER AS unique_courses,
    COUNT(DISTINCT td.training_location)::INTEGER AS unique_locations,
    COUNT(DISTINCT td.functional_area)::INTEGER AS unique_functional_areas
  FROM training_data td
  WHERE td.project_id = p_project_id;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."get_user_courses"("p_end_user_id" integer) RETURNS TABLE("course_id" "text", "course_name" "text", "functional_area" "text", "duration_hrs" numeric, "assigned_by" "text", "assigned_date" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.course_id,
        c.course_name,
        c.functional_area,
        c.duration_hrs,
        ucm.assigned_by,
        ucm.assigned_date
    FROM user_course_mappings ucm
    JOIN courses c ON ucm.course_id = c.course_id
    WHERE ucm.end_user_id = p_end_user_id
    ORDER BY c.course_id;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."update_auth_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."update_training_data_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;



SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."training_locations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true,
    "display_order" integer DEFAULT 999,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "project_id" "uuid"
);




CREATE OR REPLACE VIEW "public"."active_training_locations" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "display_order",
    "project_id",
    "active" AS "is_active",
    "created_at",
    "updated_at"
   FROM "public"."training_locations"
  WHERE ("active" = true)
  ORDER BY "display_order", "name";




CREATE TABLE IF NOT EXISTS "public"."auth_email_verification_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."auth_login_audit" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "success" boolean NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "failure_reason" "text",
    "attempted_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."auth_password_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "password_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."auth_permissions" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);




ALTER TABLE "public"."auth_permissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."auth_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."auth_rate_limiting" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "identifier" "text" NOT NULL,
    "attempt_count" integer DEFAULT 1,
    "first_attempt_at" timestamp with time zone DEFAULT "now"(),
    "last_attempt_at" timestamp with time zone DEFAULT "now"(),
    "blocked_until" timestamp with time zone
);




CREATE TABLE IF NOT EXISTS "public"."auth_role_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" integer NOT NULL,
    "permission_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."auth_roles" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);




ALTER TABLE "public"."auth_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."auth_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."auth_two_factor_auth" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "secret" "text" NOT NULL,
    "enabled" boolean DEFAULT false,
    "backup_codes" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."auth_user_functional_areas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "functional_area_id" integer,
    "can_view" boolean DEFAULT true,
    "can_edit" boolean DEFAULT false,
    "can_delete" boolean DEFAULT false,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid"
);




CREATE TABLE IF NOT EXISTS "public"."auth_user_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "can_view" boolean DEFAULT true,
    "can_edit" boolean DEFAULT false,
    "can_delete" boolean DEFAULT false,
    "can_export" boolean DEFAULT false,
    "functional_area_names" "text"[],
    "training_location_names" "text"[],
    "project_ids" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."auth_user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" integer NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid"
);




CREATE TABLE IF NOT EXISTS "public"."auth_user_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_token" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."auth_users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_type" "text" DEFAULT 'standard'::"text",
    "is_super_admin" boolean DEFAULT false
);




CREATE TABLE IF NOT EXISTS "public"."courses" (
    "course_id" "text" NOT NULL,
    "functional_area" "text" NOT NULL,
    "duration_hrs" numeric NOT NULL,
    "course_name" "text",
    "application" "text",
    "priority" integer DEFAULT 1 NOT NULL,
    "project_id" "uuid"
);




CREATE TABLE IF NOT EXISTS "public"."end_users" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "job_title" "text",
    "country" "text",
    "division" "text",
    "sub_division" "text",
    "training_location" "text",
    "project_role" "text",
    "project_id" "uuid",
    "location_name" "text"
);




CREATE TABLE IF NOT EXISTS "public"."functional_areas" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true,
    "display_order" integer DEFAULT 999,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "project_id" "uuid"
);




ALTER TABLE "public"."functional_areas" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."functional_areas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."project_roles" (
    "id" integer NOT NULL,
    "role_name" character varying(100) NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true,
    "display_order" integer DEFAULT 999,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "project_id" "uuid"
);




ALTER TABLE "public"."project_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."project_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."project_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);




CREATE OR REPLACE VIEW "public"."projects_with_stats" AS
 SELECT "id",
    "name",
    "name" AS "title",
    "description",
    "is_active",
    "created_at",
    "updated_at",
    0 AS "member_count",
    0 AS "schedule_count",
    0 AS "course_count",
    0 AS "user_count",
    0 AS "training_data_count"
   FROM "public"."projects";




CREATE TABLE IF NOT EXISTS "public"."role_course_mappings" (
    "id" integer NOT NULL,
    "project_id" "uuid",
    "role_name" "text" NOT NULL,
    "course_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);




CREATE SEQUENCE IF NOT EXISTS "public"."role_course_mappings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;




ALTER SEQUENCE "public"."role_course_mappings_id_seq" OWNED BY "public"."role_course_mappings"."id";



CREATE TABLE IF NOT EXISTS "public"."training_data" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "user_email" "text",
    "business_unit" "text",
    "organization" "text",
    "user_country" "text",
    "user_department" "text",
    "user_job_title" "text",
    "user_location" "text",
    "training_location" "text" NOT NULL,
    "user_project_role" "text",
    "course_id" "text" NOT NULL,
    "course_name" "text" NOT NULL,
    "duration_hrs" numeric NOT NULL,
    "course_topic" "text",
    "course_sub_topic" "text",
    "course_application" "text",
    "course_priority" integer DEFAULT 1,
    "functional_area" "text" NOT NULL,
    "sub_functional_area" "text",
    "functional_area_short" "text",
    "project_id" "uuid" NOT NULL,
    "assigned_by" "text" DEFAULT 'import'::"text",
    "assigned_date" timestamp with time zone DEFAULT "now"(),
    "assignment_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);




ALTER TABLE "public"."training_locations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."training_locations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."training_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "version" "text" DEFAULT "to_char"("now"(), 'YYYYMMDDHH24MISS'::"text"),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "signed_off" boolean DEFAULT false,
    "criteria" "jsonb",
    "project_id" "uuid",
    "description" "text",
    "functional_areas" "text"[],
    "training_locations" "text"[],
    "status" "text" DEFAULT 'draft'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "scheduled_start_date" "date",
    "scheduled_end_date" "date"
);




CREATE TABLE IF NOT EXISTS "public"."training_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "course_id" "text" NOT NULL,
    "session_date" "date",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "duration_hrs" numeric,
    "training_location" "text",
    "max_attendees" integer,
    "assigned_attendees" integer DEFAULT 0,
    "project_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "classroom_number" integer,
    "session_identifier" "text",
    "group_identifier" "text",
    "session_number" integer,
    "session_part_number" integer DEFAULT 1,
    "part_suffix" "text",
    "user_count" integer,
    "user_range" "text",
    "max_participants" integer,
    "status" "text" DEFAULT 'scheduled'::"text",
    "notes" "text",
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "course_day_sequence" integer,
    "course_name" "text",
    "delivery_method" "text",
    "end_datetime" timestamp with time zone,
    "functional_area" "text",
    "group_name" "text",
    "is_multi_day_course" boolean,
    "part_of_total" "text",
    "session_status" "text" DEFAULT 'scheduled'::"text",
    "session_title" "text",
    "start_datetime" timestamp with time zone,
    "group_type" "text",
    "total_parts" integer,
    "instructor_id" integer DEFAULT 0,
    "instructor_name" "text" DEFAULT ''::"text"
);




COMMENT ON COLUMN "public"."training_sessions"."instructor_id" IS 'Instructor assignment ID - 0 = unassigned. To be implemented in future instructor management feature.';



COMMENT ON COLUMN "public"."training_sessions"."instructor_name" IS 'Instructor name - empty string = unassigned. To be implemented in future instructor management feature.';



CREATE TABLE IF NOT EXISTS "public"."user_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "end_user_id" integer NOT NULL,
    "course_id" "text" NOT NULL,
    "assignment_status" "text" DEFAULT 'assigned'::"text",
    "project_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "schedule_id" "uuid",
    "session_identifier" "text",
    "user_id" integer,
    "user_name" "text",
    "user_email" "text",
    "training_location" "text",
    "functional_area" "text",
    "assignment_date" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "text" DEFAULT 'system'::"text",
    "assignment_level" "text" DEFAULT 'session'::"text",
    "group_identifier" "text",
    "assignment_method" "text" DEFAULT 'auto'::"text",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assignment_source" "text" DEFAULT 'automatic'::"text",
    "exception_reason" "text",
    "completion_date" timestamp with time zone,
    "completion_status" "text" DEFAULT 'pending'::"text",
    "assignment_type" "text" DEFAULT 'standard'::"text",
    "notes" "text",
    "attendance_status" "text" DEFAULT 'not_attended'::"text",
    "attendance_date" timestamp with time zone,
    "attendance_notes" "text"
);




CREATE TABLE IF NOT EXISTS "public"."user_course_mappings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "end_user_id" integer NOT NULL,
    "course_id" "text" NOT NULL,
    "assigned_by" "text" DEFAULT 'admin'::"text" NOT NULL,
    "assigned_date" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);




ALTER TABLE ONLY "public"."role_course_mappings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."role_course_mappings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."auth_email_verification_tokens"
    ADD CONSTRAINT "auth_email_verification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_email_verification_tokens"
    ADD CONSTRAINT "auth_email_verification_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."auth_login_audit"
    ADD CONSTRAINT "auth_login_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_password_history"
    ADD CONSTRAINT "auth_password_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_permissions"
    ADD CONSTRAINT "auth_permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."auth_permissions"
    ADD CONSTRAINT "auth_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_rate_limiting"
    ADD CONSTRAINT "auth_rate_limiting_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "public"."auth_rate_limiting"
    ADD CONSTRAINT "auth_rate_limiting_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_role_permissions"
    ADD CONSTRAINT "auth_role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_role_permissions"
    ADD CONSTRAINT "auth_role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id");



ALTER TABLE ONLY "public"."auth_roles"
    ADD CONSTRAINT "auth_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."auth_roles"
    ADD CONSTRAINT "auth_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_two_factor_auth"
    ADD CONSTRAINT "auth_two_factor_auth_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_two_factor_auth"
    ADD CONSTRAINT "auth_two_factor_auth_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."auth_user_functional_areas"
    ADD CONSTRAINT "auth_user_functional_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_user_functional_areas"
    ADD CONSTRAINT "auth_user_functional_areas_user_id_functional_area_id_key" UNIQUE ("user_id", "functional_area_id");



ALTER TABLE ONLY "public"."auth_user_permissions"
    ADD CONSTRAINT "auth_user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_user_permissions"
    ADD CONSTRAINT "auth_user_permissions_user_id_resource_type_key" UNIQUE ("user_id", "resource_type");



ALTER TABLE ONLY "public"."auth_user_roles"
    ADD CONSTRAINT "auth_user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_user_roles"
    ADD CONSTRAINT "auth_user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."auth_user_sessions"
    ADD CONSTRAINT "auth_user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_user_sessions"
    ADD CONSTRAINT "auth_user_sessions_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."auth_users"
    ADD CONSTRAINT "auth_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."auth_users"
    ADD CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id");



ALTER TABLE ONLY "public"."end_users"
    ADD CONSTRAINT "end_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."functional_areas"
    ADD CONSTRAINT "functional_areas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_roles"
    ADD CONSTRAINT "project_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_users"
    ADD CONSTRAINT "project_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_users"
    ADD CONSTRAINT "project_users_project_id_user_id_key" UNIQUE ("project_id", "user_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_course_mappings"
    ADD CONSTRAINT "role_course_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_data"
    ADD CONSTRAINT "training_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_locations"
    ADD CONSTRAINT "training_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_schedules"
    ADD CONSTRAINT "training_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_course_mappings"
    ADD CONSTRAINT "unique_user_course" UNIQUE ("end_user_id", "course_id");



ALTER TABLE ONLY "public"."training_data"
    ADD CONSTRAINT "unique_user_course_project" UNIQUE ("user_id", "course_id", "project_id");



ALTER TABLE ONLY "public"."user_assignments"
    ADD CONSTRAINT "unique_user_session" UNIQUE ("session_id", "end_user_id");



ALTER TABLE ONLY "public"."user_assignments"
    ADD CONSTRAINT "user_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_course_mappings"
    ADD CONSTRAINT "user_course_mappings_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_auth_login_audit_attempted_at" ON "public"."auth_login_audit" USING "btree" ("attempted_at");



CREATE INDEX "idx_auth_login_audit_success" ON "public"."auth_login_audit" USING "btree" ("success");



CREATE INDEX "idx_auth_login_audit_user_id" ON "public"."auth_login_audit" USING "btree" ("user_id");



CREATE INDEX "idx_auth_password_history_user_id" ON "public"."auth_password_history" USING "btree" ("user_id");



CREATE INDEX "idx_auth_rate_limiting_identifier" ON "public"."auth_rate_limiting" USING "btree" ("identifier");



CREATE INDEX "idx_auth_role_permissions_permission_id" ON "public"."auth_role_permissions" USING "btree" ("permission_id");



CREATE INDEX "idx_auth_role_permissions_role_id" ON "public"."auth_role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_auth_user_functional_areas_functional_area_id" ON "public"."auth_user_functional_areas" USING "btree" ("functional_area_id");



CREATE INDEX "idx_auth_user_functional_areas_user_id" ON "public"."auth_user_functional_areas" USING "btree" ("user_id");



CREATE INDEX "idx_auth_user_permissions_resource_type" ON "public"."auth_user_permissions" USING "btree" ("resource_type");



CREATE INDEX "idx_auth_user_permissions_user_id" ON "public"."auth_user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_auth_user_roles_role_id" ON "public"."auth_user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_auth_user_roles_user_id" ON "public"."auth_user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_auth_user_sessions_expires_at" ON "public"."auth_user_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_auth_user_sessions_session_token" ON "public"."auth_user_sessions" USING "btree" ("session_token");



CREATE INDEX "idx_auth_user_sessions_user_id" ON "public"."auth_user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_auth_users_email" ON "public"."auth_users" USING "btree" ("email");



CREATE INDEX "idx_auth_users_is_active" ON "public"."auth_users" USING "btree" ("is_active");



CREATE INDEX "idx_courses_functional_area" ON "public"."courses" USING "btree" ("functional_area");



CREATE INDEX "idx_courses_project_id" ON "public"."courses" USING "btree" ("project_id");



CREATE INDEX "idx_end_users_email" ON "public"."end_users" USING "btree" ("email");



CREATE INDEX "idx_end_users_project_id" ON "public"."end_users" USING "btree" ("project_id");



CREATE INDEX "idx_role_course_mappings_project_id" ON "public"."role_course_mappings" USING "btree" ("project_id");



CREATE INDEX "idx_training_data_course_id" ON "public"."training_data" USING "btree" ("course_id");



CREATE INDEX "idx_training_data_functional_area" ON "public"."training_data" USING "btree" ("functional_area");



CREATE INDEX "idx_training_data_project_id" ON "public"."training_data" USING "btree" ("project_id");



CREATE INDEX "idx_training_data_project_location" ON "public"."training_data" USING "btree" ("project_id", "training_location");



CREATE INDEX "idx_training_data_training_location" ON "public"."training_data" USING "btree" ("training_location");



CREATE INDEX "idx_training_data_user_id" ON "public"."training_data" USING "btree" ("user_id");



CREATE INDEX "idx_training_schedules_created_at" ON "public"."training_schedules" USING "btree" ("created_at");



CREATE INDEX "idx_training_schedules_project_id" ON "public"."training_schedules" USING "btree" ("project_id");



CREATE INDEX "idx_training_sessions_course_id" ON "public"."training_sessions" USING "btree" ("course_id");



CREATE INDEX "idx_training_sessions_group_identifier" ON "public"."training_sessions" USING "btree" ("group_identifier");



CREATE INDEX "idx_training_sessions_project_id" ON "public"."training_sessions" USING "btree" ("project_id");



CREATE INDEX "idx_training_sessions_schedule_id" ON "public"."training_sessions" USING "btree" ("schedule_id");



CREATE INDEX "idx_training_sessions_session_identifier" ON "public"."training_sessions" USING "btree" ("session_identifier");



CREATE INDEX "idx_training_sessions_start_datetime" ON "public"."training_sessions" USING "btree" ("start_datetime");



CREATE INDEX "idx_user_assignments_course_id" ON "public"."user_assignments" USING "btree" ("course_id");



CREATE INDEX "idx_user_assignments_project_id" ON "public"."user_assignments" USING "btree" ("project_id");



CREATE INDEX "idx_user_assignments_schedule_id" ON "public"."user_assignments" USING "btree" ("schedule_id");



CREATE INDEX "idx_user_assignments_session_id" ON "public"."user_assignments" USING "btree" ("session_id");



CREATE INDEX "idx_user_assignments_session_identifier" ON "public"."user_assignments" USING "btree" ("session_identifier");



CREATE INDEX "idx_user_assignments_user_id" ON "public"."user_assignments" USING "btree" ("end_user_id");



CREATE INDEX "idx_user_course_mappings_course_id" ON "public"."user_course_mappings" USING "btree" ("course_id");



CREATE INDEX "idx_user_course_mappings_end_user_id" ON "public"."user_course_mappings" USING "btree" ("end_user_id");



CREATE INDEX "idx_user_course_mappings_project_id" ON "public"."user_course_mappings" USING "btree" ("project_id");



CREATE INDEX "idx_user_course_mappings_project_user" ON "public"."user_course_mappings" USING "btree" ("project_id", "end_user_id");



CREATE OR REPLACE TRIGGER "training_data_updated_at" BEFORE UPDATE ON "public"."training_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_training_data_updated_at"();



CREATE OR REPLACE TRIGGER "update_auth_roles_updated_at" BEFORE UPDATE ON "public"."auth_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_auth_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_auth_two_factor_auth_updated_at" BEFORE UPDATE ON "public"."auth_two_factor_auth" FOR EACH ROW EXECUTE FUNCTION "public"."update_auth_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_auth_users_updated_at" BEFORE UPDATE ON "public"."auth_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_auth_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_functional_areas_updated_at" BEFORE UPDATE ON "public"."functional_areas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_roles_updated_at" BEFORE UPDATE ON "public"."project_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_training_locations_updated_at" BEFORE UPDATE ON "public"."training_locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "user_course_mappings_updated_at" BEFORE UPDATE ON "public"."user_course_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."auth_email_verification_tokens"
    ADD CONSTRAINT "auth_email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_login_audit"
    ADD CONSTRAINT "auth_login_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auth_password_history"
    ADD CONSTRAINT "auth_password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_role_permissions"
    ADD CONSTRAINT "auth_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."auth_permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_role_permissions"
    ADD CONSTRAINT "auth_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_two_factor_auth"
    ADD CONSTRAINT "auth_two_factor_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_user_functional_areas"
    ADD CONSTRAINT "auth_user_functional_areas_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."auth_users"("id");



ALTER TABLE ONLY "public"."auth_user_functional_areas"
    ADD CONSTRAINT "auth_user_functional_areas_functional_area_id_fkey" FOREIGN KEY ("functional_area_id") REFERENCES "public"."functional_areas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_user_functional_areas"
    ADD CONSTRAINT "auth_user_functional_areas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_user_permissions"
    ADD CONSTRAINT "auth_user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_user_roles"
    ADD CONSTRAINT "auth_user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."auth_users"("id");



ALTER TABLE ONLY "public"."auth_user_roles"
    ADD CONSTRAINT "auth_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_user_roles"
    ADD CONSTRAINT "auth_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_user_sessions"
    ADD CONSTRAINT "auth_user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auth_users"
    ADD CONSTRAINT "auth_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."end_users"
    ADD CONSTRAINT "end_users_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."functional_areas"
    ADD CONSTRAINT "functional_areas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_roles"
    ADD CONSTRAINT "project_roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_users"
    ADD CONSTRAINT "project_users_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_course_mappings"
    ADD CONSTRAINT "role_course_mappings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_data"
    ADD CONSTRAINT "training_data_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_locations"
    ADD CONSTRAINT "training_locations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_schedules"
    ADD CONSTRAINT "training_schedules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."training_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_assignments"
    ADD CONSTRAINT "user_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_assignments"
    ADD CONSTRAINT "user_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."training_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_course_mappings"
    ADD CONSTRAINT "user_course_mappings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("course_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_course_mappings"
    ADD CONSTRAINT "user_course_mappings_end_user_id_fkey" FOREIGN KEY ("end_user_id") REFERENCES "public"."end_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_course_mappings"
    ADD CONSTRAINT "user_course_mappings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated users full access" ON "public"."courses" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."functional_areas" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."project_users" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."role_course_mappings" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."training_data" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."training_locations" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."training_schedules" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."training_sessions" USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow authenticated users full access" ON "public"."user_assignments" USING ((("auth"."uid"() IS NOT NULL) AND ("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true)))))) WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true))))));



CREATE POLICY "Authenticated users can view permissions" ON "public"."auth_permissions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view role permissions" ON "public"."auth_role_permissions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can view roles" ON "public"."auth_roles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete mappings for their projects" ON "public"."user_course_mappings" FOR DELETE USING (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true) AND ("pu"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Users can delete their own sessions" ON "public"."auth_user_sessions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert mappings for their projects" ON "public"."user_course_mappings" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true) AND ("pu"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Users can update mappings for their projects" ON "public"."user_course_mappings" FOR UPDATE USING (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true) AND ("pu"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Users can update their own 2FA settings" ON "public"."auth_two_factor_auth" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own permissions" ON "public"."auth_user_permissions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."auth_users" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view data for their projects" ON "public"."end_users" FOR SELECT USING (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true)))));



CREATE POLICY "Users can view data for their projects" ON "public"."project_roles" FOR SELECT USING (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true)))));



CREATE POLICY "Users can view data for their projects" ON "public"."training_schedules" FOR SELECT USING (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true)))));



CREATE POLICY "Users can view data for their projects" ON "public"."user_assignments" FOR SELECT USING (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true)))));



CREATE POLICY "Users can view mappings for their projects" ON "public"."user_course_mappings" FOR SELECT USING (("project_id" IN ( SELECT "pu"."project_id"
   FROM "public"."project_users" "pu"
  WHERE (("pu"."user_id" = "auth"."uid"()) AND ("pu"."is_active" = true)))));



CREATE POLICY "Users can view their own 2FA settings" ON "public"."auth_two_factor_auth" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own functional areas" ON "public"."auth_user_functional_areas" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own login audit" ON "public"."auth_login_audit" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own password history" ON "public"."auth_password_history" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own permissions" ON "public"."auth_user_permissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."auth_users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view their own roles" ON "public"."auth_user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own sessions" ON "public"."auth_user_sessions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their projects" ON "public"."projects" FOR SELECT USING (("id" IN ( SELECT "project_users"."project_id"
   FROM "public"."project_users"
  WHERE (("project_users"."user_id" = "auth"."uid"()) AND ("project_users"."is_active" = true)))));



ALTER TABLE "public"."auth_email_verification_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_login_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_password_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_rate_limiting" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_two_factor_auth" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_user_functional_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."end_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."functional_areas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_course_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_course_mappings" ENABLE ROW LEVEL SECURITY;






























































































































































