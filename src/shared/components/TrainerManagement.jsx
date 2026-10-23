import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, GraduationCap, Loader2, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Badge, Button, DataTable, EmptyState, Input, PageHeader, Toolbar, Tooltip, TooltipContent,
  TooltipTrigger, toast
} from '@/components/ui';
import TrainerEditSheet from './trainers/TrainerEditSheet';
import { filterTrainers, trainersToCsv } from './trainers/trainersLogic';

function IconAction({ label, onClick, destructive = false, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={destructive ? 'destructive' : 'ghost'} size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const TrainerManagement = () => {
  const { currentProject } = useProject();
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sheet, setSheet] = useState(null); // { mode: 'create' | 'edit', trainer? }
  const [trainerToDelete, setTrainerToDelete] = useState(null);

  // `silent` refreshes the list after a change without flashing the loading state
  const fetchTrainers = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!currentProject) {
          setTrainers([]);
          return;
        }
        if (!silent) setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('trainers')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('name', { ascending: true });
        if (fetchError) throw fetchError;
        setTrainers(data || []);
        setLoadFailed(false);
      } catch (loadError) {
        setError(loadError.message);
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [currentProject]
  );

  useEffect(() => {
    setError(null);
    fetchTrainers();
  }, [fetchTrainers]);

  const saveSheet = async (trainerData) => {
    if (!currentProject) throw new Error('Please select a project first');
    if (sheet.mode === 'edit') {
      const { error: updateError } = await supabase.from('trainers').update(trainerData).eq('id', sheet.trainer.id);
      if (updateError) throw updateError;
      toast.success('Trainer updated', { description: trainerData.name });
    } else {
      const { error: insertError } = await supabase.from('trainers').insert([{ ...trainerData, project_id: currentProject.id }]);
      if (insertError) throw insertError;
      toast.success('Trainer added', { description: trainerData.name });
    }
    setError(null);
    setSheet(null);
    fetchTrainers({ silent: true });
  };

  const handleDelete = async (trainer) => {
    try {
      const { error: deleteError } = await supabase.from('trainers').delete().eq('id', trainer.id);
      if (deleteError) throw deleteError;
      setSheet((current) => (current?.trainer?.id === trainer.id ? null : current)); // close the panel if it was open on this trainer
      toast.success('Trainer deleted', { description: trainer.name });
      fetchTrainers({ silent: true });
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const toggleStatus = useCallback(
    async (trainer) => {
    try {
      const { error: updateError } = await supabase.from('trainers').update({ active: !trainer.active }).eq('id', trainer.id);
      if (updateError) throw updateError;
      fetchTrainers({ silent: true });
    } catch (updateError) {
      setError(updateError.message);
    }
    },
    [fetchTrainers]
  );

  const filteredTrainers = useMemo(() => filterTrainers(trainers, searchTerm), [trainers, searchTerm]);

  const exportToCSV = () => {
    const blob = new Blob([trainersToCsv(filteredTrainers)], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trainers.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = useMemo(
    () => [
      { accessorKey: 'name', header: 'Name', meta: { className: 'font-medium' } },
      { id: 'email', header: 'Email', accessorFn: (trainer) => trainer.email || 'N/A' },
      { id: 'phone', header: 'Phone', accessorFn: (trainer) => trainer.phone || 'N/A' },
      {
        id: 'specializations',
        header: 'Specializations',
        enableSorting: false,
        meta: { className: 'whitespace-normal py-1' },
        cell: ({ row }) => {
          const specs = row.original.specializations;
          if (!specs || specs.length === 0) return <span className="text-subtle-foreground">None</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {specs.map((spec, index) => (
                <Badge key={`${spec}-${index}`} variant="primary">{spec}</Badge>
              ))}
            </div>
          );
        }
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (trainer) => (trainer.active ? 'Active' : 'Inactive'),
        cell: ({ getValue }) => <Badge variant={getValue() === 'Active' ? 'success' : 'neutral'}>{getValue()}</Badge>
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const trainer = row.original;
          return (
            <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
              <IconAction label="Edit trainer" onClick={() => setSheet({ mode: 'edit', trainer })}><Pencil /></IconAction>
              <IconAction label={trainer.active ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(trainer)}><Power /></IconAction>
              <IconAction label="Delete trainer" destructive onClick={() => setTrainerToDelete(trainer)}><Trash2 /></IconAction>
            </div>
          );
        }
      }
    ],
    [toggleStatus]
  );

  if (!loading && !currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState
          icon={GraduationCap}
          title="No Project Selected"
          description="Please select a project from the Projects page to manage trainers. Each project has its own isolated set of trainers and data."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Trainer Management"
        count={loading ? undefined : trainers.length}
        description={`Manage training instructors, their specializations, and contact information${currentProject ? ` for ${currentProject.title}` : ''}.`}
        actions={
          <>
            <Button onClick={exportToCSV} disabled={filteredTrainers.length === 0}>
              <Download /> Export to CSV
            </Button>
            <Button variant="default" onClick={() => setSheet({ mode: 'create' })} disabled={loading}>
              <Plus /> Add New Trainer
            </Button>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{loadFailed ? `Error loading trainers: ${error}` : error}</span>
          {loadFailed && <Button size="sm" onClick={() => { setError(null); fetchTrainers(); }}>Retry</Button>}
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <Toolbar>
        <div className="relative w-96 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search trainers"
            placeholder="Search trainers by name, email, or specialization..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-8"
          />
        </div>
      </Toolbar>

      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading trainers...
        </div>
      ) : (
        <DataTable
          caption="Trainers"
          columns={columns}
          data={filteredTrainers}
          getRowId={(trainer) => trainer.id}
          onRowClick={(trainer) => setSheet({ mode: 'edit', trainer })}
          emptyState={
            <EmptyState
              icon={GraduationCap}
              title={trainers.length === 0 ? 'No trainers yet' : 'No trainers match'}
              description={trainers.length === 0 ? 'Add the people who deliver your training sessions.' : 'Try a different search.'}
            />
          }
        />
      )}

      <TrainerEditSheet mode={sheet?.mode} trainer={sheet?.trainer} onSubmit={saveSheet} onDelete={setTrainerToDelete} onClose={() => setSheet(null)} />

      <AlertDialog open={Boolean(trainerToDelete)} onOpenChange={(open) => !open && setTrainerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trainer</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete trainer {trainerToDelete?.name}? Sessions that used them are kept, with no trainer.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => handleDelete(trainerToDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrainerManagement;
