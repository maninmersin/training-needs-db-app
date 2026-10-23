import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useProject } from '@core/contexts/ProjectContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/overlays';
import AppSidebar from './AppSidebar';
import { getBreadcrumbTrail, getNavSections } from './navigation';

const COLLAPSED_KEY = 'sidebarOpen'; // same key as the old sidebar, so a saved choice carries over
const CHROMELESS_PATHS = ['/login', '/unauthorized'];

const readOpen = () => {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
};

/**
 * The page frame: left sidebar, slim top bar with breadcrumbs, and the page content.
 * The login pages get no frame. The `sidebar-open` / `sidebar-collapsed` body class is kept
 * because some older screens position themselves from it.
 */
export default function AppShell({ children, onLogout }) {
  const { pathname } = useLocation();
  const { currentProject } = useProject();
  const [sidebarOpen, setSidebarOpen] = useState(readOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  const usesAccessData = (currentProject?.training_data_source || 'access') === 'access';
  const sections = useMemo(() => getNavSections({ usesAccessData }), [usesAccessData]);
  const trail = getBreadcrumbTrail(pathname, sections);
  const chromeless = CHROMELESS_PATHS.includes(pathname);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    document.body.classList.toggle('sidebar-collapsed', !sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      // the choice still applies for this visit
    }
  };

  if (chromeless) return <div className="min-h-screen bg-background">{children}</div>;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="min-h-screen bg-background text-foreground"
        style={{ '--shell-top': '44px', '--sidebar-width': '232px', '--sidebar-collapsed-width': '56px' }}
      >
        <AppSidebar
          sections={sections}
          collapsed={!sidebarOpen}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
          onLogout={onLogout}
        />
        {mobileOpen && <div className="fixed inset-0 z-[999] bg-black/45 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

        <div className={cn('transition-[margin] duration-200', sidebarOpen ? 'md:ml-[var(--sidebar-width)]' : 'md:ml-[var(--sidebar-collapsed-width)]')}>
          <header className="sticky top-0 z-40 flex h-[var(--shell-top)] items-center gap-2 border-b border-border bg-card px-4 md:px-6">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
              <Menu />
            </Button>
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-1.5 text-[12.5px] text-subtle-foreground">
                {trail.map((crumb, index) => (
                  <li key={`${crumb}-${index}`} className="flex items-center gap-1.5">
                    {index > 0 && <span aria-hidden="true">/</span>}
                    <span className={index === trail.length - 1 ? 'font-medium text-muted-foreground' : undefined} aria-current={index === trail.length - 1 ? 'page' : undefined}>
                      {crumb}
                    </span>
                  </li>
                ))}
              </ol>
            </nav>
          </header>
          <main className="p-5">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
