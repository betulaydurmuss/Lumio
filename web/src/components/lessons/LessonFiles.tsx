import type { LessonView } from '@lumio/shared';
import { FileDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../api/catalog.js';

function size(bytes: number, locale: string) {
  const kb = bytes / 1024;
  return kb < 1024
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.max(1, kb))} KB`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kb / 1024)} MB`;
}

/** The files that go with a lesson. Each link is signed and expires like the video's. */
export function LessonFiles({ files }: { files: LessonView['attachments'] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (files.length === 0) return null;
  return (
    <section className="card lesson-files" aria-labelledby="lesson-files-title">
      <h3 id="lesson-files-title">{t('player.files')}</h3>
      <ul>
        {files.map((file) => (
          <li key={file.href}>
            <a href={file.href} download={file.fileName}>
              <FileDown size={16} aria-hidden="true" />
              <span>{file.title}</span>
            </a>
            <span className="hint">
              {file.fileName.split('.').at(-1)?.toUpperCase()} · {size(file.sizeBytes, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
