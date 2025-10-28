import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { deleteProject as deleteProjectService } from '@modules/projects/services/projectsService';

const ProjectContext = createContext();

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
  const [currentProject, setCurrentProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user's accessible projects
  const loadProjects = async (skipAutoSelect = false) => {
    setIsLoading(true);
    setError(null);
    try {
      // Import the getAllProjects function
      const { getAllProjects } = await import('@modules/projects/services/projectsService');
      
      // Use the improved getAllProjects function that handles admin roles
      const projectsData = await getAllProjects();
      
      // For now, assume all returned projects have admin access since getAllProjects 
      // handles the role-based filtering internally
      const transformedProjects = (projectsData || []).map(project => ({
        ...project,
        user_role: 'admin', // Global admins get admin role on all projects
        member_count: project.member_count || 0,
        schedule_count: project.schedule_count || 0,
        course_count: project.course_count || 0
      }));

      setProjects(transformedProjects);
      
      // Only auto-select if explicitly requested and no current project exists
      if (!skipAutoSelect && !currentProject && transformedProjects && transformedProjects.length > 0) {
        // Try to restore saved project first
        const savedProjectId = localStorage.getItem('currentProjectId');
        const savedProject = savedProjectId ? transformedProjects.find(p => p.id === savedProjectId) : null;

        if (savedProject) {
          // Only set if it's actually different (prevents unnecessary re-renders)
          if (!currentProject || currentProject.id !== savedProject.id) {
            setCurrentProject(savedProject);
            console.log('Restored saved project:', savedProject.name);
          } else {
            console.log('Project already set, skipping restore to prevent re-render');
          }
        } else {
          // Only select first project if no saved project found
          if (!currentProject || currentProject.id !== transformedProjects[0].id) {
            setCurrentProject(transformedProjects[0]);
            localStorage.setItem('currentProjectId', transformedProjects[0].id);
            console.log('Auto-selected first project:', transformedProjects[0].name);
          }
        }
      }
      
    } catch (err) {
      console.error('❌ ProjectContext Error loading projects:', err);
      console.error('❌ Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to a different project
  const switchProject = async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found:', projectId);
      return;
    }
    
    setCurrentProject(project);
    localStorage.setItem('currentProjectId', projectId);
    console.log('Switched to project:', project.name);
  };

  // Create a new project
  const createProject = async (projectData) => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name: projectData.name,
          title: projectData.title,
          description: projectData.description,
          project_code: projectData.project_code,
          start_date: projectData.start_date,
          target_end_date: projectData.target_end_date,
          settings: projectData.settings || {},
          branding: projectData.branding || {},
          owner_id: (await supabase.auth.getUser()).data.user.id,
          created_by: (await supabase.auth.getUser()).data.user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Add creator as project owner
      await supabase
        .from('project_users')
        .insert([{
          project_id: data.id,
          user_id: data.owner_id,
          role: 'owner'
        }]);

      // Refresh projects list without auto-selecting
      await loadProjects(true);
      
      // Switch to the new project
      await switchProject(data.id);

      console.log('Created new project:', data.name);
      return data;
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.message);
      throw err;
    }
  };

  // Update existing project
  const updateProject = async (projectId, updates) => {
    console.log('🔍 ProjectContext: updateProject called');
    console.log('🔍 Project ID:', projectId);
    console.log('🔍 Updates:', updates);
    
    setError(null);
    try {
      // Clean up the updates object - convert empty strings to null for date fields
      const cleanedUpdates = { ...updates };
      
      // Convert empty date strings to null
      if (cleanedUpdates.start_date === '') {
        cleanedUpdates.start_date = null;
      }
      if (cleanedUpdates.target_end_date === '') {
        cleanedUpdates.target_end_date = null;
      }
      
      // Convert empty project_code to null
      if (cleanedUpdates.project_code === '') {
        cleanedUpdates.project_code = null;
      }
      
      console.log('🧹 Cleaned Updates:', cleanedUpdates);
      console.log('🔄 Making Supabase update call...');
      
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...cleanedUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .select()
        .single();

      console.log('📦 Supabase response - data:', data);
      console.log('📦 Supabase response - error:', error);

      if (error) throw error;

      console.log('🔄 Refreshing projects list...');
      // Refresh projects list without auto-selecting
      await loadProjects(true);
      
      // Update current project if it was the one being edited
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(data);
        console.log('✅ Updated current project');
      }

      console.log('✅ Updated project:', data.name);
      return data;
    } catch (err) {
      console.error('❌ Error updating project:', err);
      setError(err.message);
      throw err;
    }
  };

  // Delete a project and all associated data (owner only)
  const deleteProject = async (projectId) => {
    setError(null);
    try {
      // Use the service function that handles cascade deletion
      await deleteProjectService(projectId);

      // If we deleted the current project, switch to another one
      if (currentProject && currentProject.id === projectId) {
        setCurrentProject(null);
        localStorage.removeItem('currentProjectId');
      }

      // Refresh projects list without auto-selecting
      await loadProjects(true);
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err.message);
      throw err;
    }
  };

  // Add user to project
  const addProjectMember = async (projectId, userId, role = 'member') => {
    setError(null);
    try {
      const { error } = await supabase
        .from('project_users')
        .insert([{
          project_id: projectId,
          user_id: userId,
          role,
          added_by: (await supabase.auth.getUser()).data.user.id
        }]);

      if (error) throw error;

      console.log(`Added user ${userId} to project ${projectId} as ${role}`);
      
      // Refresh projects if needed
      await loadProjects();
    } catch (err) {
      console.error('Error adding project member:', err);
      setError(err.message);
      throw err;
    }
  };

  // Remove user from project
  const removeProjectMember = async (projectId, userId) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      console.log(`Removed user ${userId} from project ${projectId}`);
      
      // Refresh projects if needed
      await loadProjects();
    } catch (err) {
      console.error('Error removing project member:', err);
      setError(err.message);
      throw err;
    }
  };

  // Get user's role in current project
  const getCurrentUserRole = () => {
    if (!currentProject) return null;
    
    // Find the current project in the projects list, which includes role info
    const projectWithRole = projects.find(p => p.id === currentProject.id);
    if (projectWithRole && projectWithRole.user_role) {
      return projectWithRole.user_role;
    }
    
    // Fallback: if no role found, assume member
    return 'member';
  };

  // Check if user has permission for an action
  const hasPermission = (action) => {
    const role = getCurrentUserRole();
    if (!role) return false;

    const permissions = {
      owner: ['read', 'write', 'delete', 'admin', 'invite'],
      admin: ['read', 'write', 'admin', 'invite'],
      member: ['read', 'write'],
      viewer: ['read']
    };

    return permissions[role]?.includes(action) || false;
  };

  // Initialize project context on mount
  useEffect(() => {
    const initializeProject = async () => {
      // Load projects and let loadProjects handle the saved project restoration
      await loadProjects(false); // false = allow auto-select logic
    };

    initializeProject();

    // Listen for auth state changes to reload projects
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // User just logged in, load their projects with auto-select
        loadProjects(false);
      } else if (event === 'SIGNED_OUT') {
        // User logged out, clear projects
        setProjects([]);
        setCurrentProject(null);
        setIsLoading(false);
        setError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Context value
  const value = {
    // State
    currentProject,
    projects,
    isLoading,
    error,
    
    // Actions
    loadProjects,
    switchProject,
    createProject,
    updateProject,
    deleteProject,
    addProjectMember,
    removeProjectMember,
    
    // Utilities
    getCurrentUserRole,
    hasPermission,
    
    // Clear error
    clearError: () => setError(null)
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export default ProjectProvider;