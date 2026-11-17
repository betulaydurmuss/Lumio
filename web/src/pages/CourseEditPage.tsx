import { courseLevels, type CourseEditInput } from '@lumio/shared';
import { CircleCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { usePlatformCategories, usePlatformCourse, useSaveCourse } from '../api/platform.js';
import { ErrorAlert } from '../components/ErrorAlert.js';

const TEXT_FIELDS = [
  ['titleTr', 'titleEn', 'fieldTitle'],
  ['subtitleTr', 'subtitleEn', 'subtitle'],
] as const;

/** The platform operator's form for what the catalog says about one course. */
export function CourseEditPage() {
  const { t, i18n } = useTranslation();
  const { slug = '' } = useParams();
  const course = usePlatformCourse(slug);
  const categories = usePlatformCategories();
  const save = useSaveCourse(slug);
  const [form, setForm] = useState<CourseEditInput | null>(null);

  useEffect(() => {
    if (course.data && !form) {
      const { slug: _slug, status: _status, editedAt: _editedAt, ...fields } = course.data;
      setForm(fields);
    }
  }, [course.data, form]);

  function set<K extends keyof CourseEditInput>(key: K, value: CourseEditInput[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    save.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (form) save.mutate(form);
  }

  const name = (row: { nameTr: string; nameEn: string }) =>
    i18n.resolvedLanguage === 'en' ? row.nameEn : row.nameTr;

  return (
    <div className="wrap page">
      <header className="page-head">
        <p className="hint">
          <Link to="/platform">← {t('platform.title')}</Link>
        </p>
        <h2>{t('courseEdit.title')}</h2>
        <p className="lead">{t('courseEdit.lead')}</p>
      </header>
      {course.isError && <ErrorAlert error={course.error} />}
      {course.isPending && <div className="skeleton" style={{ height: 240 }} />}
      {form && (
        <form className="card course-edit" onSubmit={submit}>
          {TEXT_FIELDS.map(([tr, en, label]) => (
            <div key={label} className="field-pair">
              <div className="field">
                <label htmlFor={tr}>{t(`courseEdit.${label}`)} (TR)</label>
                <input
                  id={tr}
                  className="input"
                  required
                  value={form[tr]}
                  onChange={(event) => set(tr, event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={en}>{t(`courseEdit.${label}`)} (EN)</label>
                <input
                  id={en}
                  className="input"
                  required
                  value={form[en]}
                  onChange={(event) => set(en, event.target.value)}
                />
              </div>
            </div>
          ))}
          <div className="field-pair">
            {(['descriptionTr', 'descriptionEn'] as const).map((key) => (
              <div key={key} className="field">
                <label htmlFor={key}>
                  {t('courseEdit.description')} ({key.endsWith('Tr') ? 'TR' : 'EN'})
                </label>
                <textarea
                  id={key}
                  className="input"
                  rows={6}
                  required
                  value={form[key]}
                  onChange={(event) => set(key, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="field-pair">
            <div className="field">
              <label htmlFor="category">{t('courseEdit.category')}</label>
              <select
                id="category"
                className="input"
                value={form.categorySlug}
                onChange={(event) => set('categorySlug', event.target.value)}
              >
                {categories.data?.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.parentSlug ? '— ' : ''}
                    {name(category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="level">{t('courseEdit.level')}</label>
              <select
                id="level"
                className="input"
                value={form.level}
                onChange={(event) => set('level', event.target.value as CourseEditInput['level'])}
              >
                {courseLevels.map((level) => (
                  <option key={level} value={level}>
                    {t(`levels.${level}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.hasCertificate}
              onChange={(event) => set('hasCertificate', event.target.checked)}
            />
            <span>{t('courseEdit.certificate')}</span>
          </label>
          <p className="hint">{t('courseEdit.note')}</p>
          {save.error && <ErrorAlert error={save.error} />}
          {save.isSuccess && (
            <div className="alert alert-success" role="status">
              <CircleCheck size={18} className="ic" aria-hidden="true" />
              <div>{t('courseEdit.saved')}</div>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-accent" type="submit" disabled={save.isPending}>
              {save.isPending ? t('common.loading') : t('courseEdit.save')}
            </button>
            <Link to={`/courses/${slug}`} className="btn btn-secondary">
              {t('courseEdit.view')}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
