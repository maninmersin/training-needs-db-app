import React, { useEffect, useMemo, useState } from 'react';
import { Database, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Badge, Button, DataTable, EmptyState, Input, PageHeader, Tabs, TabsContent, TabsList,
  TabsTrigger, Toolbar, Tooltip, TooltipContent, TooltipTrigger, toast
} from '@/components/ui';
import ReferenceItemSheet from './reference/ReferenceItemSheet';
import { REFERENCE_TABS, TAB_ORDER } from './reference/referenceConfig';
import { filterItems } from './reference/referenceLogic';

const EMPTY_DATA = { project_roles: [], functional_areas: [], training_locations: [] };

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

const ReferenceDataManager = () => {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState('project_roles');
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerms, setSearchTerms] = useState({ project_roles: '', functional_areas: '', training_locations: '' });
  const [sheet, setSheet] = useState(null); // { mode: 'create' | 'edit', item? } for the active tab
  const [itemToDelete, setItemToDelete] = useState(null);

  // Load the three lists for this project
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        if (!currentProject) {
          setData(EMPTY_DATA);
          return;
        }
        setLoading(true);
        setError(null);

        const { data: rolesData, error: rolesError } = await supabase
          .from('project_roles')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('project_role_name');
        if (rolesError) throw rolesError;

        const { data: areasData, error: areasError } = await supabase
          .from('functional_areas')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('display_order', { ascending: true });
        if (areasError && !areasError.message.includes('does not exist')) throw areasError;

        const { data: locationsData, error: locationsError } = await supabase
          .from('training_locations')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('display_order', { ascending: true });
        if (locationsError && !locationsError.message.includes('does not exist')) throw locationsError;

        setData({ project_roles: rolesData || [], functional_areas: areasData || [], training_locations: locationsData || [] });
      } catch (loadError) {
        setError(loadError.message);
        console.error('Error fetching reference data:', loadError);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [currentProject]);

  const tab = REFERENCE_TABS[activeTab];
  const nameOf = (item) => item[tab.displayField] || item.id;

  const handleUpdate = async (item, changes) => {
    const { error: updateError } = await supabase.from(tab.table).update(changes).eq('id', item.id);
    if (updateError) throw updateError;
    setData((previous) => ({ ...previous, [activeTab]: previous[activeTab].map((row) => (row.id === item.id ? { ...row, ...changes } : row)) }));
  };

  const handleCreate = async (newItem) => {
    if (!currentProject) throw new Error('Please select a project first');
    const { data: created, error: insertError } = await supabase.from(tab.table).insert([{ ...newItem, project_id: currentProject.id }]).select();
    if (insertError) throw insertError;
    setData((previous) => ({ ...previous, [activeTab]: [...previous[activeTab], created[0]] }));
  };

  const handleDelete = async (item) => {
    try {
      const { error: deleteError } = await supabase.from(tab.table).delete().eq('id', item.id);
      if (deleteError) throw deleteError;
      setData((previous) => ({ ...previous, [activeTab]: previous[activeTab].filter((row) => row.id !== item.id) }));
      setSheet((current) => (current?.item?.id === item.id ? null : current)); // close the panel if it was open on this item
      toast.success(`${tab.singular} deleted`, { description: String(nameOf(item)) });
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const saveSheet = async (values) => {
    if (sheet.mode === 'create') {
      await handleCreate(values);
      toast.success(`${tab.singular} added`, { description: String(values[tab.displayField]) });
    } else {
      await handleUpdate(sheet.item, values);
      toast.success(`${tab.singular} saved`, { description: String(nameOf(sheet.item)) });
    }
    setError(null);
    setSheet(null);
  };

  const columns = useMemo(
    () => [
      ...tab.columns.map((column) => {
        const definition = {
          id: column.key,
          header: column.label,
          accessorFn: (item) => item[column.key] ?? '',
          meta: {
            align: column.type === 'number' ? 'right' : undefined,
            className: column.key === tab.displayField ? 'font-medium' : column.type === 'number' ? 'tabular-nums' : undefined
          }
        };
        // Only set `cell` when there is a custom one: an explicit undefined would blank the default renderer
        if (column.type === 'boolean') {
          definition.cell = ({ row }) => <Badge variant={row.original[column.key] ? 'success' : 'neutral'}>{row.original[column.key] ? 'Active' : 'Inactive'}</Badge>;
        } else if (column.type === 'datetime') {
          definition.cell = ({ row }) => (row.original[column.key] ? new Date(row.original[column.key]).toLocaleDateString('en-GB') : '');
        }
        return definition;
      }),
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <IconAction label="Edit item" onClick={() => setSheet({ mode: 'edit', item: row.original })}><Pencil /></IconAction>
            <IconAction label="Delete item" destructive onClick={() => setItemToDelete(row.original)}><Trash2 /></IconAction>
          </div>
        )
      }
    ],
    [tab]
  );

  const rows = useMemo(() => filterItems(tab, data[activeTab], searchTerms[activeTab]), [tab, data, activeTab, searchTerms]);

  if (!loading && !currentProject) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-border bg-card">
        <EmptyState
          icon={Database}
          title="No Project Selected"
          description="Please select a project from the Projects page to manage reference data. Each project has its own isolated set of functional areas and training locations."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Reference Data Management"
        description={`Manage project roles, functional areas, and training locations${currentProject ? ` for ${currentProject.title}` : ''} to ensure consistent data entry across the application.`}
        actions={
          <Button variant="default" onClick={() => setSheet({ mode: 'create' })} disabled={loading}>
            <Plus /> Add New {tab.singular}
          </Button>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TAB_ORDER.map((key) => (
            <TabsTrigger key={key} value={key}>
              {REFERENCE_TABS[key].title} ({data[key].length})
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_ORDER.map((key) => (
          <TabsContent key={key} value={key} className="flex flex-col gap-4">
            <Toolbar>
              <div className="relative w-80 max-w-full">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  aria-label={`Search ${REFERENCE_TABS[key].title.toLowerCase()}`}
                  placeholder={`Search ${REFERENCE_TABS[key].title.toLowerCase()}...`}
                  value={searchTerms[key]}
                  onChange={(event) => setSearchTerms((previous) => ({ ...previous, [key]: event.target.value }))}
                  className="pl-8"
                />
              </div>
            </Toolbar>

            {loading ? (
              <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading reference data...
              </div>
            ) : (
              <DataTable
                caption={REFERENCE_TABS[key].title}
                columns={columns}
                data={rows}
                getRowId={(item) => String(item.id)}
                onRowClick={(item) => setSheet({ mode: 'edit', item })}
                emptyState={
                  <EmptyState
                    icon={Database}
                    title={data[key].length === 0 ? `No ${REFERENCE_TABS[key].title.toLowerCase()} yet` : 'Nothing matches'}
                    description={data[key].length === 0 ? `Use Add New ${REFERENCE_TABS[key].singular} to create the first one.` : 'Try a different search.'}
                  />
                }
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ReferenceItemSheet tab={tab} mode={sheet?.mode} item={sheet?.item} onSubmit={saveSheet} onDelete={setItemToDelete} onClose={() => setSheet(null)} />

      <AlertDialog open={Boolean(itemToDelete)} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tab.singular.toLowerCase()}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>Are you sure you want to delete "{itemToDelete ? nameOf(itemToDelete) : ''}"?</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => handleDelete(itemToDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReferenceDataManager;
