import type { InteractiveStep } from '@lumio/shared';
import { CircleCheck, CircleX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  steps: InteractiveStep[];
  /** Called once the learner reaches the end of the last step. */
  onFinish: () => void;
  finished: boolean;
}

/**
 * A short animated walk-through. Each step can ask one question; the answer is
 * explained straight away, and the learner moves on whether they got it or not.
 */
export function InteractiveLesson({ steps, onFinish, finished }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const step = steps[index];
  if (!step) return null;

  const chosen = answers[index];
  const answered = chosen !== undefined;
  const canContinue = !step.check || answered;
  const last = index === steps.length - 1;

  return (
    <div className="interactive">
      <div className="step-dots" aria-hidden="true">
        {steps.map((_, dot) => (
          <span key={dot} data-state={dot < index ? 'done' : dot === index ? 'current' : 'todo'} />
        ))}
      </div>
      <p className="hint" aria-live="polite">
        {t('player.step', { current: index + 1, total: steps.length })}
      </p>

      {/* The key restarts the entrance animation on every step. */}
      <section key={index} className="step-card">
        <h3>{step.title}</h3>
        <p>{step.body}</p>

        {step.check && (
          <fieldset className="check">
            <legend>
              <span className="check-label">{t('player.checkTitle')}</span>
              {step.check.question}
            </legend>
            {step.check.options.map((option, optionIndex) => {
              const isAnswer = optionIndex === step.check!.answer;
              const state = !answered
                ? undefined
                : isAnswer
                  ? 'correct'
                  : optionIndex === chosen
                    ? 'wrong'
                    : undefined;
              return (
                <label key={option} className="check-option" data-state={state}>
                  <input
                    type="radio"
                    name={`step-${index}`}
                    checked={chosen === optionIndex}
                    disabled={answered}
                    onChange={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
            {answered && (
              <div
                className={`alert ${chosen === step.check.answer ? 'alert-success' : 'alert-warn'}`}
                role="status"
              >
                {chosen === step.check.answer ? (
                  <CircleCheck size={18} className="ic" aria-hidden="true" />
                ) : (
                  <CircleX size={18} className="ic" aria-hidden="true" />
                )}
                <div>
                  <strong>
                    {chosen === step.check.answer ? t('player.correct') : t('player.incorrect')}
                  </strong>{' '}
                  {step.check.explanation}
                </div>
              </div>
            )}
          </fieldset>
        )}
      </section>

      <div className="step-actions">
        {index > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIndex((current) => current - 1)}
          >
            {t('common.back')}
          </button>
        )}
        {!last && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canContinue}
            onClick={() => setIndex((current) => current + 1)}
          >
            {t('player.continue')}
          </button>
        )}
        {last && !finished && (
          <button
            type="button"
            className="btn btn-accent"
            disabled={!canContinue}
            onClick={onFinish}
          >
            {t('player.finish')}
          </button>
        )}
      </div>
    </div>
  );
}
