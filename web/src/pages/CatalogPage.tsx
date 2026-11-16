import {
  catalogSorts,
  courseLevels,
  durationBuckets,
  locales,
  type CategoryNode,
} from '@lumio/shared';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useCatalog, useCategories } from '../api/catalog.js';
import { CourseCard, CourseCardSkeleton } from '../components/CourseCard.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { SearchBox } from '../components/SearchBox.js';

const FILTER_KEYS = ['category', 'level', 'duration', 'price', 'language', 'rating', 'certificate'];

interface RadioGroupProps {
  name: string;
  legend: string;
  value: string | null;
  options: { value: string; label: string; count?: number; depth?: number }[];
  onChange: (value: string | null) => void;
}

function RadioGroup({ name, legend, value, options, onChange }: RadioGroupProps) {
  const { t } = useTranslation();
  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      <label className="filter-option">
        <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} />
        {t('catalog.any')}
      </label>
      {options.map((option) => (
        <label
          key={option.value}
          className="filter-option"
          style={option.depth ? { paddingLeft: option.depth * 16 } : undefined}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
          {option.count !== undefined && <span className="filter-count">{option.count}</span>}
        </label>
      ))}
    </fieldset>
  );
}

function flatten(nodes: CategoryNode[], depth = 0): RadioGroupProps['options'] {
  return nodes.flatMap((node) => [
    { value: node.slug, label: node.name, count: node.courseCount, depth },
    ...flatten(node.children, depth + 1),
  ]);
}

export function CatalogPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const catalog = useCatalog(params);
  const categories = useCategories();

  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const sort = params.get('sort') ?? 'popular';
  const activeFilters = FILTER_KEYS.filter((key) => params.has(key)).length;

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (params.has('sort')) next.set('sort', sort);
    setParams(next);
  }

  const data = catalog.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="wrap page catalog">
      <header className="page-head">
        <h2>{t('catalog.title')}</h2>
        <p className="lead">{t('catalog.lead')}</p>
        <SearchBox initial={q} />
      </header>

      <div className="catalog-layout">
        <aside className={`filters ${filtersOpen ? 'open' : ''}`} aria-label={t('catalog.filters')}>
          <div className="filters-head">
            <h3>{t('catalog.filters')}</h3>
            {activeFilters > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                {t('catalog.clear')}
              </button>
            )}
          </div>
          {categories.data && (
            <RadioGroup
              name="category"
              legend={t('catalog.category')}
              value={params.get('category')}
              options={flatten(categories.data)}
              onChange={(value) => update('category', value)}
            />
          )}
          <RadioGroup
            name="level"
            legend={t('catalog.level')}
            value={params.get('level')}
            options={courseLevels.map((level) => ({ value: level, label: t(`levels.${level}`) }))}
            onChange={(value) => update('level', value)}
          />
          <RadioGroup
            name="duration"
            legend={t('catalog.duration')}
            value={params.get('duration')}
            options={durationBuckets.map((bucket) => ({
              value: bucket,
              label: t(`catalog.durations.${bucket}`),
            }))}
            onChange={(value) => update('duration', value)}
          />
          <RadioGroup
            name="price"
            legend={t('catalog.price')}
            value={params.get('price')}
            options={(['free', 'paid'] as const).map((price) => ({
              value: price,
              label: t(`catalog.prices.${price}`),
            }))}
            onChange={(value) => update('price', value)}
          />
          <RadioGroup
            name="language"
            legend={t('catalog.language')}
            value={params.get('language')}
            options={locales.map((locale) => ({ value: locale, label: t(`languages.${locale}`) }))}
            onChange={(value) => update('language', value)}
          />
          <RadioGroup
            name="rating"
            legend={t('catalog.rating')}
            value={params.get('rating')}
            options={['4.5', '4', '3.5'].map((value) => ({
              value,
              label: `★ ${t('catalog.ratingAtLeast', { value })}`,
            }))}
            onChange={(value) => update('rating', value)}
          />
          <fieldset className="filter-group">
            <label className="filter-option">
              <input
                type="checkbox"
                checked={params.get('certificate') === 'true'}
                onChange={(event) => update('certificate', event.target.checked ? 'true' : null)}
              />
              {t('catalog.certificateOnly')}
            </label>
          </fieldset>
        </aside>

        <section className="results" aria-busy={catalog.isFetching}>
          <div className="results-bar">
            <p className="results-count" role="status">
              {data &&
                (q
                  ? t('catalog.resultsFor', { count: data.total, q })
                  : t('catalog.results', { count: data.total }))}
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm filters-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal size={15} aria-hidden="true" />
              {filtersOpen ? t('catalog.hideFilters') : t('catalog.showFilters')}
              {activeFilters > 0 && ` (${activeFilters})`}
            </button>
            <label className="sort">
              <span>{t('catalog.sort')}</span>
              <select
                className="input"
                value={sort}
                onChange={(event) =>
                  update('sort', event.target.value === 'popular' ? null : event.target.value)
                }
              >
                {catalogSorts.map((option) => (
                  <option key={option} value={option}>
                    {t(`catalog.sorts.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {catalog.isError && (
            <ErrorAlert error={catalog.error}>
              <button className="btn btn-ghost btn-sm" onClick={() => void catalog.refetch()}>
                {t('common.retry')}
              </button>
            </ErrorAlert>
          )}

          {catalog.isPending && (
            <div className="catalog-grid">
              {Array.from({ length: 6 }, (_, index) => (
                <CourseCardSkeleton key={index} />
              ))}
            </div>
          )}

          {data && data.total === 0 && (
            <div className="empty-results card">
              <h3>{t('catalog.emptyTitle')}</h3>
              <p>{t('catalog.emptyBody')}</p>
              {activeFilters > 0 && (
                <button type="button" className="btn btn-primary" onClick={clearFilters}>
                  {t('catalog.clear')}
                </button>
              )}
            </div>
          )}

          {data && data.total > 0 && (
            <>
              <div className={`catalog-grid ${catalog.isPlaceholderData ? 'stale' : ''}`}>
                {data.items.map((course) => (
                  <CourseCard key={course.slug} course={course} />
                ))}
              </div>
              {pages > 1 && (
                <nav className="pagination" aria-label={t('catalog.pageOf', { page, pages })}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => update('page', String(page - 1))}
                  >
                    {t('catalog.previous')}
                  </button>
                  <span>{t('catalog.pageOf', { page, pages })}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={page >= pages}
                    onClick={() => update('page', String(page + 1))}
                  >
                    {t('catalog.next')}
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
