import type { CourseOutline, LessonView } from '@lumio/shared';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleCheck,
  Clock,
  Lock,
  MousePointerClick,
  PartyPopper,
  PlayCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useLocale } from '../api/catalog.js';
import { ApiError } from '../api/client.js';
import { useLesson, useOutline, useSaveProgress } from '../api/learn.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { InteractiveLesson } from '../components/lessons/InteractiveLesson.js';
import { ReadingLesson } from '../components/lessons/ReadingLesson.js';
import { VideoLesson } from '../components/lessons/VideoLesson.js';
import { PageSkeleton } from '../components/RequireAuth.js';
import { formatDuration } from '../lib/format.js';

const typeIcon = { video: PlayCircle, interactive: MousePointerClick, reading: BookOpen };

function Sidebar({
  outline,
  slug,
  currentId,
}: {
  outline: CourseOutline;
  slug: string;
  currentId: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <nav className="player-curriculum" aria-label={t('player.curriculum')}>
      {outline.sections.map((section) => (
        <div key={section.title} className="player-section">
          <h4>{section.title}</h4>
          <ol>
            {section.lessons.map((lesson) => {
              const Icon = lesson.completed
                ? CircleCheck
                : lesson.accessible
                  ? typeIcon[lesson.type]
                  : Lock;
              const content = (
                <>
                  <Icon
                    size={16}
                    className={lesson.completed ? 'done' : undefined}
                    aria-label={lesson.completed ? t('player.completed') : undefined}
                  />
                  <span className="player-lesson-title">{lesson.title}</span>
                  <span className="mono">{formatDuration(lesson.durationMinutes, locale)}</span>
                </>
              );
              return (
                <li key={lesson.id}>
                  {lesson.accessible ? (
                    <Link
                      to={`/learn/${slug}/${lesson.id}`}
                      aria-current={lesson.id === currentId ? 'page' : undefined}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span className="locked">{content}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );
}

function LessonBody({
  slug,
  lesson,
  canSave,
  onCompleted,
}: {
  slug: string;
  lesson: LessonView;
  canSave: boolean;
  onCompleted: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveProgress(slug, lesson.id);
  const [done, setDone] = useState(lesson.progress?.completed ?? false);

  function complete() {
    if (!canSave) return;
    save.mutate(
      { completed: true },
      {
        onSuccess: (result) => {
          setDone(result.completed);
          onCompleted();
        },
      },
    );
  }

  if (lesson.type === 'video' && lesson.video) {
    return (
      <VideoLesson
        slug={slug}
        lesson={{ ...lesson, video: lesson.video }}
        canSave={canSave}
        onCompleted={onCompleted}
      />
    );
  }

  if (!lesson.body) {
    return (
      <div className="card preparing">
        <h3>{t('player.preparingTitle')}</h3>
        <p className="hint">{t('player.preparingBody')}</p>
      </div>
    );
  }

  return (
    <>
      {save.error && <ErrorAlert error={save.error} />}
      {lesson.body.kind === 'reading' ? (
        <>
          <ReadingLesson blocks={lesson.body.blocks} />
          {canSave && !done && (
            <button
              type="button"
              className="btn btn-accent"
              disabled={save.isPending}
              onClick={complete}
            >
              {t('player.markComplete')}
            </button>
          )}
        </>
      ) : (
        <InteractiveLesson steps={lesson.body.steps} finished={done} onFinish={complete} />
      )}
    </>
  );
}

export function PlayerPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { slug = '', lessonId } = useParams();
  const outline = useOutline(slug);
  const lesson = useLesson(slug, lessonId);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  if (outline.isPending) return <PageSkeleton />;
  if (outline.isError) {
    return (
      <div className="wrap page">
        <ErrorAlert error={outline.error} />
      </div>
    );
  }

  const data = outline.data;
  const allLessons = data.sections.flatMap((section) => section.lessons);
  if (!lessonId) {
    const target = data.resumeLessonId ?? allLessons.find((item) => item.accessible)?.id;
    return target ? (
      <Navigate to={`/learn/${slug}/${target}`} replace />
    ) : (
      <Navigate to={`/courses/${slug}`} replace />
    );
  }

  const locked =
    lesson.error instanceof ApiError && lesson.error.code === 'not_enrolled' ? true : false;
  const view = lesson.data;
  const finishedCourse = data.progress?.percent === 100;

  return (
    <div className="player">
      <header className="player-bar">
        <div className="player-bar-inner">
          <Link to={`/courses/${slug}`} className="player-back">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{t('player.backToCourse')}</span>
          </Link>
          <strong className="player-course">{data.course.title}</strong>
          {data.progress && (
            <div className="player-progress">
              <div
                className="progress"
                role="progressbar"
                aria-label={t('player.progressLabel')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={data.progress.percent}
              >
                <i style={{ width: `${data.progress.percent}%` }} />
              </div>
              <span className="mono">
                {t('player.progress', { percent: data.progress.percent })}
              </span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm curriculum-toggle"
            aria-expanded={curriculumOpen}
            onClick={() => setCurriculumOpen((open) => !open)}
          >
            {curriculumOpen ? t('player.hideCurriculum') : t('player.showCurriculum')}
          </button>
        </div>
      </header>

      <div className="player-layout">
        <div className="player-main">
          {!data.enrolled && !locked && (
            <div className="alert alert-info" role="status">
              <div>
                {t('player.previewBanner')}{' '}
                <Link to={`/courses/${slug}`}>{t('player.enrollCta')}</Link>
              </div>
            </div>
          )}

          {finishedCourse && justCompleted && (
            <div className="alert alert-success all-done" role="status">
              <PartyPopper size={20} className="ic" aria-hidden="true" />
              <div>
                <strong>{t('player.allDoneTitle')}</strong> {t('player.allDoneBody')}
              </div>
            </div>
          )}

          {lesson.isPending && <div className="skeleton" style={{ height: 360 }} />}

          {locked && (
            <div className="card locked-card">
              <Lock size={22} aria-hidden="true" />
              <h3>{t('player.lockedTitle')}</h3>
              <p className="hint">{t('player.lockedBody')}</p>
              <Link to={`/courses/${slug}`} className="btn btn-accent">
                {t('player.enrollCta')}
              </Link>
            </div>
          )}

          {lesson.isError && !locked && (
            <ErrorAlert error={lesson.error}>
              {lesson.error instanceof ApiError && lesson.error.status === 404 && (
                <p style={{ margin: '6px 0 0' }}>{t('player.lessonNotFound')}</p>
              )}
            </ErrorAlert>
          )}

          {view && (
            <>
              <div className="lesson-head">
                <p className="hint">{view.sectionTitle}</p>
                <h2>{view.title}</h2>
                <p className="lesson-meta">
                  <span>{t(`course.lessonTypes.${view.type}`)}</span>
                  <span>
                    <Clock size={14} aria-hidden="true" />{' '}
                    {formatDuration(view.durationMinutes, locale)}
                  </span>
                  {allLessons.find((item) => item.id === view.id)?.completed && (
                    <span className="badge badge-free">
                      <CircleCheck size={13} aria-hidden="true" /> {t('player.completed')}
                    </span>
                  )}
                </p>
              </div>

              <LessonBody
                key={view.id}
                slug={slug}
                lesson={view}
                canSave={data.enrolled}
                onCompleted={() => setJustCompleted(true)}
              />

              <nav
                className="lesson-nav"
                aria-label={`${t('player.previous')} / ${t('player.next')}`}
              >
                {view.previousLessonId ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void navigate(`/learn/${slug}/${view.previousLessonId}`)}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('player.previous')}
                  </button>
                ) : (
                  <span />
                )}
                {view.nextLessonId && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setJustCompleted(false);
                      void navigate(`/learn/${slug}/${view.nextLessonId}`);
                    }}
                  >
                    {t('player.next')}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
              </nav>
            </>
          )}
        </div>

        <aside className={`player-aside ${curriculumOpen ? 'open' : ''}`}>
          <h3>{t('player.curriculum')}</h3>
          <Sidebar outline={data} slug={slug} currentId={lessonId} />
        </aside>
      </div>
    </div>
  );
}
