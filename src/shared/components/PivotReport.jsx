import React, { useEffect, useState } from 'react';
import { Loader2, Table2 } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { loadUserCourseEntries } from './userCourses/userCourseService';
import { PIVOT_HIDDEN_ATTRIBUTES, toPivotRow } from './userCourses/userCourseRows';
import './PivotReport.css';

const PivotReport = () => {
  const { currentProject } = useProject();
  const [data, setData] = useState([]);
  const [pivotState, setPivotState] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentProject) {
        setData([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const entries = await loadUserCourseEntries(supabase, currentProject.id);
        setData(entries.map(toPivotRow));
      } catch (loadError) {
        console.error('Error fetching data:', loadError);
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentProject]);

  if (!currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState icon={Table2} title="No Project Selected" description="Please select a project from the Projects page to view pivot reports. Each project has its own isolated training data for analysis." />
      </div>
    );
  }

  const groupingFields = [...(pivotState.rows || []), ...(pivotState.cols || [])];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <PageHeader
        title="Training Needs Pivot Report"
        count={loading ? undefined : data.length}
        description={`Drag fields into rows and columns to analyse who needs which courses. Courses come from each person's role and from individual assignments (see the course_source field). Project: ${currentProject.title}.`}
      />

      {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"><b>Error Loading Report</b>: {error}</div>}

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading Training Data...
        </div>
      ) : data.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icon={Table2} title="No Training Data Available" description="Add people and give their roles courses (Role-Course Mappings), or assign courses to individuals, then come back." />
        </div>
      ) : (
        data.length > 0 && (
          <>
            <Card className="p-3">
              <div className="pivot-table-wrapper">
                <PivotTableUI data={data} onChange={(state) => setPivotState(state)} {...pivotState} aggregatorName="Count" vals={['id']} hiddenAttributes={PIVOT_HIDDEN_ATTRIBUTES} />
              </div>
            </Card>
            <p className="text-sm text-muted-foreground"><b className="text-foreground">Grouping By:</b> {groupingFields.join(' → ') || 'None'}</p>
          </>
        )
      )}
    </div>
  );
};

export default PivotReport;
