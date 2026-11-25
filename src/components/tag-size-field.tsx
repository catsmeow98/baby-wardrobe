'use client';

import { inputCls, labelCls } from '@/components/ui';
import { parseTagRange } from '@/lib/domain';
import type { SizeLabelRow } from '@/lib/db';

export interface TagValue {
  /** A tag from the list, or '' */
  tagId: string;
  /** True when "Custom range" is chosen. */
  custom: boolean;
  /** The custom range as typed, such as "6-12". */
  text: string;
}

/**
 * Tag size: pick from the list, or choose "Custom range" and type months such as 6-12 or 0-9.
 * The select has no name. The values travel in two hidden fields, so the server reads either a tag id or a custom range.
 */
export function TagSizeField({ labels, value, onChange, tagName, customName, className = labelCls, notSet = 'Not set' }: {
  labels: readonly SizeLabelRow[];
  value: TagValue;
  onChange: (next: TagValue) => void;
  tagName: string;
  customName: string;
  className?: string;
  notSet?: string;
}) {
  const parsed = value.custom && value.text.trim() ? parseTagRange(value.text) : null;
  return (
    <div className={className}>
      <label className="flex flex-col gap-1">
        Tag size (as printed)
        <select
          className={inputCls}
          value={value.custom ? 'custom' : value.tagId}
          onChange={(e) => (e.target.value === 'custom' ? onChange({ ...value, tagId: '', custom: true }) : onChange({ tagId: e.target.value, custom: false, text: value.text }))}
        >
          <option value="">{notSet}</option>
          {labels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          <option value="custom">Custom range…</option>
        </select>
      </label>
      <input type="hidden" name={tagName} value={value.custom ? '' : value.tagId} />
      <input type="hidden" name={customName} value={value.custom ? value.text.trim() : ''} />
      {value.custom && (
        <>
          <input
            className={inputCls}
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            inputMode="numeric"
            maxLength={20}
            placeholder="Months, like 6-12 or 0-9"
            aria-label="Custom tag range in months"
            aria-invalid={parsed !== null && 'error' in parsed}
          />
          {parsed && 'error' in parsed && <span role="alert" className="text-xs text-bad">{parsed.error}</span>}
        </>
      )}
    </div>
  );
}
