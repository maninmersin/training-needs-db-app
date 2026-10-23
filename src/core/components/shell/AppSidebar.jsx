import React from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/overlays';
import ProjectSwitcher from './ProjectSwitcher';
import UserMenu from './UserMenu';

function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-[30px] items-center gap-2.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          isActive && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground',
          collapsed && 'justify-center px-0'
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/** Left navigation: project switcher, grouped links, user menu. Collapses to icons. */
export default function AppSidebar({ sections, collapsed, onToggleCollapsed, mobileOpen, onNavigate, onLogout }) {
  return (
    <aside
      data-testid="sidebar"
      aria-label="Main"
      className={cn(
        'fixed inset-y-0 left-0 z-[1000] flex flex-col border-r border-border bg-card text-foreground transition-[width,transform] duration-200',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
        !mobileOpen && 'max-md:-translate-x-full'
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 pb-2 pt-3', collapsed && 'flex-col px-2')}>
        <div className="grid size-6 shrink-0 place-content-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground" aria-hidden="true">T</div>
        {!collapsed && <div className="flex-1 truncate text-[14px] font-semibold">Training Needs</div>}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="max-md:hidden"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <div className={cn('px-2.5 pb-1.5', collapsed && 'px-2')}>
        <ProjectSwitcher collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-px">
            {section.label &&
              (collapsed ? (
                <div className="mx-2 my-2 h-px bg-border" role="separator" />
              ) : (
                <div className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">{section.label}</div>
              ))}
            {section.items.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <UserMenu collapsed={collapsed} onLogout={onLogout} />
    </aside>
  );
}
