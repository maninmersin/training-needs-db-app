import React, { useEffect, useState } from 'react';
import { usePlanStore } from '../state/usePlanStore';
import Windows11Modal, { ModalBody, ModalSection } from './ui/Windows11Modal';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import type { Plan } from '../types';

interface PlansLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planId: string) => void;
  onCreateNew: () => void;
}

export default function PlansLibraryModal({ 
  isOpen, 
  onClose, 
  onSelectPlan, 
  onCreateNew 
}: PlansLibraryModalProps) {
  
  const { 
    plans, 
    isLoading, 
    error, 
    loadPlans,
    deletePlan,
    currentPlan 
  } = usePlanStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Remove loadPlans from useEffect to prevent modal interference
  useEffect(() => {
    if (isOpen) {
      console.log('📋 Plans modal opened - using existing plans data');
    }
  }, [isOpen]);
  
  const handleDeletePlan = async (planId: string, planTitle: string) => {
    if (confirm(`Are you sure you want to delete "${planTitle}"? This action cannot be undone.`)) {
      await deletePlan(planId);
    }
  };
  
  const handleSelectPlan = (planId: string) => {
    onSelectPlan(planId);
    onClose();
  };
  
  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString();
  };

  const footer = (
    <div className="flex items-center justify-between gap-4">
      <button
        onClick={onClose}
        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onCreateNew}
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        New Plan
      </button>
    </div>
  );

  // Modal render
  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Browse Plans"
      width="900px"
      height="700px"
      footer={footer}
    >
      <ModalBody className="p-6">
        <ModalSection>
          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by plan name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Loading State */}
          {isLoading && plans.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {/* Error State */}
          {error && (
            <ErrorMessage message={error} onDismiss={() => {}} />
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredPlans.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {searchTerm ? 'No plans found' : 'No plans yet'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? 'Try a different search term or create a new plan.' 
                  : 'Get started by creating your first plan.'
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={onCreateNew}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Your First Plan
                </button>
              )}
            </div>
          )}

          {/* Plans Grid */}
          {!isLoading && !error && filteredPlans.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pb-4 scrollable-modal" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e0 #f7fafc'
            }}>
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white border-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group ${
                    currentPlan?.id === plan.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 truncate flex-1 pr-2">
                        {plan.name}
                        {currentPlan?.id === plan.id && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Current
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan.id, plan.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all duration-200 px-2 py-1 text-xs"
                        title="Delete plan"
                      >
                        Delete
                      </button>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-500">
                      <div>Created: {formatDate(plan.createdAt.toString())}</div>
                      <div>Updated: {formatDate(plan.updatedAt.toString())}</div>
                      {plan.sharedWith && plan.sharedWith.length > 0 && (
                        <div>Shared with {plan.sharedWith.length} people</div>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {plan.timeline?.scale || 'weeks'} timeline
                      </span>
                      <span className="text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        Open Plan →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}