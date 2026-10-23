import React from 'react';
import { Toaster as Sonner, toast } from 'sonner';
import { useTheme } from '@/components/theme/ThemeProvider';

/** Toast host. Mount once near the root; call `toast.success('Saved')` etc. instead of alert(). */
export function Toaster(props) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!border !border-border-strong !bg-popover !text-popover-foreground !text-sm !shadow-lg',
          description: '!text-muted-foreground'
        }
      }}
      {...props}
    />
  );
}

export { toast };
