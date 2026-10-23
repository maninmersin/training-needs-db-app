import React, { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, DataTable, Dialog, DialogBody, DialogContent,
  DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, EmptyState, FileDrop, FormField,
  ImportStepper, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetBody,
  SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, Skeleton, StatCard, Switch,
  Tabs, TabsContent, TabsList, TabsTrigger, toast, Toolbar
} from '@/components/ui';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const PEOPLE = [
  { id: 100001, name: 'Amelia Brown', location: 'London', role: 'Finance Manager', courses: 4 },
  { id: 100002, name: 'Oliver Patel', location: 'London', role: 'Accounts Payable Clerk', courses: 3 },
  { id: 100003, name: 'Isla Walker', location: 'Manchester', role: 'Accounts Payable Clerk', courses: 3 },
  { id: 100004, name: 'George Khan', location: 'London', role: 'Buyer', courses: 0 }
];

const columns = [
  { accessorKey: 'id', header: 'ID', meta: { className: 'text-subtle-foreground tabular-nums' } },
  { accessorKey: 'name', header: 'Name', meta: { className: 'font-medium' } },
  { accessorKey: 'location', header: 'Location' },
  { accessorKey: 'role', header: 'Project role' },
  { accessorKey: 'courses', header: 'Courses', meta: { align: 'right', className: 'tabular-nums' } },
  {
    id: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => (row.original.courses ? <Badge variant="success">Assigned</Badge> : <Badge variant="warning">No courses</Badge>)
  }
];

/** Development-only page (route /ui-kit) showing every shared component, for reviewing both themes. */
export default function UiKit() {
  const [search, setSearch] = useState('');
  return (
    <div className="min-h-screen bg-background p-6 text-sm text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <PageHeader
          title="UI kit"
          description="Every shared component in the current theme. Use the toggle to check light and dark."
          actions={<ThemeToggle />}
        />

        <section aria-labelledby="kit-buttons" className="flex flex-col gap-3">
          <h2 id="kit-buttons" className="text-base font-semibold">Buttons and badges</h2>
          <Toolbar>
            <Button variant="default"><Plus /> Primary</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive"><Trash2 /> Remove</Button>
            <Button disabled>Disabled</Button>
            <Badge>Draft</Badge>
            <Badge variant="primary">In progress</Badge>
            <Badge variant="success">Complete</Badge>
            <Badge variant="warning">Needs a look</Badge>
            <Badge variant="danger">Failed</Badge>
          </Toolbar>
        </section>

        <section aria-labelledby="kit-forms" className="flex flex-col gap-3">
          <h2 id="kit-forms" className="text-base font-semibold">Form fields</h2>
          <div className="grid max-w-xl grid-cols-2 gap-3">
            <FormField label="Name" hint="As shown on invitations"><Input defaultValue="Isla Walker" /></FormField>
            <FormField label="Email" error="Enter a full email address"><Input defaultValue="isla@acme" /></FormField>
            <FormField label="Location">
              <Select defaultValue="mcr">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lon">London</SelectItem>
                  <SelectItem value="mcr">Manchester</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2"><Checkbox defaultChecked /> Active</label>
              <label className="flex items-center gap-2"><Switch defaultChecked /> Notify</label>
            </div>
          </div>
        </section>

        <section aria-labelledby="kit-table" className="flex flex-col gap-3">
          <h2 id="kit-table" className="text-base font-semibold">Data table</h2>
          <Toolbar>
            <Input aria-label="Search users" placeholder="Search" className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Toolbar>
          <DataTable columns={columns} data={PEOPLE} getRowId={(row) => String(row.id)} selectable globalFilter={search} caption="Example users" />
        </section>

        <section aria-labelledby="kit-overlays" className="flex flex-col gap-3">
          <h2 id="kit-overlays" className="text-base font-semibold">Dialogs, panels and messages</h2>
          <Toolbar>
            <Dialog>
              <DialogTrigger asChild><Button>Open dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Move to another session</DialogTitle>
                  <DialogDescription>Choose where this person should attend.</DialogDescription>
                </DialogHeader>
                <DialogBody>Dialog body content.</DialogBody>
                <DialogFooter><Button>Cancel</Button><Button variant="default">Move</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild><Button>Open side panel</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>Edit user</SheetTitle><SheetDescription>Changes apply to this project only.</SheetDescription></SheetHeader>
                <SheetBody><FormField label="First name"><Input defaultValue="Isla" /></FormField></SheetBody>
                <SheetFooter><Button>Cancel</Button><Button variant="default">Save changes</Button></SheetFooter>
              </SheetContent>
            </Sheet>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive">Confirm dialog</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Remove 2 users?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogDescription>They will also be removed from any sessions they are assigned to.</AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction destructive>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => toast.success('Saved', { description: '3 people updated.' })}>Show toast</Button>
          </Toolbar>
        </section>

        <section aria-labelledby="kit-misc" className="flex flex-col gap-4">
          <h2 id="kit-misc" className="text-base font-semibold">Import pieces, tabs, cards and states</h2>
          <ImportStepper current={1} />
          <div className="flex flex-wrap gap-3">
            <StatCard value={112} label="New people to add" />
            <StatCard value={9} label="Existing people updated" tone="success" />
            <StatCard value={4} label="Need a look" tone="warning" />
            <StatCard value={3} label="Cannot be imported" tone="danger" />
          </div>
          <FileDrop onFile={(file) => toast(`Selected ${file.name}`)} label="Choose a spreadsheet" hint=".xlsx or .csv" />
          <Tabs defaultValue="one">
            <TabsList><TabsTrigger value="one">Locations</TabsTrigger><TabsTrigger value="two">Divisions</TabsTrigger></TabsList>
            <TabsContent value="one">Locations content</TabsContent>
            <TabsContent value="two">Divisions content</TabsContent>
          </Tabs>
          <div className="grid grid-cols-2 gap-3">
            <Card><CardHeader><CardTitle>Card</CardTitle></CardHeader><CardContent>Card content</CardContent></Card>
            <Card className="p-4"><Skeleton className="mb-2 h-4 w-1/2" /><Skeleton className="h-4 w-full" /></Card>
          </div>
          <Card><EmptyState icon={Users} title="No users yet" description="Add people one at a time or import a spreadsheet." action={<Button variant="default"><Plus /> Add user</Button>} /></Card>
        </section>
      </div>
    </div>
  );
}
