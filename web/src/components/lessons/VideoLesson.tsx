import { VIDEO_COMPLETION_RATIO, type LessonView } from '@lumio/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../api/catalog.js';
import { useSaveProgress } from '../../api/learn.js';
import { ErrorAlert } from '../ErrorAlert.js';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SPEED_KEY = 'lumio.playbackRate';
const SAVE_EVERY_SECONDS = 10;

function storedSpeed(): number {
  try {
    const value = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(value) ? value : 1;
  } catch {
    return 1;
  }
}

interface Props {
  slug: string;
  lesson: LessonView & { video: NonNullable<LessonView['video']> };
  canSave: boolean;
  onCompleted: () => void;
}

export function VideoLesson({ slug, lesson, canSave, onCompleted }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const video = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(lesson.progress?.positionSeconds ?? 0);
  const [completed, setCompleted] = useState(lesson.progress?.completed ?? false);
  const [speed, setSpeed] = useState(storedSpeed);
  const save = useSaveProgress(slug, lesson.id);
  const threshold = lesson.video.seconds * VIDEO_COMPLETION_RATIO;

  useEffect(() => {
    if (video.current) video.current.playbackRate = speed;
    try {
      localStorage.setItem(SPEED_KEY, String(speed));
    } catch {
      // Remembering the speed is a convenience; nothing breaks without it.
    }
  }, [speed]);

  function savePosition(seconds: number) {
    if (!canSave) return;
    lastSaved.current = seconds;
    save.mutate({ positionSeconds: Math.floor(seconds) });
  }

  function onLoadedMetadata() {
    const element = video.current;
    if (!element) return;
    element.playbackRate = speed;
    const resumeAt = lesson.progress?.positionSeconds ?? 0;
    // Resume where the learner stopped, unless they had reached the very end.
    if (!completed && resumeAt > 0 && resumeAt < element.duration - 2) {
      element.currentTime = resumeAt;
    }
  }

  function onTimeUpdate() {
    const element = video.current;
    if (!element || !canSave) return;
    const now = element.currentTime;
    if (!completed && now >= threshold) {
      setCompleted(true);
      lastSaved.current = now;
      save.mutate(
        { positionSeconds: Math.floor(now), completed: true },
        { onSuccess: (result) => result.completed && onCompleted() },
      );
      return;
    }
    if (Math.abs(now - lastSaved.current) >= SAVE_EVERY_SECONDS) savePosition(now);
  }

  return (
    <div className="video-lesson">
      <div className="video-frame">
        <video
          ref={video}
          src={lesson.video.src}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onPause={() => video.current && savePosition(video.current.currentTime)}
        >
          {lesson.video.captions.map((caption) => (
            <track
              key={caption.lang}
              kind="subtitles"
              src={caption.src}
              srcLang={caption.lang}
              label={t(`languages.${caption.lang}`)}
              default={caption.lang === locale}
            />
          ))}
        </video>
      </div>
      <div className="video-tools">
        <label className="speed">
          <span>{t('player.speed')}</span>
          <select
            className="input"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        {canSave && !completed && <p className="hint">{t('player.videoHint')}</p>}
      </div>
      {save.error && <ErrorAlert error={save.error} />}
    </div>
  );
}
