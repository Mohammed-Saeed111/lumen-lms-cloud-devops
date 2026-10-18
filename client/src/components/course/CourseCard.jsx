/**
 * `CourseCard` — canonical catalog card.
 *
 * One card layout shared by the marketing landing page, the public
 * catalog grid and the public instructor profile. Previously the
 * landing page shipped its own `LandingCourseCard`; now every surface
 * pulls from this primitive so a future visual change happens in
 * exactly one place.
 *
 * Layout (mobile-first):
 *   ┌──────────────────────────────┐
 *   │ 16:9 thumbnail · level badge │
 *   ├──────────────────────────────┤
 *   │ Title (clamp 2)              │
 *   │ Avatar · instructor name     │
 *   │ Lessons · duration · learners│
 *   │ ───────                      │
 *   │ Price       View →           │
 *   └──────────────────────────────┘
 *
 * Hover/focus motion (lift + shadow upgrade + thumbnail zoom) follows
 * the global motion vocabulary and self-disables under
 * `prefers-reduced-motion` because all transitions live inside Tailwind
 * utilities that the global CSS rule already overrides.
 */

import { memo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar, Badge, Icon } from '../ui/index.js';
import { ROUTES } from '../../utils/constants.js';
import { formatDuration } from '../../utils/formatDuration.js';
import { cn } from '../../utils/cn.js';
import {
  cloudinaryLqip,
  cloudinaryPresets,
  cloudinarySrcSet,
} from '../../utils/cloudinaryUrl.js';

const CARD_THUMB_WIDTHS = [320, 480, 640, 960];
const CARD_THUMB_SIZES =
  '(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw';

const LEVEL_VARIANT = {
  beginner: 'success',
  intermediate: 'info',
  advanced: 'warning',
};

const LEVEL_LABEL = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/**
 * Category-specific fallback art for cards without a thumbnail.
 *
 * The catalog ships with seed courses that don't always have a real
 * Cloudinary image attached. Showing the same generic graduation-cap
 * icon on every card flattens the catalog visually — categories become
 * indistinguishable at a glance. Instead we hash the category to one of
 * a handful of branded gradient + icon combinations so cards stay
 * visually varied even before instructors upload imagery.
 *
 * `default` covers any unknown category string from older seed data.
 */
const CATEGORY_FALLBACK = {
  'safety-ehs': {
    icon: 'ShieldAlert',
    gradient: 'from-danger/20 via-warning/10 to-bg-muted',
    iconColor: 'text-danger',
  },
  'Safety & EHS': {
    icon: 'ShieldAlert',
    gradient: 'from-danger/20 via-warning/10 to-bg-muted',
    iconColor: 'text-danger',
  },
  'machining-cnc': {
    icon: 'Cog',
    gradient: 'from-primary/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-primary',
  },
  'Machining & CNC': {
    icon: 'Cog',
    gradient: 'from-primary/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-primary',
  },
  'assembly-operations': {
    icon: 'Layers',
    gradient: 'from-primary/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-primary',
  },
  'Assembly & Production': {
    icon: 'Layers',
    gradient: 'from-primary/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-primary',
  },
  'maintenance-repairs': {
    icon: 'Wrench',
    gradient: 'from-warning/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-warning',
  },
  'Maintenance & Repairs': {
    icon: 'Wrench',
    gradient: 'from-warning/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-warning',
  },
  'quality-control': {
    icon: 'CheckCircle2',
    gradient: 'from-success/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-success',
  },
  'Quality Control': {
    icon: 'CheckCircle2',
    gradient: 'from-success/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-success',
  },
  'operating-procedures': {
    icon: 'FileText',
    gradient: 'from-info/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-info',
  },
  'Standard Operating Procedures': {
    icon: 'FileText',
    gradient: 'from-info/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-info',
  },
  'logistics-warehousing': {
    icon: 'Truck',
    gradient: 'from-slate-700/20 via-primary/10 to-bg-muted',
    iconColor: 'text-text-muted',
  },
  'general-factory': {
    icon: 'Factory',
    gradient: 'from-primary/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-primary',
  },
  programming: {
    icon: 'Cpu',
    gradient: 'from-info/20 via-primary/10 to-bg-muted',
    iconColor: 'text-info',
  },
  default: {
    icon: 'Factory',
    gradient: 'from-primary/20 via-slate-700/10 to-bg-muted',
    iconColor: 'text-primary',
  },
};

const formatEnrolled = (count) => {
  const safe = Number(count) || 0;
  if (safe < 1000) return safe.toLocaleString();
  if (safe < 1_000_000) return `${(safe / 1000).toFixed(safe < 10_000 ? 1 : 0)}k`;
  return `${(safe / 1_000_000).toFixed(1)}M`;
};

