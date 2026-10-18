/**
 * `AuthShell` — shared two-column wrapper for `/login` and `/register`.
 *
 * Layout:
 *   - Desktop: form panel left, brand panel right (gradient + decoration +
 *     tagline + social proof). The brand panel never scrolls horizontally
 *     and clips its blobs so the gradient stays inside the viewport.
 *   - Mobile: brand panel collapses entirely; the form fills the screen
 *     with a small inline brand strip on top so the user still sees who
 *     they are signing into.
 *
 * Motion:
 *   - The form column intentionally has NO entrance animation — see the
 *     inline note on the <section> below for the rationale.
 *   - The brand column uses a gentle scale-in so it still arrives with
 *     polish without risking the form ever paint as invisible.
 *
 * Composition:
 *   - Pages render their form (title, fields, submit) as `children`. The
 *     shell owns the surrounding chrome so login & register stay visually
 *     consistent without copy-pasting the surround.
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Logo } from '../../components/brand/index.js';
import { Seo } from '../../components/seo/index.js';
import { Icon } from '../../components/ui/index.js';
import { ROUTES } from '../../utils/constants.js';
import { durations, ease } from '../../utils/motion.js';

const BRAND_HIGHLIGHTS = [
  {
    icon: 'ShieldCheck',
    title: 'Standard Operating Procedures (SOPs)',
    body: 'Standardized operational workflows and verified workplace safety protocols.',
  },
  {
    icon: 'Cpu',
    title: 'Machine & Line Qualifications',
    body: 'Verify practical operator competencies and machine authorization records.',
  },
  {
    icon: 'Award',
    title: 'Workforce Training Oversight',
    body: 'Maintain structured training records, completion certificates, and qualification logs.',
  },
];

export function AuthShell({
  title,
  subtitle,
  footerLink,
  children,
}) {
  return (
    <div className="min-h-[calc(100vh-64px)] grid lg:grid-cols-[1fr_1fr]">
      {/* Auth forms must never appear in search results — the per-page
          Seo (login/register/forgot) only sets the title; this shell-
          level Seo owns the noindex policy. */}
      <Seo noIndex />

      {/* Form column.
          NOTE — we intentionally render this as a plain <section> (no
          motion entrance animation). When AuthShell is reused across
          /login → /register via SPA navigation, framer-motion can leave
          the element stuck at `opacity: 0` if the variant transition is
          interrupted by the lazy chunk swap. The brand panel keeps its
          gentle scale-in because it's a sibling that always remounts as
          a single block, but the form needs to be guaranteed visible
          the moment React commits — there is no acceptable failure
          mode where the user can't see the form they came here to fill
          in. */}
      <section
        className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16"
        aria-labelledby="auth-title"
      >
        <div className="mx-auto w-full max-w-md">
          {/* Inline brand strip — visible on mobile, hidden on lg where the
              brand column already shows the wordmark. */}
          <Link
            to={ROUTES.home}
            className="inline-flex items-center gap-2 lg:hidden mb-6 text-text"
            aria-label="Opervanta — home"
          >
            <Logo variant="wordmark" size={28} color="var(--color-primary)" />
          </Link>

          <h1
            id="auth-title"
            className="text-3xl font-semibold tracking-tight text-text"
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-text-muted">{subtitle}</p>
          )}

          <div className="mt-8">{children}</div>

          {footerLink && (
            <p className="mt-8 text-sm text-text-muted text-center">
              {footerLink}
            </p>
          )}
        </div>
      </section>

      {/* Brand column — desktop only. */}
      <BrandPanel />
    </div>
  );
}

const BrandPanel = () => (
  <motion.aside
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: durations.slow, ease, delay: 0.05 }}
    aria-hidden="true"
    className="relative hidden lg:flex overflow-hidden bg-slate-900 border-l border-slate-800 text-slate-100"
  >
    {/* Subtle industrial background pattern */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:24px_24px] opacity-25"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-900/60 via-transparent to-slate-950/80"
    />

    <div className="relative flex flex-col justify-between p-12 w-full max-w-xl mx-auto">
      <Link
        to={ROUTES.home}
        className="inline-flex items-center gap-2 text-white"
        aria-label="Opervanta — home"
      >
        <Logo variant="wordmark" size={32} color="#ffffff" accent="#93c5fd" />
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          Opervanta Platform
        </p>
        <h2 className="mt-3 text-3xl font-semibold leading-snug max-w-md text-white">
          Industrial Workforce Training & Competency Management Platform
        </h2>

        <ul className="mt-10 space-y-5 max-w-md">
          {BRAND_HIGHLIGHTS.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center
                justify-center rounded-lg bg-slate-800 border border-slate-700 text-blue-400">
                <Icon name={item.icon} size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-800 pt-4">
        <Icon name="ShieldCheck" size={16} className="text-emerald-500" />
        <span>Authorized Personnel & Plant Operations Portal</span>
      </div>
    </div>
  </motion.aside>
);

export default AuthShell;
