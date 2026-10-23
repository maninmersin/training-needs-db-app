import React from 'react';
import { CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Checkbox } from '@/components/ui';

const DAYS = [
  { index: 0, name: 'Sunday', short: 'Sun' },
  { index: 1, name: 'Monday', short: 'Mon' },
  { index: 2, name: 'Tuesday', short: 'Tue' },
  { index: 3, name: 'Wednesday', short: 'Wed' },
  { index: 4, name: 'Thursday', short: 'Thu' },
  { index: 5, name: 'Friday', short: 'Fri' },
  { index: 6, name: 'Saturday', short: 'Sat' }
];

// Which days each quick choice shows
const PRESETS = {
  business: (index) => index >= 1 && index <= 5,
  all: () => true,
  weekends: (index) => index === 0 || index === 6
};

const CalendarDayControls = ({ visibleDays, onDayToggle, collapsed, onToggle }) => {
  const visibleCount = Object.values(visibleDays).filter(Boolean).length;

  const handlePreset = (preset) => {
    DAYS.forEach((day) => onDayToggle(day.index, PRESETS[preset](day.index)));
  };

  return (
    <div className="calendar-day-controls border-b border-border">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="flex w-full items-center gap-2 bg-secondary px-3 py-2 text-left text-xs font-semibold hover:bg-accent"
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        <CalendarDays className="size-3.5" />
        <span>Calendar Days</span>
        <span className="visible-count ml-auto font-normal text-muted-foreground">{visibleCount} of 7 visible</span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-3 px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => handlePreset('business')} title="Show Monday through Friday only">Business Days</Button>
            <Button size="sm" onClick={() => handlePreset('all')} title="Show all 7 days">All Days</Button>
            <Button size="sm" onClick={() => handlePreset('weekends')} title="Show weekends only">Weekends</Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => (
              <label
                key={day.index}
                title={day.name}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-border px-1 py-1.5 text-xs hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-selected"
              >
                <Checkbox
                  aria-label={day.name}
                  checked={visibleDays[day.index] || false}
                  onCheckedChange={(checked) => onDayToggle(day.index, checked === true)}
                />
                <span>{day.short}</span>
              </label>
            ))}
          </div>

          {visibleCount === 0 && (
            <p role="alert" className="rounded-md bg-warning-soft px-2 py-1.5 text-xs text-warning">No days are visible. Please select at least one day.</p>
          )}

          <p className="text-xs text-muted-foreground">Hide days when training cannot be scheduled (holidays, maintenance, etc.)</p>
        </div>
      )}
    </div>
  );
};

export default CalendarDayControls;
