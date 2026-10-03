import React, { useState, useEffect } from 'react';

/**
 * A number box you can clear with backspace.
 *
 * A plain `value={n} onChange={e => set(Number(e.target.value))}` turns an empty box into 0 the moment
 * the last digit is deleted (Number('') is 0), so there is nothing left to edit. This keeps what you
 * type as text, reports only real numbers to the parent, and puts the last valid value back if you
 * leave the box empty.
 *
 * @param {number} value - The current numeric value
 * @param {(n: number) => void} onValueChange - Called with each valid number as it is typed
 */
const NumberInput = ({ value, onValueChange, ...inputProps }) => {
  const [text, setText] = useState(String(value ?? ''));

  // Follow changes made from outside (e.g. defaults being restored). Typing never triggers this,
  // because a typed number is reported to the parent and then matches the text.
  useEffect(() => {
    if (Number(text) !== Number(value) || text === '') {
      setText(String(value ?? ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (event) => {
    const next = event.target.value;
    setText(next);
    if (next !== '' && Number.isFinite(Number(next))) {
      onValueChange(Number(next));
    }
  };

  const handleBlur = () => {
    // Left empty or unreadable: go back to the last valid value
    if (text === '' || !Number.isFinite(Number(text))) {
      setText(String(value ?? ''));
    }
  };

  return (
    <input
      {...inputProps}
      type="number"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

export default NumberInput;
