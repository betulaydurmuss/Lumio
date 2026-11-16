import type { QuizResult, QuizView } from '@lumio/shared';
import { CircleCheck, CircleX, ClipboardCheck, Lock, RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../api/catalog.js';
import { useSubmitQuiz } from '../api/learn.js';
import { ErrorAlert } from './ErrorAlert.js';

function QuizResultView({
  quiz,
  result,
  answers,
  onRetry,
}: {
  quiz: QuizView;
  result: QuizResult;
  answers: number[];
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const hidden = result.results.some((item) => item.correctIndex === null);

  return (
    <div className="quiz-result">
      <div className={`quiz-score ${result.passed ? 'passed' : 'failed'}`} role="status">
        {result.passed ? (
          <CircleCheck size={28} aria-hidden="true" />
        ) : (
          <CircleX size={28} aria-hidden="true" />
        )}
        <div>
          <strong>{result.passed ? t('quiz.passedTitle') : t('quiz.failedTitle')}</strong>
          <span className="mono">{t('quiz.score', { score: result.score })}</span>
          {!result.passed && <p>{t('quiz.failedBody', { percent: result.passPercent })}</p>}
        </div>
      </div>

      {hidden && <p className="hint">{t('quiz.finalHidden')}</p>}

      <ol className="quiz-review">
        {quiz.questions.map((question, index) => {
          const item = result.results[index];
          if (!item) return null;
          return (
            <li key={question.id} data-state={item.correct ? 'correct' : 'wrong'}>
              <p className="quiz-prompt">
                {item.correct ? (
                  <CircleCheck size={18} aria-label={t('player.correct')} />
                ) : (
                  <CircleX size={18} aria-label={t('player.incorrect')} />
                )}
                {question.prompt}
              </p>
              <p className="hint">
                {t('quiz.yourAnswer')}: <strong>{question.options[answers[index] ?? -1]}</strong>
              </p>
              {!item.correct && item.correctIndex !== null && (
                <p className="hint">
                  {t('quiz.correctAnswer')}: <strong>{question.options[item.correctIndex]}</strong>
                </p>
              )}
              {item.explanation && <p className="quiz-explanation">{item.explanation}</p>}
            </li>
          );
        })}
      </ol>

      {!result.passed && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" />
          {t('quiz.retry')}
        </button>
      )}
    </div>
  );
}

/** One quiz: intro, the questions, then the graded result with explanations. */
export function QuizPanel({ slug, quiz }: { slug: string; quiz: QuizView }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const submit = useSubmitQuiz(slug, quiz.id);
  const [answers, setAnswers] = useState<(number | undefined)[]>(() =>
    quiz.questions.map(() => undefined),
  );
  const answered = answers.filter((answer) => answer !== undefined).length;
  const best = quiz.attempts.reduce<number | null>(
    (max, attempt) => (max === null ? attempt.score : Math.max(max, attempt.score)),
    null,
  );
  const passed = quiz.attempts.some((attempt) => attempt.passed);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (answered !== quiz.questions.length) return;
    submit.mutate(answers as number[]);
  }

  function retry() {
    submit.reset();
    setAnswers(quiz.questions.map(() => undefined));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const header = (
    <div className="lesson-head">
      <p className="hint">{quiz.kind === 'final' ? t('quiz.finalExam') : t('quiz.sectionQuiz')}</p>
      <h2>{quiz.title}</h2>
      <p className="lesson-meta">
        <span>
          <ClipboardCheck size={14} aria-hidden="true" />{' '}
          {t('quiz.questions', { count: quiz.questions.length })}
        </span>
        <span>{t('quiz.passMark', { percent: quiz.passPercent })}</span>
        {best !== null && <span className="mono">{t('quiz.best', { score: best })}</span>}
        {passed && <span className="badge badge-free">{t('quiz.passedBadge')}</span>}
      </p>
    </div>
  );

  if (quiz.locked) {
    return (
      <>
        {header}
        <div className="card locked-card">
          <Lock size={22} aria-hidden="true" />
          <h3>{t('quiz.lockedTitle')}</h3>
          <p className="hint">{t('quiz.lockedBody')}</p>
        </div>
      </>
    );
  }

  if (submit.data) {
    return (
      <>
        {header}
        <QuizResultView
          quiz={quiz}
          result={submit.data}
          answers={answers as number[]}
          onRetry={retry}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <form className="quiz-form" onSubmit={onSubmit}>
        {quiz.questions.map((question, index) => (
          <fieldset key={question.id} className="quiz-question">
            <legend>
              <span className="check-label">
                {t('quiz.question', { current: index + 1, total: quiz.questions.length })}
              </span>
              {question.prompt}
            </legend>
            {question.options.map((option, optionIndex) => (
              <label key={option} className="check-option">
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[index] === optionIndex}
                  onChange={() =>
                    setAnswers((current) =>
                      current.map((value, at) => (at === index ? optionIndex : value)),
                    )
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        ))}

        {submit.error && <ErrorAlert error={submit.error} />}

        <div className="quiz-submit">
          <span className="hint" aria-live="polite">
            {t('quiz.answered', { answered, total: quiz.questions.length })}
          </span>
          <button
            type="submit"
            className="btn btn-accent btn-lg"
            disabled={answered !== quiz.questions.length || submit.isPending}
          >
            {submit.isPending ? t('common.loading') : t('quiz.submit')}
          </button>
        </div>
      </form>

      {quiz.attempts.length > 0 && (
        <section className="attempts">
          <h4>{t('quiz.previousAttempts')}</h4>
          <ul>
            {quiz.attempts.map((attempt) => (
              <li key={attempt.createdAt}>
                <span className="mono">
                  {locale === 'tr' ? `%${attempt.score}` : `${attempt.score}%`}
                </span>
                <span className={`badge ${attempt.passed ? 'badge-free' : 'badge-soft'}`}>
                  {attempt.passed ? t('quiz.passedBadge') : t('quiz.failedTitle')}
                </span>
                <span className="hint">
                  {new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(attempt.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
