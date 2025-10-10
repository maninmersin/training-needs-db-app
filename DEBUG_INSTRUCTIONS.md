# Debug Instructions for Stakeholder User Assignment Issue

## Issue
Stakeholder user sees "No schedules" and "No sessions available to display" in User Assignment page.

## Debugging Steps

### 1. Check Browser Console
Open the User Assignment page as the stakeholder user and check the browser console for debug messages. Look for:

- `🔍 buildFilteredQuery called with resourceType: assignments`
- `🔐 Retrieved permissions: [object]`
- `✅ Filtered training sessions result:`

### 2. Manual Debug in Browser Console

Paste this code in the browser console when logged in as the stakeholder:

```javascript
// Check current user and permissions
const debugUser = async () => {
  try {
    // Import the service (adjust path as needed)
    const { SimpleAuthService } = await import('./src/auth/services/simpleAuthService.js');
    
    // Check current user
    const user = await SimpleAuthService.getCurrentUser();
    console.log('👤 Current user:', user);
    
    // Check permissions
    const permissions = await SimpleAuthService.getUserPermissions('assignments');
    console.log('🔐 Permissions:', permissions);
    
    // Check if super admin
    const isSuperAdmin = await SimpleAuthService.isSuperAdmin();
    console.log('👑 Is super admin:', isSuperAdmin);
    
  } catch (error) {
    console.error('Debug error:', error);
  }
};

debugUser();
```

### 3. Check Database Directly (if possible)

If you have database access, run:

```sql
-- Check stakeholder user exists
SELECT email, user_type, is_super_admin, is_active 
FROM auth_users 
WHERE email LIKE '%manager%' OR email LIKE '%stakeholder%';

-- Check stakeholder permissions
SELECT u.email, up.resource_type, up.functional_area_names, up.training_location_names
FROM auth_user_permissions up
JOIN auth_users u ON u.id = up.user_id
WHERE u.email LIKE '%manager%' OR u.email LIKE '%stakeholder%';

-- Check available data
SELECT DISTINCT functional_area, training_location 
FROM training_sessions 
ORDER BY functional_area, training_location;
```

## Likely Issues and Solutions

### Issue 1: No Permissions Set Up
**Symptoms:** Console shows "No permissions found for resource: assignments"
**Solution:** Set up permissions in database or temporarily make user super admin

### Issue 2: Permission Values Don't Match Data
**Symptoms:** Permissions exist but filtered query returns 0 results
**Solution:** Update permission values to match actual data in training_sessions table

### Issue 3: User Not Found
**Symptoms:** Console shows user is null
**Solution:** Check auth_users table and session

## Temporary Workaround

To test if the filtering logic works, temporarily make the stakeholder user a super admin:

```sql
UPDATE auth_users 
SET is_super_admin = true 
WHERE email = 'your-stakeholder-email@company.com';
```

Super admins bypass all filtering and should see all data.

## Expected Behavior

When working correctly:
1. Stakeholder logs in and goes to User Assignment page
2. Console shows: "Retrieved permissions: {functional_area_names: ['Stores'], training_location_names: ['Kuwait Training Centre']}"
3. Only schedules with Stores/Kuwait sessions appear in the schedule selector
4. Selected schedule shows only Stores/Kuwait training sessions
5. Stakeholder can edit assignments for those sessions