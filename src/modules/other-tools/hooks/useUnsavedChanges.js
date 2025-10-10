import { useCallback } from 'react';
import usePlanStore from '../state/usePlanStore';

export const useUnsavedChanges = () => {
  const { hasUnsavedChanges, savePlan, clearCurrentPlan } = usePlanStore();

  const checkUnsavedBeforeAction = useCallback(async (action) => {
    if (!hasUnsavedChanges) {
      action();
      return true;
    }
    // For now, just proceed - in full implementation would show confirmation modal
    return false;
  }, [hasUnsavedChanges]);

  const saveCurrentPlan = useCallback(async () => {
    await savePlan();
  }, [savePlan]);

  const discardChangesAndProceed = useCallback(async (action) => {
    // In full implementation would discard changes and proceed
    action();
  }, []);

  return {
    checkUnsavedBeforeAction,
    saveCurrentPlan,
    discardChangesAndProceed,
    hasUnsavedChanges
  };
};