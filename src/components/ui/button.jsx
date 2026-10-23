import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-sm font-medium transition-colors ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground hover:brightness-110',
        secondary: 'border-border-strong bg-card text-foreground hover:bg-accent',
        ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive: 'border-border-strong bg-card text-destructive hover:bg-destructive-soft',
        link: 'border-transparent bg-transparent text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-10 px-4',
        icon: 'size-8 p-0',
        'icon-sm': 'size-7 p-0'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'default' }
  }
);

export const Button = React.forwardRef(function Button({ className, variant, size, asChild = false, type, ...props }, ref) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type || 'button'}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
