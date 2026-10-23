import React from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, KeyRound, UserCog } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

const ADMIN_FUNCTIONS = [
  { title: 'Projects', description: 'Create and manage projects, and choose where each one gets its training data', icon: FolderKanban, path: '/projects' },
  { title: 'User Management', description: 'Manage user accounts, profiles, and system access', icon: UserCog, path: '/user-management' },
  { title: 'Roles & Permissions', description: 'Define system roles and manage user permissions', icon: KeyRound, path: '/role-permissions' }
];

const AdminDashboard = () => (
  <div className="mx-auto flex max-w-5xl flex-col gap-4">
    <PageHeader title="System Administration" description="Centralized management of projects, users, access controls, and system security." />

    <section aria-label="Core admin functions" className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Core Admin Functions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_FUNCTIONS.map(({ title, description, icon: Icon, path }) => (
          <Link key={path} to={path} className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:border-border-strong hover:bg-accent">
              <span className="grid size-9 shrink-0 place-content-center rounded-md bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-sm text-muted-foreground">{description}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  </div>
);

export default AdminDashboard;
