/**
 * `EnrollmentCard` — sticky purchase / continue-learning panel.
 *
 * Lives in the right column on desktop (sticks beneath the navbar as
 * the user scrolls the body) and collapses to a fixed bar pinned to
 * the bottom of the viewport on mobile so the primary CTA is always
 * one tap away.
 *
 * The CTA is context-aware:
 *   1. Anonymous visitor → "Sign up to enroll" (deep-links back to
 *      this page after registration).
 *   2. Authenticated, not enrolled → "Enroll – $X" or "Enroll for
 *      free", which fires `onEnroll` and lets the parent surface the
 *      success toast + refresh enrollment state.
 *   3. Enrolled  → "Continue learning" with a slim progress bar.
 *   4. Course owner → "Edit course" jumps into the authoring shell.
 *
 * The thumbnail is a real `<button>` when `previewLesson` is supplied
 * so keyboard users can launch the preview player without reaching
 * for a separate "Preview" link.
 */

import { Link } from 'react-router-dom';

import { Button, Icon, ProgressBar } from '../ui/index.js';
import { ROUTES } from '../../utils/constants.js';

const INCLUSIONS = (course) => {
  const lessons = course?.totalLessons ?? 0;
  const items = [
    { icon: 'FileText', label: `${lessons} standard operating & safety modules` },
    { icon: 'ShieldAlert', label: 'Hazard awareness & precaution procedures' },
    { icon: 'ClipboardCheck', label: 'Knowledge & compliance assessments' },
    { icon: 'BadgeCheck', label: 'Plant qualification record upon passing' },
    { icon: 'Factory', label: 'Shop floor & workstation progress tracking' },
  ];
  return items;
};

export function EnrollmentCard({
  course,
  enrollment,
  progress,
  isAuthenticated,
  isOwner,
  enrolling = false,
  onEnroll,
  previewLesson,
  onPreview,
  className,
}) {
  if (!course) return null;

  const isEnrolled = Boolean(enrollment);
  const progressPercent = Math.round(progress?.progressPercent ?? 0);

  const continueHref = (() => {
    const slug = course.slug;
    const lastLessonId =
      progress?.lastAccessedLesson ?? enrollment?.lastAccessedLesson;
    if (!slug) return ROUTES.dashboard;
    return lastLessonId ? ROUTES.lesson(slug, lastLessonId) : ROUTES.courseLearn(slug);
  })();

  const renderCta = () => {
    if (isOwner) {
      return (
        <Link to={ROUTES.instructorCourseEdit(course._id ?? course.id)} className="block">
          <Button variant="outline" size="lg" className="w-full" leftIcon={<Icon name="Settings" size={16} />}>
            Edit training module
          </Button>
        </Link>
      );
    }

    if (isEnrolled) {
      return (
        <div className="space-y-3">
          <Link to={continueHref} className="block">
            <Button size="lg" className="w-full" rightIcon={<Icon name="ArrowRight" size={16} />}>
              Continue training
            </Button>
          </Link>
          <ProgressBar
            value={progressPercent}
            showLabel
            label="Training progress"
            size="sm"
          />
        </div>
      );
    }

    if (!isAuthenticated) {
      const nextHref = `${ROUTES.login}?next=${encodeURIComponent(
        ROUTES.courseDetail(course.slug),
      )}`;
      return (
        <Link to={nextHref} className="block">
          <Button size="lg" className="w-full">
            Log in to access training
          </Button>
        </Link>
      );
    }

    return (
      <Button
        size="lg"
        className="w-full"
        loading={enrolling}
        onClick={onEnroll}
      >
        Start training program
      </Button>
    );
  };

  const thumbnailUrl =
    typeof course.thumbnail === 'string' ? course.thumbnail : course.thumbnail?.url;

  const canPreview = Boolean(previewLesson) && typeof onPreview === 'function';

  const ThumbnailWrapper = canPreview ? 'button' : 'div';

  return (
    <div
      className={[
        'rounded-xl border border-border bg-bg shadow-md overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ThumbnailWrapper
        type={canPreview ? 'button' : undefined}
        onClick={canPreview ? () => onPreview(previewLesson) : undefined}
        aria-label={canPreview ? `Play preview: ${previewLesson.title}` : undefined}
        className={[
          'group relative block w-full aspect-video bg-bg-muted',
          canPreview &&
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-linear-to-br
              from-primary/20 via-slate-700/10 to-bg-muted text-primary/70"
          >
            <Icon name="Factory" size={42} />
          </div>
        )}
        {canPreview && (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/50"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-text shadow-md transition-transform group-hover:scale-[1.04]">
                <Icon name="PlayCircle" size={18} className="text-primary" />
                Preview this course
              </span>
            </span>
          </>
        )}
      </ThumbnailWrapper>

      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xl font-bold tracking-tight text-text">
              Workforce Training
            </span>
            <p className="text-xs text-text-muted mt-0.5">Plant Competency Module</p>
          </div>
          {isEnrolled && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-success bg-success/10 border border-success/20">
              <Icon name="CheckCircle2" size={14} />
              Enrolled
            </span>
          )}
        </div>

        {renderCta()}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Training Module Inclusions
          </h3>
          <ul className="space-y-2 text-sm text-text">
            {INCLUSIONS(course).map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                <Icon
                  name={item.icon}
                  size={16}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default EnrollmentCard;
