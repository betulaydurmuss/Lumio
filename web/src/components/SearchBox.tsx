import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSuggestions } from '../api/catalog.js';

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

interface Option {
  kind: 'course' | 'term';
  value: string;
  label: string;
}

/**
 * Search with autocomplete. Course suggestions open the course; popular
 * searches run that search. Arrow keys move through the list, Escape closes it.
 */
export function SearchBox({ initial = '', size = 'md' }: { initial?: string; size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listId = useId();
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLFormElement>(null);
  const q = useDebounced(value.trim(), 200);
  const suggestions = useSuggestions(q, open);

  useEffect(() => setValue(initial), [initial]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options: Option[] = [
    ...(suggestions.data?.courses ?? []).map((course) => ({
      kind: 'course' as const,
      value: course.slug,
      label: course.title,
    })),
    ...(q.length < 2 ? (suggestions.data?.popular ?? []) : []).map((term) => ({
      kind: 'term' as const,
      value: term,
      label: term,
    })),
  ];

  function choose(option: Option) {
    setOpen(false);
    if (option.kind === 'course') void navigate(`/courses/${option.value}`);
    else {
      setValue(option.value);
      void navigate(`/courses?q=${encodeURIComponent(option.value)}`);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const chosen = options[active];
    if (open && chosen) return choose(chosen);
    setOpen(false);
    const params = new URLSearchParams();
    if (value.trim()) params.set('q', value.trim());
    void navigate(`/courses${params.size ? `?${params}` : ''}`);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && options.length > 0;
  const firstTerm = options.findIndex((option) => option.kind === 'term');

  return (
    <form ref={wrapper} className={`search-box search-${size}`} role="search" onSubmit={submit}>
      <label htmlFor={`${listId}-input`} className="visually-hidden">
        {t('catalog.searchLabel')}
      </label>
      <Search size={18} className="search-icon" aria-hidden="true" />
      <input
        id={`${listId}-input`}
        className="input"
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        maxLength={100}
        placeholder={t('catalog.searchPlaceholder')}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <button className="btn btn-primary" type="submit">
        {t('catalog.search')}
      </button>
      {showList && (
        <ul id={listId} role="listbox" className="suggestions">
          {options.map((option, index) => (
            <li
              key={`${option.kind}-${option.value}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
            >
              {index === 0 && option.kind === 'course' && (
                <span className="suggestions-head">{t('catalog.suggestedCourses')}</span>
              )}
              {index === firstTerm && (
                <span className="suggestions-head">{t('catalog.popularSearches')}</span>
              )}
              <span className={`suggestion suggestion-${option.kind}`}>{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
