import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySqlFix() {
  try {
    console.log('Applying SQL fix for attendance function...');
    
    const sqlFix = `
CREATE OR REPLACE FUNCTION get_session_attendance_summary(p_session_id UUID, p_project_id UUID)
RETURNS TABLE (
    total_registered INTEGER,
    total_attended INTEGER,
    total_absent INTEGER,
    attendance_rate DECIMAL(5,2),
    status_breakdown JSONB
) AS $$
DECLARE
    total_reg INTEGER := 0;
    total_att INTEGER := 0;
    total_abs INTEGER := 0;
    att_rate DECIMAL(5,2) := 0;
    status_json JSONB := '{}';
BEGIN
    -- Get total registered attendees
    SELECT COUNT(*) INTO total_reg
    FROM session_attendees sa
    WHERE sa.session_id = p_session_id 
      AND sa.project_id = p_project_id;

    -- Get attendance statistics
    SELECT 
        COALESCE(COUNT(CASE WHEN ast.is_present THEN 1 END), 0),
        COALESCE(COUNT(CASE WHEN NOT ast.is_present THEN 1 END), 0)
    INTO total_att, total_abs
    FROM session_attendees sa
    LEFT JOIN attendance_records ar ON sa.session_id = ar.session_id AND sa.attendee_id = ar.attendee_id
    LEFT JOIN attendance_statuses ast ON ar.attendance_status_id = ast.id
    WHERE sa.session_id = p_session_id 
      AND sa.project_id = p_project_id;

    -- Calculate attendance rate
    IF total_att > 0 THEN
        att_rate := ROUND((total_att::DECIMAL / GREATEST(total_reg, 1)) * 100, 2);
    END IF;

    -- Get status breakdown
    SELECT 
        COALESCE(
            jsonb_object_agg(
                COALESCE(ast.status_name, 'Not Marked'), 
                status_count
            ), 
            '{}'::jsonb
        ) INTO status_json
    FROM (
        SELECT 
            ast.status_name,
            COUNT(*) as status_count
        FROM session_attendees sa
        LEFT JOIN attendance_records ar ON sa.session_id = ar.session_id AND sa.attendee_id = ar.attendee_id
        LEFT JOIN attendance_statuses ast ON ar.attendance_status_id = ast.id
        WHERE sa.session_id = p_session_id 
          AND sa.project_id = p_project_id
        GROUP BY ast.status_name
    ) status_counts;

    -- Return results
    RETURN QUERY SELECT 
        total_reg,
        total_att,
        total_abs,
        att_rate,
        status_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { data, error } = await supabase.rpc('exec', { sql: sqlFix });
    
    if (error) {
      console.error('Error applying SQL fix:', error);
    } else {
      console.log('SQL fix applied successfully');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

applySqlFix();