function CourseCardComponent({ course, className }) {
  // Track when the high-res thumbnail finishes loading so the
  // tiny LQIP placeholder can fade out and reveal the sharp image.
  // Defaulting to `false` (not loaded) means cards rendered server-side
  // / on first paint show the blurred placeholder until the browser
  // resolves the lazy `<img>`. The `useState` runs unconditionally to
  // satisfy React's rules-of-hooks even though we early-return below.
  const [thumbLoaded, setThumbLoaded] = useState(false);

  if (!course) return null;

  const instructorName = course.instructor?.name ?? 'Opervanta Instructor';
  const instructorAvatar = course.instructor?.avatar;
  const lessons = course.totalLessons ?? 0;
  const duration = formatDuration(course.totalDuration);
  const enrolled = formatEnrolled(course.enrollmentCount);

  const rawThumb = course.thumbnail?.url ?? course.thumbnail;
  const thumbSrc =
    typeof rawThumb === 'string' ? cloudinaryPresets.cardThumb(rawThumb) : null;
  const thumbSrcSet = typeof rawThumb === 'string' ? cloudinarySrcSet(rawThumb, CARD_THUMB_WIDTHS) : '';
  const thumbLqip = typeof rawThumb === 'string' ? cloudinaryLqip(rawThumb) : '';

  return (
    <Link
      to={ROUTES.courseDetail(course.slug)}
      aria-label={`${course.title} by ${instructorName}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-xs',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <div
        className="relative aspect-video overflow-hidden bg-bg-muted bg-cover bg-center"
        // Inline LQIP background. Cloudinary returns a ~500 B
        // blurred preview; the browser paints it instantly so the card
        // never shows an empty grey rectangle while the high-res asset
        // streams in. Once the real `<img>` fires `onLoad` we no longer
        // need the background, but leaving it in place is cheap (a
        // single decoded raster) and avoids a flash if the browser
        // evicts the cached image later.
        style={thumbLqip ? { backgroundImage: `url("${thumbLqip}")` } : undefined}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            srcSet={thumbSrcSet || undefined}
            sizes={thumbSrcSet ? CARD_THUMB_SIZES : undefined}
            alt=""
            loading="lazy"
            decoding="async"
            width="640"
            height="360"
            onLoad={() => setThumbLoaded(true)}
            className={cn(
              'h-full w-full object-cover ease-out',
              // Single `transition` covers both the hover scale (slow,
              // intentional) and the LQIP fade-in (fast, just enough to
              // smooth the swap). Stacking two `transition-*` utilities
              // would let the second one win and skip the scale entirely.
              'transition-all duration-300',
              'group-hover:scale-[1.02]',
              'opacity-0',
              thumbLoaded && 'opacity-100',
            )}
          />
        ) : (
          (() => {
            const fallback =
              CATEGORY_FALLBACK[course.category] ?? CATEGORY_FALLBACK.default;
            return (
              <div
                aria-hidden="true"
                className={cn(
                  'absolute inset-0 flex items-center justify-center bg-linear-to-br',
                  fallback.gradient,
                  fallback.iconColor,
                )}
              >
                <Icon name={fallback.icon} size={36} />
              </div>
            );
          })()
        )}

        {course.level && (
          <Badge
            variant={LEVEL_VARIANT[course.level] ?? 'neutral'}
            className="absolute left-3 top-3 backdrop-blur-sm"
          >
            {LEVEL_LABEL[course.level] ?? course.level}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-semibold leading-snug text-text line-clamp-2">
          {course.title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Avatar
            size="xs"
            src={instructorAvatar}
            name={instructorName}
            alt={instructorName}
          />
          <span className="truncate">{instructorName}</span>
        </div>

        <ul className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
          <li className="inline-flex items-center gap-1">
            <Icon name="PlayCircle" size={14} />
            <span>{lessons} lessons</span>
          </li>
          <li aria-hidden="true" className="text-text-subtle">
            ·
          </li>
          <li className="inline-flex items-center gap-1">
            <Icon name="Clock" size={14} />
            <span>{duration}</span>
          </li>
          <li aria-hidden="true" className="text-text-subtle">
            ·
          </li>
          <li className="inline-flex items-center gap-1">
            <Icon name="Users" size={14} />
            <span>{enrolled}</span>
          </li>
        </ul>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Icon name="ShieldCheck" size={14} className="text-primary" />
            <span>Workforce Module</span>
          </span>
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary
              transition-all duration-200 group-hover:translate-x-0.5"
          >
            View program
            <Icon name="ArrowRight" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Memoise the card so the catalog grid doesn't re-render every tile
 * when a sibling-level state (filters sheet open, sort dropdown) flips.
 * The shallow `course` reference is stable because the page swaps the
 * whole `items` array on each fetch.
 */
export const CourseCard = memo(CourseCardComponent);

export default CourseCard;
