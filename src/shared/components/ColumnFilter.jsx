import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Checkbox, Input, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';
import { BLANK, NOT_BLANK } from './listFilters';

function Option({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <span className="truncate">{children}</span>
    </label>
  );
}

/** Multi-select filter for one column: a button showing the current choice, opening a searchable checklist. */
export default function ColumnFilter({ label, values, selected, onChange }) {
  const [search, setSearch] = useState('');
  const visible = values.filter((value) => value.toLowerCase().includes(search.toLowerCase()));

  const summary =
    selected.length === 0 ? 'All' : selected.length === 1 ? (selected[0] === BLANK ? '(blank)' : selected[0] === NOT_BLANK ? '(not blank)' : selected[0]) : `${selected.length} selected`;

  const toggle = (value, on) => onChange(on ? [...selected, value] : selected.filter((item) => item !== value));

  const allVisibleSelected = visible.length > 0 && visible.every((value) => selected.includes(value)) && selected.includes(BLANK) && selected.includes(NOT_BLANK);
  const selectAll = (on) =>
    onChange(on ? [...new Set([...selected, BLANK, NOT_BLANK, ...visible])] : selected.filter((value) => !visible.includes(value) && value !== BLANK && value !== NOT_BLANK));

  return (
    <Popover onOpenChange={(open) => !open && setSearch('')}>
      <PopoverTrigger asChild>
        <Button aria-label={`Filter by ${label}: ${summary}`} className={cn(selected.length > 0 && 'border-primary bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft')}>
          {label}
          <span className="max-w-28 truncate font-normal text-muted-foreground">{summary}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-2 p-2">
        <Input aria-label={`Search ${label} values`} placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="max-h-64 overflow-y-auto">
          <Option checked={allVisibleSelected} onChange={selectAll}>Select All</Option>
          <div className="my-1 h-px bg-border" role="separator" />
          <Option checked={selected.includes(BLANK)} onChange={(on) => toggle(BLANK, on)}>(blank)</Option>
          <Option checked={selected.includes(NOT_BLANK)} onChange={(on) => toggle(NOT_BLANK, on)}>(not blank)</Option>
          {visible.length > 0 && <div className="my-1 h-px bg-border" role="separator" />}
          {visible.map((value) => (
            <Option key={value} checked={selected.includes(value)} onChange={(on) => toggle(value, on)}>{value}</Option>
          ))}
          {visible.length === 0 && <p className="px-1.5 py-1 text-sm italic text-muted-foreground">{values.length === 0 ? 'No values' : 'No values found'}</p>}
        </div>
        <div className="flex justify-end border-t border-border pt-2">
          <Button size="sm" variant="ghost" onClick={() => onChange([])} disabled={selected.length === 0}>Clear</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
