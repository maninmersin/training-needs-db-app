import React from 'react';
import { FormField, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';

const NONE = '__none__'; // Radix Select cannot hold an empty value, so "nothing chosen" travels as this

/** A labelled dropdown over plain strings; '' means nothing chosen. Keeps a saved value even if it is no longer in `options`. */
export default function ChoiceField({ label, value, options, placeholder, error, onChange, disabled }) {
  const choices = value && !options.includes(value) ? [value, ...options] : options; // keep a saved value that is no longer in the list
  return (
    <FormField label={label} error={error}>
      {(fieldProps) => (
        <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)} disabled={disabled}>
          <SelectTrigger {...fieldProps}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{placeholder}</SelectItem>
            {choices.map((choice) => (
              <SelectItem key={choice} value={choice}>{choice}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}
