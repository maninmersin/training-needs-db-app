// Script to remove 'Partial' and 'Excused' attendance statuses
import { supabase } from './src/core/services/supabaseClient.js';

const removeUnwantedStatuses = async () => {
  try {
    console.log('🔍 Checking current attendance statuses...');
    
    // First, check what statuses exist
    const { data: currentStatuses, error: fetchError } = await supabase
      .from('attendance_statuses')
      .select('id, status_name, is_present, color_code, display_order')
      .order('display_order');
    
    if (fetchError) {
      console.error('❌ Error fetching statuses:', fetchError);
      return;
    }
    
    console.log('✅ Current attendance statuses:', currentStatuses);
    
    // Find statuses to remove
    const statusesToRemove = currentStatuses.filter(status => 
      status.status_name === 'Partial' || status.status_name === 'Excused'
    );
    
    if (statusesToRemove.length === 0) {
      console.log('✅ No "Partial" or "Excused" statuses found to remove');
      return;
    }
    
    console.log('🗑️ Found statuses to remove:', statusesToRemove.map(s => s.status_name));
    
    // Remove any attendance records using these statuses first
    for (const status of statusesToRemove) {
      console.log(`🧹 Cleaning up attendance records for status: ${status.status_name}`);
      
      const { error: recordsError } = await supabase
        .from('attendance_records')
        .delete()
        .eq('attendance_status_id', status.id);
      
      if (recordsError) {
        console.error(`❌ Error removing records for ${status.status_name}:`, recordsError);
        continue;
      }
    }
    
    // Now remove the statuses themselves
    for (const status of statusesToRemove) {
      console.log(`🗑️ Removing status: ${status.status_name}`);
      
      const { error: deleteError } = await supabase
        .from('attendance_statuses')
        .delete()
        .eq('id', status.id);
      
      if (deleteError) {
        console.error(`❌ Error removing status ${status.status_name}:`, deleteError);
      } else {
        console.log(`✅ Removed status: ${status.status_name}`);
      }
    }
    
    // Check final result
    const { data: finalStatuses, error: finalError } = await supabase
      .from('attendance_statuses')
      .select('id, status_name, is_present, color_code, display_order')
      .order('display_order');
    
    if (finalError) {
      console.error('❌ Error fetching final statuses:', finalError);
      return;
    }
    
    console.log('✅ Remaining attendance statuses:', finalStatuses);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
};

// Run the function
removeUnwantedStatuses();