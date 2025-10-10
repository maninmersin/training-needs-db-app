import React, { useEffect, useState } from 'react';
import { usePlanStore } from '../state/usePlanStore';
import TimelineContainer from '../components/timeline/TimelineContainer';
import PlansLibraryModal from '../components/PlansLibraryModal';
import NewPlanModal from '../components/NewPlanModal';

const TimelinePage: React.FC = () => {
  const { currentPlan, isLoading, error, createPlan, addCard, addMilestone, savePlan, loadPlans, loadPlan } = usePlanStore();
  const [showPlansLibraryModal, setShowPlansLibraryModal] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);

  // No longer auto-create plans on page load

  // Add sample data when plan is created
  useEffect(() => {
    if (currentPlan && currentPlan.cards.length === 0) {
      
      // Add sample cards - use sub-categories, not main categories
      if (currentPlan.swimlanes.length > 0) {
        // Find sub-categories by title (main categories don't render timeline tracks)
        const systemAvailabilitySwimlane = currentPlan.swimlanes.find(s => s.title === 'System Availability');
        const testingSwimlane = currentPlan.swimlanes.find(s => s.title === 'Testing');
        const releasesSwimlane = currentPlan.swimlanes.find(s => s.title === 'Releases');
        const awarenessSwimlane = currentPlan.swimlanes.find(s => s.title === 'Awareness');
        const invitesSwimlane = currentPlan.swimlanes.find(s => s.title === 'Invites');
        const analysisSwimlane = currentPlan.swimlanes.find(s => s.title === 'Analysis');
        const designSwimlane = currentPlan.swimlanes.find(s => s.title === 'Design');
        const deliverSwimlane = currentPlan.swimlanes.find(s => s.title === 'Deliver');
        const evaluationSwimlane = currentPlan.swimlanes.find(s => s.title === 'Evaluation');
        const bauDesignSwimlane = currentPlan.swimlanes.find(s => s.title === 'Design' && s.parentId === currentPlan.swimlanes.find(p => p.title === 'BAU')?.id);
        const handoverSwimlane = currentPlan.swimlanes.find(s => s.title === 'Handover');

        // Calculate dates relative to current timeline
        const timelineStart = currentPlan.timeline.startDate;
        const timelineEnd = currentPlan.timeline.endDate;
        
        // Create helper function for date calculations
        const getDateInTimeline = (monthsFromStart: number, weeksOffset: number = 0) => {
          const date = new Date(timelineStart);
          date.setMonth(date.getMonth() + monthsFromStart);
          date.setDate(date.getDate() + (weeksOffset * 7));
          return new Date(Math.min(date.getTime(), timelineEnd.getTime()));
        };

        // Technical cards
        if (systemAvailabilitySwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: systemAvailabilitySwimlane.id,
            title: 'Environment Setup',
            description: 'Prepare training and production environments',
            startDate: getDateInTimeline(0, 1), // 1 week from timeline start
            endDate: getDateInTimeline(1, 2), // 1 month + 2 weeks from timeline start
            color: '#4A90A4',
            backgroundColor: '#EFF6FF',
            textColor: '#1E40AF',
            fontSize: 13,
            fontWeight: 'semibold',
            fontFamily: 'Inter',
            status: 'in-progress',
            order: 0,
            row: 0
          });
        }

        if (testingSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: testingSwimlane.id,
            title: 'UAT Planning',
            description: 'Plan user acceptance testing scenarios',
            startDate: getDateInTimeline(1), // 1 month from timeline start
            endDate: getDateInTimeline(2, 1), // 2 months + 1 week from timeline start
            color: '#4A90A4',
            backgroundColor: '#EFF6FF',
            textColor: '#1E40AF',
            fontSize: 12,
            fontWeight: 'medium',
            fontFamily: 'Inter',
            status: 'not-started',
            order: 0,
            row: 0
          });
        }

        if (releasesSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: releasesSwimlane.id,
            title: 'Release 1.0',
            description: 'Production system rollout',
            startDate: getDateInTimeline(4), // 4 months from timeline start
            endDate: getDateInTimeline(5), // 5 months from timeline start
            color: '#4A90A4',
            backgroundColor: '#F0FDF4',
            textColor: '#166534',
            fontSize: 14,
            fontWeight: 'bold',
            fontFamily: 'Inter',
            status: 'not-started',
            order: 0,
            row: 0
          });
        }

        // Communications cards
        if (awarenessSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: awarenessSwimlane.id,
            title: 'Stakeholder Briefing',
            description: 'Brief key stakeholders on rollout plan',
            startDate: getDateInTimeline(0, 2), // 2 weeks from timeline start
            endDate: getDateInTimeline(1), // 1 month from timeline start
            color: '#5C8A5C',
            backgroundColor: '#F0FDF4',
            textColor: '#166534',
            fontSize: 12,
            fontWeight: 'medium',
            fontFamily: 'Inter',
            status: 'completed',
            order: 0,
            row: 0
          });
        }

        if (invitesSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: invitesSwimlane.id,
            title: 'Training Invitations',
            description: 'Send training session invitations to users',
            startDate: getDateInTimeline(2), // 2 months from timeline start
            endDate: getDateInTimeline(2, 1), // 2 months + 1 week from timeline start
            color: '#5C8A5C',
            backgroundColor: '#EFF6FF',
            textColor: '#1E40AF',
            fontSize: 13,
            fontWeight: 'semibold',
            fontFamily: 'Inter',
            status: 'not-started',
            order: 0,
            row: 0
          });
        }

        // Training cards
        if (analysisSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: analysisSwimlane.id,
            title: 'Training Needs Analysis',
            description: 'Analyze user training requirements',
            startDate: getDateInTimeline(0, 1), // 1 week from timeline start
            endDate: getDateInTimeline(1), // 1 month from timeline start
            color: '#7C3AED',
            backgroundColor: '#FAF5FF',
            textColor: '#581C87',
            fontSize: 12,
            fontWeight: 'medium',
            fontFamily: 'Inter',
            status: 'completed',
            order: 0,
            row: 0
          });
        }

        if (designSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: designSwimlane.id,
            title: 'Course Design',
            description: 'Design training materials and curriculum',
            startDate: getDateInTimeline(1), // 1 month from timeline start
            endDate: getDateInTimeline(2, 2), // 2 months + 2 weeks from timeline start
            color: '#7C3AED',
            backgroundColor: '#F0E7FF',
            textColor: '#4C1D95',
            fontSize: 13,
            fontWeight: 'semibold',
            fontFamily: 'Inter',
            status: 'in-progress',
            order: 0,
            row: 0
          });
        }

        if (deliverSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: deliverSwimlane.id,
            title: 'Training Delivery',
            description: 'Conduct training sessions for all users',
            startDate: getDateInTimeline(2, 2), // 2 months + 2 weeks from timeline start
            endDate: getDateInTimeline(4), // 4 months from timeline start
            color: '#7C3AED',
            backgroundColor: '#EFF6FF',
            textColor: '#1E40AF',
            fontSize: 14,
            fontWeight: 'bold',
            fontFamily: 'Inter',
            status: 'not-started',
            order: 0,
            row: 0
          });
        }

        if (evaluationSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: evaluationSwimlane.id,
            title: 'Training Evaluation',
            description: 'Assess training effectiveness and gather feedback',
            startDate: getDateInTimeline(4), // 4 months from timeline start
            endDate: getDateInTimeline(5), // 5 months from timeline start
            color: '#7C3AED',
            backgroundColor: '#FEF2F2',
            textColor: '#DC2626',
            fontSize: 12,
            fontWeight: 'medium',
            fontFamily: 'Inter',
            status: 'not-started',
            order: 0,
            row: 0
          });
        }

        // BAU cards
        if (bauDesignSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: bauDesignSwimlane.id,
            title: 'Process Documentation',
            description: 'Document BAU processes and procedures',
            startDate: getDateInTimeline(3), // 3 months from timeline start
            endDate: getDateInTimeline(4, 2), // 4 months + 2 weeks from timeline start
            color: '#EA580C',
            backgroundColor: '#FFF7ED',
            textColor: '#C2410C',
            fontSize: 13,
            fontWeight: 'semibold',
            fontFamily: 'Inter',
            status: 'not-started',
            order: 0,
            row: 0
          });
        }

        if (handoverSwimlane) {
          addCard({
            planId: currentPlan.id,
            swimlaneId: handoverSwimlane.id,
            title: 'Knowledge Transfer',
            description: 'Transfer system knowledge to support team',
            startDate: getDateInTimeline(4, 2), // 4 months + 2 weeks from timeline start
            endDate: getDateInTimeline(6), // End of timeline
            color: '#EA580C',
            backgroundColor: '#FEF2F2',
            textColor: '#DC2626',
            fontSize: 14,
            fontWeight: 'bold',
            fontFamily: 'Inter',
            status: 'not-started',
            order: 0,
            row: 0
          });
        }

        // Add milestones to sub-categories
        if (systemAvailabilitySwimlane) {
          addMilestone({
            planId: currentPlan.id,
            swimlaneId: systemAvailabilitySwimlane.id,
            title: 'Environment Ready',
            description: 'Training environment is ready for use',
            date: getDateInTimeline(1, 2), // 1 month + 2 weeks from timeline start
            color: '#4A90A4'
          });
        }

        if (analysisSwimlane) {
          addMilestone({
            planId: currentPlan.id,
            swimlaneId: analysisSwimlane.id,
            title: 'Training Plan Approved',
            description: 'Training strategy approved by stakeholders',
            date: getDateInTimeline(1), // 1 month from timeline start
            color: '#7C3AED'
          });
        }

        if (releasesSwimlane) {
          addMilestone({
            planId: currentPlan.id,
            swimlaneId: releasesSwimlane.id,
            title: 'Go-Live',
            description: 'System rollout complete',
            date: getDateInTimeline(5), // 5 months from timeline start
            color: '#4A90A4'
          });
        }
      }
      
      // Auto-save the plan to database after adding all sample data
      // This ensures Save As will include all default cards
      const autoSaveAfterDelay = setTimeout(async () => {
        try {
          console.log('Auto-saving plan with sample data...');
          console.log('Current plan ID before auto-save:', currentPlan.id);
          
          // Only auto-save if the current plan has an ID (exists in database) and not currently loading
          if (currentPlan.id && !isLoading) {
            await savePlan();
            console.log('Plan with sample data saved successfully');
          } else {
            console.log('Skipping auto-save - plan not yet persisted to database or operation in progress');
          }
        } catch (error) {
          console.warn('Failed to auto-save plan with sample data:', error);
        }
      }, 1000); // Small delay to ensure all cards are added
      
      return () => clearTimeout(autoSaveAfterDelay);
    }
  }, [currentPlan, addCard, addMilestone, savePlan]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Timeline</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const handleCreatePlan = async (title: string, template: string, timelineConfig: any) => {
    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    
    try {
      await createPlan(title, {
        startDate: now,
        endDate: sixMonthsFromNow,
        scale: 'weeks',
        showGrid: true,
        snapToGrid: true,
        ...timelineConfig
      });
      setShowNewPlanModal(false);
    } catch (error) {
      console.error('Error creating plan:', error);
      // Modal stays open to show error
    }
  };

  const handleBrowsePlans = async () => {
    try {
      await loadPlans();
      setShowPlansLibraryModal(true);
    } catch (error) {
      console.error('Error loading plans:', error);
      setShowPlansLibraryModal(true); // Still show modal even if loading fails
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      await loadPlan(planId);
      setShowPlansLibraryModal(false);
    } catch (error) {
      console.error('Error loading plan:', error);
    }
  };

  if (!currentPlan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <div className="text-blue-500 text-6xl mb-4">📅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Plan on a Page</h1>
          <p className="text-gray-600 mb-6">Create beautiful timeline plans for your projects</p>
          
          <div className="space-y-3">
            <button
              onClick={() => setShowNewPlanModal(true)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              disabled={isLoading}
            >
              Create New Plan
            </button>
            
            <button
              onClick={handleBrowsePlans}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium border border-gray-300"
              disabled={isLoading}
            >
              Browse Existing Plans
            </button>
            
            <div className="text-sm text-gray-500">
              Create a new timeline or open an existing project
            </div>
          </div>
        </div>
        
        {/* Plans Library Modal */}
        <PlansLibraryModal 
          isOpen={showPlansLibraryModal}
          onClose={() => setShowPlansLibraryModal(false)}
          onSelectPlan={handleSelectPlan}
          onCreateNew={() => {
            setShowPlansLibraryModal(false);
            setShowNewPlanModal(true);
          }}
        />
        
        {/* New Plan Modal */}
        <NewPlanModal 
          isOpen={showNewPlanModal}
          onClose={() => setShowNewPlanModal(false)}
          onCreate={handleCreatePlan}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TimelineContainer plan={currentPlan} />
    </div>
  );
};

export default TimelinePage;