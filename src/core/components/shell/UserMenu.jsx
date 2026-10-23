import React from 'react';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/overlays';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useCurrentUser } from './useCurrentUser';

const initials = (email) => (email ? email.slice(0, 2).toUpperCase() : '?');

/** Signed-in user, theme picker and Logout, pinned to the bottom of the sidebar. */
export default function UserMenu({ collapsed, onLogout }) {
  const { user, role } = useCurrentUser();
  if (!user) return null;

  const logout = (
    <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Logout">
      <LogOut />
    </Button>
  );

  return (
    <div className={cn('flex items-center gap-2 border-t border-border px-3 py-2.5', collapsed && 'flex-col px-2')}>
      <div
        className="grid size-7 shrink-0 place-content-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
        title={user.email}
        aria-hidden="true"
      >
        {initials(user.email)}
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium" title={user.email}>{user.email}</span>
          {role && <span className="truncate text-xs text-subtle-foreground">{role}</span>}
        </div>
      )}
      <ThemeToggle />
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{logout}</TooltipTrigger>
          <TooltipContent side="right">Logout</TooltipContent>
        </Tooltip>
      ) : (
        logout
      )}
    </div>
  );
}
