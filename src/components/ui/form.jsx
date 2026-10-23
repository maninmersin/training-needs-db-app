import React, { useId } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return <LabelPrimitive.Root ref={ref} className={cn('text-xs font-medium text-muted-foreground', className)} {...props} />;
});

const controlClasses =
  'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-subtle-foreground ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50 aria-[invalid=true]:border-destructive';

export const Input = React.forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={cn(controlClasses, className)} {...props} />;
});

export const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlClasses, 'h-auto min-h-16 py-1.5', className)} {...props} />;
});

/**
 * A label + control + hint/error. The control is cloned with the generated id and aria attributes, so
 * the label is associated and screen readers read the hint or error. Pass a function child to place
 * the props yourself: <FormField label="X">{(props) => <SelectTrigger {...props} />}</FormField>.
 */
export function FormField({ label, hint, error, className, children }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const controlProps = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
  // A function child receives the props to spread on the real control (needed for Select, whose root ignores them)
  const control =
    typeof children === 'function'
      ? children(controlProps)
      : React.isValidElement(children)
        ? React.cloneElement(children, { ...controlProps, id: children.props.id || id })
        : children;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <Label htmlFor={typeof children === 'function' ? id : children?.props?.id || id}>{label}</Label>}
      {control}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const Checkbox = React.forwardRef(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer grid size-4 shrink-0 place-content-center rounded-[4px] border border-border-strong bg-background ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 ' +
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ' +
          'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {props.checked === 'indeterminate' ? <span className="block h-0.5 w-2 rounded bg-current" /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export const Switch = React.forwardRef(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-border-strong transition-colors ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 data-[state=checked]:bg-primary',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
});
