import React, { useRef, useState } from 'react';
import { Check, FileSpreadsheet, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/** Upload > Check > Apply progress, shared by every import screen. `current` is the 0-based active step. */
export function ImportStepper({ steps = ['Upload file', 'Check', 'Apply'], current = 0, className }) {
  return (
    <ol aria-label="Import steps" className={cn('flex flex-wrap gap-x-7 gap-y-2', className)}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className={cn('flex items-center gap-2 text-sm font-medium', active ? 'text-foreground' : done ? 'text-muted-foreground' : 'text-subtle-foreground')}>
            <span
              className={cn(
                'grid size-[22px] place-content-center rounded-full border text-xs tabular-nums',
                done && 'border-transparent bg-success-soft text-success',
                active && 'border-primary bg-primary text-primary-foreground',
                !done && !active && 'border-border-strong'
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : index + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Drop zone / picker for a spreadsheet. Calls `onFile(file)` for the chosen file.
 * The hidden input keeps the accessible name from `label`, so tests and screen readers can find it.
 */
export function FileDrop({ onFile, accept = '.xlsx,.xls,.csv', label = 'Choose a file', hint, disabled = false, className }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handle = (file) => {
    if (file && onFile) onFile(file);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) handle(event.dataTransfer.files?.[0]);
      }}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-card px-6 py-10 text-center transition-colors',
        over && 'border-primary bg-primary-soft',
        className
      )}
    >
      <Upload className="size-7 text-subtle-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Drop a file here, or</p>
      <Button variant="default" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <FileSpreadsheet /> {label}
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-label={label}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          handle(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
}
