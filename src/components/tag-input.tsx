'use client';

import { useId, useState } from 'react';
import { inputCls } from '@/components/ui';
import { cleanTag, MAX_TAG_LENGTH, MAX_TAGS_PER_ITEM } from '@/lib/tags';

/**
 * Free-text tags: type one and press Enter (or a comma), or tap one already used. Each tag shows as a chip with a remove button.
 * The form gets the tags as a JSON list in one hidden field. suggestions are the account's tags, offered while typing so the
 * same tag is reused rather than spelt a new way.
 */
export function TagInput({ name, suggestions, defaultTags = [], label = 'Tags', hint, className }: {
  name: string;
  suggestions: readonly string[];
  defaultTags?: readonly string[];
  label?: string;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  const [tags, setTags] = useState<string[]>(() => [...defaultTags]);
  const [text, setText] = useState('');
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  const add = (raw: string) => {
    const t = cleanTag(raw).slice(0, MAX_TAG_LENGTH).trim();
    setText('');
    if (!t || has(t) || tags.length >= MAX_TAGS_PER_ITEM) return;
    // Reuse the spelling of a tag that already exists.
    const known = suggestions.find((s) => s.toLowerCase() === t.toLowerCase());
    setTags((l) => [...l, known ?? t]);
  };
  const q = cleanTag(text).toLowerCase();
  const offers = suggestions.filter((s) => !has(s) && (!q || s.toLowerCase().includes(q))).slice(0, 8);
  const isNew = q && !suggestions.some((s) => s.toLowerCase() === q) && !has(q);

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={id} className="font-medium">{label}</label>
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen tags">
          {tags.map((t) => (
            <li key={t} className="flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm text-accent">
              {t}
              <button type="button" onClick={() => setTags((l) => l.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}
                className="flex size-5 items-center justify-center rounded-full text-xs hover:bg-accent hover:text-accent-ink">✕</button>
            </li>
          ))}
        </ul>
      )}
      <input id={id} className={inputCls} value={text} maxLength={MAX_TAG_LENGTH + 5} enterKeyHint="done" autoComplete="off"
        placeholder={tags.length >= MAX_TAGS_PER_ITEM ? `Up to ${MAX_TAGS_PER_ITEM} tags` : 'Type a tag, like Christmas or hand-me-down'}
        disabled={tags.length >= MAX_TAGS_PER_ITEM}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) v.split(',').slice(0, -1).forEach(add), setText(v.split(',').pop() ?? '');
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (text.trim()) add(text);
          } else if (e.key === 'Backspace' && !text && tags.length) setTags((l) => l.slice(0, -1));
        }}
        onBlur={() => { if (text.trim()) add(text); }} />
      {(offers.length > 0 || isNew) && (
        <div className="flex flex-wrap gap-1.5" aria-label="Tag suggestions">
          {isNew && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(text)}
              className="rounded-full border border-accent px-3 py-1 text-sm text-accent">+ Add &ldquo;{cleanTag(text)}&rdquo;</button>
          )}
          {offers.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{s}</button>
          ))}
        </div>
      )}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
