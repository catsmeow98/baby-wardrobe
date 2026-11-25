'use client';

import { useState } from 'react';
import { inputCls } from '@/components/ui';

const NEW = '__new';

/**
 * A brand dropdown with "Add new brand". The form submits one field called name with the brand's name (empty for no brand),
 * which the server matches to an existing brand or creates.
 */
export function BrandSelect({ brands, name, defaultValue = '', label = 'Brand' }: { brands: readonly string[]; name: string; defaultValue?: string; label?: string }) {
  // A brand already on the item always appears, even if it is not in the list.
  const list = defaultValue && !brands.some((b) => b.toLowerCase() === defaultValue.toLowerCase()) ? [...brands, defaultValue] : [...brands];
  const start = defaultValue ? (list.find((b) => b.toLowerCase() === defaultValue.toLowerCase()) ?? '') : '';
  const [choice, setChoice] = useState<string>(start);
  const [text, setText] = useState('');
  const value = choice === NEW ? text.trim() : choice;
  return (
    <>
      <select className={inputCls} value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={label}>
        <option value="">No brand</option>
        {list.map((b) => <option key={b} value={b}>{b}</option>)}
        <option value={NEW}>+ Add new brand…</option>
      </select>
      {choice === NEW && (
        <input className={`${inputCls} mt-1.5`} value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="New brand name" aria-label="New brand name" required />
      )}
      <input type="hidden" name={name} value={value} />
    </>
  );
}
