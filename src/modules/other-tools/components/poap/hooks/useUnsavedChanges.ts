import { useEffect, useCallback } from 'react';
import { usePlanStore } from '../state/usePlanStore';

interface UseUnsavedChangesOptions {
  onBeforeUnload?: () => void;
  preventNavigation?: boolean;
}

export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}) {
  const { 
    hasUnsavedChanges, 
    currentPlan, 
    savePlan,
    checkUnsavedChanges 
  } = usePlanStore();
  
  const { onBeforeUnload, preventNavigation = true } = options;

  // Handle browser beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Modern browsers require this to be set to show the dialog
        
        if (onBeforeUnload) {
          onBeforeUnload();
        }
        
        return ''; // Some browsers require a return value
      }
    };

    if (preventNavigation) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [hasUnsavedChanges, onBeforeUnload, preventNavigation]);

  // Check for unsaved changes before plan switching
  const checkUnsavedBeforeAction = useCallback(
    async (action: () => void | Promise<void>): Promise<boolean> => {
      if (!hasUnsavedChanges) {
        await action();
        return true;
      }

      // Return false to indicate that the action should be handled by the caller
      // (typically by showing the UnsavedChangesModal)
      return false;
    },
    [hasUnsavedChanges]
  );

  // Save current plan
  const saveCurrentPlan = useCallback(async () => {
    if (currentPlan && hasUnsavedChanges) {
      await savePlan();
      return true;
    }
    return false;
  }, [currentPlan, hasUnsavedChanges, savePlan]);

  // Force action without saving (discard changes)
  const discardChangesAndProceed = useCallback(
    async (action: () => void | Promise<void>) => {
      await action();
    },
    []
  );

  return {
    hasUnsavedChanges,
    checkUnsavedBeforeAction,
    saveCurrentPlan,
    discardChangesAndProceed,
    checkUnsavedChanges
  };
}