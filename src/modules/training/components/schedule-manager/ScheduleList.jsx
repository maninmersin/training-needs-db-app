import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Pencil } from 'lucide-react';
import { Badge, Button, DataTable, EmptyState } from '@/components/ui';
import { sessionCountOf } from './scheduleManagerLogic';

const formatDate = (value) => {
  try {
    return format(new Date(value), 'MMM dd, yyyy HH:mm');
  } catch {
    return value;
  }
};

const ScheduleList = ({ schedules, onSelectionChange, onEdit, onRefresh, loading = false }) => {
  const columns = useMemo(
    () => [
      { accessorKey: 'name', header: 'Schedule Name', meta: { className: 'min-w-64 font-medium' } },
      { id: 'created', header: 'Created', accessorFn: (schedule) => schedule.created_at, cell: ({ getValue }) => formatDate(getValue()), meta: { className: 'whitespace-nowrap text-muted-foreground' } },
      { id: 'modified', header: 'Modified', accessorFn: (schedule) => schedule.updated_at, cell: ({ getValue }) => formatDate(getValue()), meta: { className: 'whitespace-nowrap text-muted-foreground' } },
      {
        id: 'sessions',
        header: 'Sessions',
        accessorFn: (schedule) => sessionCountOf(schedule),
        cell: ({ getValue }) => <Badge>{getValue()} sessions</Badge>
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <Button size="sm" variant="ghost" aria-label={`Edit ${row.original.name}`} onClick={() => onEdit(row.original.id)}>
            <Pencil /> Edit
          </Button>
        )
      }
    ],
    [onEdit]
  );

  return (
    <DataTable
      caption="Training schedules"
      columns={columns}
      data={schedules}
      getRowId={(schedule) => schedule.id}
      selectable
      onSelectionChange={(rows) => onSelectionChange(rows.map((schedule) => schedule.id))}
      loading={loading}
      initialSorting={[]}
      emptyState={
        <EmptyState
          icon={CalendarDays}
          title="No Schedules Found"
          description="No training schedules match your current filters."
          action={<Button onClick={onRefresh}>Refresh</Button>}
        />
      }
    />
  );
};

export default ScheduleList;
