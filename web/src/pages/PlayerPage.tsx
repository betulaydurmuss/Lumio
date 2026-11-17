import type { CourseOutline, LessonView, OutlineQuiz } from '@lumio/shared';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleCheck,
  ClipboardCheck,
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
import { useLesson, useOutline, useQuiz, useSaveProgress } from '../api/learn.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { InteractiveLesson } from '../components/lessons/InteractiveLesson.js';
import { LessonFiles } from '../components/lessons/LessonFiles.js';
import { ReadingLesson } from '../components/lessons/ReadingLesson.js';
import { VideoLesson } from '../components/lessons/VideoLesson.js';
import { QuizPanel } from '../components/QuizPanel.js';
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
            {section.quiz && <QuizItem quiz={section.quiz} slug={slug} currentId={currentId} />}
          </ol>
        </div>
      ))}
      {outline.finalQuiz && (
        <div className="player-section">
          <h4>{t('quiz.finalExam')}</h4>
          <ol>
            <QuizItem quiz={outline.finalQuiz} slug={slug} currentId={currentId} />
          </ol>
        </div>
      )}
    </nav>
  );
}

function QuizItem({
  quiz,
  slug,
  currentId,
}: {
  quiz: OutlineQuiz;
  slug: string;
  currentId: string;
}) {
  const { t } = useTranslation();
  const Icon = quiz.passed ? CircleCheck : quiz.locked || !quiz.accessible ? Lock : ClipboardCheck;
  const content = (
    <>
      <Icon
        size={16}
        className={quiz.passed ? 'done' : undefined}
        aria-label={quiz.passed ? t('quiz.passedBadge') : undefined}
      />
      <span className="player-lesson-title">{quiz.title}</span>
      <span className="mono">{t('quiz.questions', { count: quiz.questionCount })}</span>
    </>
  );
  return (
    <li className="quiz-item">
      {quiz.accessible || quiz.locked ? (
        <Link
          to={`/learn/${slug}/quiz/${quiz.id}`}
          aria-current={quiz.id === currentId ? 'page' : undefined}
        >
          {content}
        </Link>
      ) : (
        <span className="locked">{content}</span>
      )}
    </li>
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
  const { slug = '', lessonId, quizId } = useParams();
  const outline = useOutline(slug);
  const lesson = useLesson(slug, lessonId);
  const quiz = useQuiz(slug, quizId);
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
  if (!lessonId && !quizId) {
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
  const lessonsFinished = allLessons.length > 0 && allLessons.every((item) => item.completed);

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

          {data.completedAt ? (
            <div className="alert alert-success all-done" role="status">
              <PartyPopper size={20} className="ic" aria-hidden="true" />
              <div>
                <strong>{t('quiz.courseDoneTitle')}</strong>{' '}
                {data.certificateNo ? t('certificates.ready') : t('quiz.courseDoneBody')}{' '}
                {data.certificateNo && (
                  <Link to="/certificates">{t('certificates.viewCertificate')}</Link>
                )}
              </div>
            </div>
          ) : (
            lessonsFinished &&
            justCompleted && (
              <div className="alert alert-success all-done" role="status">
                <PartyPopper size={20} className="ic" aria-hidden="true" />
                <div>
                  <strong>{t('player.allDoneTitle')}</strong> {t('player.allDoneBody')}
                </div>
              </div>
            )
          )}

          {/* A disabled query also reports "pending", so each skeleton checks its own route. */}
          {(lessonId ? lesson.isPending : quiz.isPending) && (
            <div className="skeleton" style={{ height: 360 }} />
          )}

          {quiz.isError && <ErrorAlert error={quiz.error} />}
          {quiz.data && <QuizPanel key={quiz.data.id} slug={slug} quiz={quiz.data} />}

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
              <LessonFiles files={view.attachments} />

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
          <Sidebar outline={data} slug={slug} currentId={lessonId ?? quizId ?? ''} />
        </aside>
      </div>
    </div>
  );
}
