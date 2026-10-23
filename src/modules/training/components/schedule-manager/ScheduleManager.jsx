import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Download, RefreshCw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, Button, Input, PageHeader, Skeleton, Toolbar
} from '@/components/ui';
import ExcelExportDialog from '@shared/components/ExcelExportDialog';
import ExcelImportWizard from '@shared/components/ExcelImportWizard';
import ScheduleList from './ScheduleList';
import ScheduleEditor from './ScheduleEditor';
import { deleteSummary, filterSchedules, groupSessionsForEditor } from './scheduleManagerLogic';
import './ScheduleManager.css'; // still used by the editor and export dialog until they are restyled

const ScheduleManager = () => {
  const location = useLocation();
  const { currentProject } = useProject();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'edit', 'export', 'import'
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tableKey, setTableKey] = useState(0); // remounting the table clears its row selection

  const resetToMainView = () => {
    setCurrentView('list');
    setCurrentSchedule(null);
    setSelectedSchedules([]);
    setSearchTerm('');
    setFilterDate('');
  };

  // The sidebar link adds ?restart=true to return to the main view
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('restart') === 'true') {
      resetToMainView();
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!currentProject) {
        setSchedules([]);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('training_schedules')
        .select(`
          id,
          name,
          created_at,
          updated_at,
          criteria,
          status,
          functional_areas,
          training_locations,
          session_count:training_sessions(count)
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setSchedules(data || []);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject]);

  // Load a schedule and its sessions, then open the editor
  const loadScheduleForEdit = async (scheduleId) => {
    try {
      const { data: scheduleData, error: scheduleError } = await supabase.from('training_schedules').select('*').eq('id', scheduleId).single();
      if (scheduleError) throw scheduleError;

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('start_datetime');
      if (sessionsError) throw sessionsError;

      if (!sessionsData || sessionsData.length === 0) {
        toast.warning('This schedule has no sessions', {
          description: 'The schedule exists but its sessions were deleted or never saved. You can add courses in the editor.'
        });
      }

      setCurrentSchedule({ ...scheduleData, sessions: groupSessionsForEditor(sessionsData) });
      setCurrentView('edit');
    } catch (err) {
      console.error('Error loading schedule:', err);
      toast.error('Failed to load schedule', { description: err.message });
    }
  };

  const deleteSchedules = async () => {
    const ids = selectedSchedules;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase.from('training_schedules').delete().in('id', ids);
      if (deleteError) throw deleteError;

      setSelectedSchedules([]);
      setTableKey((key) => key + 1);
      setConfirmDelete(false);
      fetchSchedules();
      toast.success(`Deleted ${deleteSummary(ids.length)}`);
    } catch (err) {
      console.error('Error deleting schedules:', err);
      toast.error('Failed to delete schedules', { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const filteredSchedules = filterSchedules(schedules, searchTerm, filterDate);
  const handleBack = () => {
    setCurrentView('list');
    setCurrentSchedule(null);
  };

  if (error) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <PageHeader title="Schedule Manager" />
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1"><strong>Error loading schedules:</strong> {error}</span>
          <Button onClick={fetchSchedules}>Retry</Button>
        </div>
      </div>
    );
  }

  // The editor and the Excel dialogs need the whole width; the list is a readable column
  return (
    <div className={currentView === 'list' ? 'mx-auto flex max-w-6xl flex-col gap-4' : 'flex flex-col gap-4'}>
      <PageHeader
        title="Schedule Manager"
        description="Manage, edit, and export your training schedules"
        count={currentView === 'list' && !loading ? schedules.length : undefined}
        actions={currentView === 'list' && (
          <>
            <Button onClick={fetchSchedules} aria-label="Refresh"><RefreshCw /> Refresh</Button>
            <Button onClick={() => setCurrentView('import')}><Upload /> Import</Button>
            <Button onClick={() => setCurrentView('export')} disabled={selectedSchedules.length === 0}><Download /> Export ({selectedSchedules.length})</Button>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={selectedSchedules.length === 0}><Trash2 /> Delete ({selectedSchedules.length})</Button>
          </>
        )}
      />

      {currentView === 'list' && (
        <>
          <p className="text-sm text-muted-foreground">
            Need to assign users to sessions? Use <Link to="/drag-drop-assignments" className="font-medium text-primary hover:underline">User Assignments</Link> for drag-and-drop scheduling.
          </p>

          <Toolbar>
            <Input type="search" aria-label="Search schedules" placeholder="Search schedules..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-64" />
            <Input type="date" aria-label="Created on" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className="w-40" />
            {(searchTerm || filterDate) && (
              <Button variant="ghost" onClick={() => { setSearchTerm(''); setFilterDate(''); }}>Clear Filters</Button>
            )}
          </Toolbar>

          {loading && schedules.length === 0 ? (
            <div className="flex flex-col gap-2" aria-busy="true"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : (
            <ScheduleList
              key={tableKey}
              schedules={filteredSchedules}
              onSelectionChange={setSelectedSchedules}
              onEdit={loadScheduleForEdit}
              onRefresh={fetchSchedules}
            />
          )}
        </>
      )}

      {currentView === 'edit' && currentSchedule && (
        <ScheduleEditor
          key={`schedule-editor-${currentSchedule.id}`}
          schedule={currentSchedule}
          onSave={() => {
            // The list is refreshed when the user goes back, so the editor's state is not reset
          }}
          onBack={() => {
            fetchSchedules();
            handleBack();
          }}
        />
      )}

      {currentView === 'export' && (
        <ExcelExportDialog selectedSchedules={selectedSchedules.map((id) => schedules.find((s) => s.id === id))} onBack={handleBack} />
      )}

      {currentView === 'import' && (
        <ExcelImportWizard
          onComplete={() => {
            fetchSchedules();
            handleBack();
          }}
          onBack={handleBack}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteSummary(selectedSchedules.length)}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected {selectedSchedules.length === 1 ? 'schedule' : 'schedules'} and their sessions. People already assigned to those sessions lose their assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); deleteSchedules(); }} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScheduleManager;
