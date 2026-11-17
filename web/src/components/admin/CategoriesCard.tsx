import type { PlatformCategory } from '@lumio/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCreateCategory,
  useDeleteCategory,
  usePlatformCategories,
  useRenameCategory,
} from '../../api/platform.js';
import { ErrorAlert } from '../ErrorAlert.js';

function RenameRow({ category, onDone }: { category: PlatformCategory; onDone: () => void }) {
  const { t } = useTranslation();
  const rename = useRenameCategory();
  const [nameTr, setNameTr] = useState(category.nameTr);
  const [nameEn, setNameEn] = useState(category.nameEn);

  function submit(event: FormEvent) {
    event.preventDefault();
    rename.mutate({ slug: category.slug, nameTr, nameEn }, { onSuccess: onDone });
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label className="sr-only" htmlFor={`tr-${category.slug}`}>
        {t('categories.nameTr')}
      </label>
      <input
        id={`tr-${category.slug}`}
        className="input"
        value={nameTr}
        onChange={(event) => setNameTr(event.target.value)}
      />
      <label className="sr-only" htmlFor={`en-${category.slug}`}>
        {t('categories.nameEn')}
      </label>
      <input
        id={`en-${category.slug}`}
        className="input"
        value={nameEn}
        onChange={(event) => setNameEn(event.target.value)}
      />
      <button className="btn btn-accent btn-sm" type="submit" disabled={rename.isPending}>
        {t('categories.save')}
      </button>
      <button className="btn btn-secondary btn-sm" type="button" onClick={onDone}>
        {t('categories.cancel')}
      </button>
      {rename.error && <ErrorAlert error={rename.error} />}
    </form>
  );
}

function AddCategory({ parents }: { parents: PlatformCategory[] }) {
  const { t, i18n } = useTranslation();
  const create = useCreateCategory();
  const [slug, setSlug] = useState('');
  const [nameTr, setNameTr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [parentSlug, setParentSlug] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { slug, nameTr, nameEn, parentSlug: parentSlug || null },
      {
        onSuccess: () => {
          setSlug('');
          setNameTr('');
          setNameEn('');
        },
      },
    );
  }

  return (
    <form className="category-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="cat-tr">{t('categories.nameTr')}</label>
        <input
          id="cat-tr"
          className="input"
          required
          value={nameTr}
          onChange={(event) => setNameTr(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="cat-en">{t('categories.nameEn')}</label>
        <input
          id="cat-en"
          className="input"
          required
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="cat-slug">{t('categories.slug')}</label>
        <input
          id="cat-slug"
          className="input"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby="cat-slug-hint"
          value={slug}
          onChange={(event) => setSlug(event.target.value.toLowerCase())}
        />
        <p id="cat-slug-hint" className="hint">
          {t('categories.slugHint')}
        </p>
      </div>
      <div className="field">
        <label htmlFor="cat-parent">{t('categories.parent')}</label>
        <select
          id="cat-parent"
          className="input"
          value={parentSlug}
          onChange={(event) => setParentSlug(event.target.value)}
        >
          <option value="">{t('categories.topLevel')}</option>
          {parents.map((parent) => (
            <option key={parent.slug} value={parent.slug}>
              {i18n.resolvedLanguage === 'en' ? parent.nameEn : parent.nameTr}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-accent" type="submit" disabled={create.isPending}>
        {t('categories.add')}
      </button>
      {create.error && <ErrorAlert error={create.error} />}
    </form>
  );
}

/** The catalog's category tree: two levels, with how many courses hang on each. */
export function CategoriesCard() {
  const { t, i18n } = useTranslation();
  const categories = usePlatformCategories();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<string | null>(null);
  const rows = categories.data ?? [];
  const parents = rows.filter((row) => !row.parentSlug);
  const ordered = parents.flatMap((parent) => [
    parent,
    ...rows.filter((row) => row.parentSlug === parent.slug),
  ]);
  const name = (row: PlatformCategory) =>
    i18n.resolvedLanguage === 'en' ? row.nameEn : row.nameTr;

  return (
    <article className="card">
      <h3>{t('categories.title')}</h3>
      <p className="hint">{t('categories.lead')}</p>
      {categories.isError && <ErrorAlert error={categories.error} />}
      {remove.error && <ErrorAlert error={remove.error} />}
      {categories.isPending && <div className="skeleton" style={{ height: 120 }} />}
      {ordered.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('categories.name')}</th>
                <th scope="col">{t('categories.courses')}</th>
                <th scope="col">
                  <span className="sr-only">{t('assign.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <tr key={row.slug}>
                  <td className={row.parentSlug ? 'subcategory' : undefined}>
                    {editing === row.slug ? (
                      <RenameRow category={row} onDone={() => setEditing(null)} />
                    ) : (
                      <>
                        {name(row)} <span className="hint mono">{row.slug}</span>
                      </>
                    )}
                  </td>
                  <td className="mono">{row.courses}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditing(row.slug)}
                    >
                      {t('categories.rename')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={row.courses > 0 || row.children > 0 || remove.isPending}
                      title={
                        row.courses > 0 || row.children > 0 ? t('categories.inUse') : undefined
                      }
                      onClick={() => {
                        if (window.confirm(t('categories.deleteConfirm', { name: name(row) }))) {
                          remove.mutate(row.slug);
                        }
                      }}
                    >
                      {t('categories.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4>{t('categories.new')}</h4>
      <AddCategory parents={parents} />
    </article>
  );
}
