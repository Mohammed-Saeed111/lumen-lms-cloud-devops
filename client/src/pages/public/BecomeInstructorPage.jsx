/**
 * `BecomeInstructorPage` — `/teach`.
 *
 * Marketing pitch for prospective instructors. Surfaces the value
 * proposition (revenue share, audience, support), explains the
 * application flow, and CTAs into either the application form (when
 * one ships) or the existing register flow as a sensible fallback.
 *
 * Static, no data fetching — designed to be SEO-indexable and link-
 * shareable on social. Visual language mirrors the landing page so a
 * visitor arriving from the navbar feels at home.
 */

import { Link } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import { Button, Icon } from '../../components/ui/index.js';
import { useAuth } from '../../context/useAuth.js';
import { ROUTES } from '../../utils/constants.js';

const VALUE_PROPS = [
  {
    icon: 'ShieldCheck',
    title: 'Standard Operating Procedures & Curriculum',
    body: 'Build step-by-step SOP modules, video walkthroughs, and safety assessments tailored to plant machinery and line operations.',
  },
  {
    icon: 'Users',
    title: 'Role-Based Workforce Qualification',
    body: 'Ensure factory technicians, machine operators, and maintenance personnel achieve verified competency before independent operation.',
  },
  {
    icon: 'ClipboardCheck',
    title: 'Safety Documentation & Records',
    body: 'Assessment gates, safety acknowledgments, and structured training records to support internal plant safety guidelines.',
  },
  {
    icon: 'TrendingUp',
    title: 'Department Progress Tracking',
    body: 'Shift supervisors and plant management monitor qualification milestones, quiz attempts, and completion metrics in real time.',
  },
];

const STEPS = [
  {
    title: 'Outline training standard',
    body: 'Define learning objectives, required safety notices, PPE requirements, and SOP documentation references.',
  },
  {
    title: 'Author curriculum & media',
    body: 'Upload procedural video walkthroughs, attach standard operating documentation, and create knowledge assessments.',
  },
  {
    title: 'Safety & supervisory review',
    body: 'Review modules with plant EHS coordinators and department leads to ensure full procedural accuracy.',
  },
  {
    title: 'Publish & certify workforce',
    body: 'Release modules to the plant workforce, track operator progress, and verify competency certificates.',
  },
];

const FAQ = [
  {
    q: 'Who can author courses in Opervanta?',
    a: 'Plant supervisors, certified technical trainers, EHS safety officers, and manufacturing engineers designated with instructor permissions.',
  },
  {
    q: 'What training formats are supported?',
    a: 'Step-by-step video procedures, text SOPs, PDF reference guides, and rigorous multiple-choice safety knowledge assessments.',
  },
  {
    q: 'How are employee completions tracked?',
    a: 'Every lesson completed and quiz attempt is recorded with timestamps, progress percent, and passing status for workforce qualification tracking.',
  },
  {
    q: 'Can courses be assigned to specific roles?',
    a: 'Yes. Training administrators can designate modules for specific operational roles, technical levels, and plant departments.',
  },
];

export default function BecomeInstructorPage() {
  const { isAuthenticated, isInstructor, isAdmin } = useAuth();
  const ctaTarget = isAuthenticated
    ? isInstructor || isAdmin
      ? ROUTES.instructor
      : ROUTES.dashboard
    : `${ROUTES.register}?next=${encodeURIComponent(ROUTES.teach)}`;
  const ctaLabel = isAuthenticated
    ? isInstructor || isAdmin
      ? 'Open trainer dashboard'
      : 'Access workforce portal'
    : 'Sign in to portal';

  return (
    <>
      <Seo
        title="Trainer Portal — Opervanta"
        description="Technical instructor and supervisor portal on Opervanta. Author standard operating procedures, assess workforce competency, and maintain plant compliance."
        url="/teach"
      />

      <div className="bg-bg">
        {/* Hero ------------------------------------------------------ */}
        <section className="relative isolate overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-primary/15 via-transparent to-info/10"
          />
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Opervanta Trainer Portal
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-text sm:text-5xl">
              Equip your workforce with verified operational competency.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
              Author factory SOPs, deliver safety orientations, and verify machinery operation readiness
              with digital training management.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={ctaTarget}>
                <Button size="lg" rightIcon={<Icon name="ArrowRight" size={18} />}>
                  {ctaLabel}
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  leftIcon={<Icon name="Workflow" size={18} />}
                >
                  See authoring workflow
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Value props ----------------------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Industrial Instruction
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Engineered for shop-floor standard operating procedures.
            </h2>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {VALUE_PROPS.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-border bg-bg p-6"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={item.icon} size={20} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-text">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Steps ----------------------------------------------------- */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-b border-border bg-bg-muted/40"
        >
          <div className="mx-auto max-w-3xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Authoring Workflow
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              From procedure draft to certified workforce in four steps.
            </h2>

            <ol className="mt-10 space-y-6">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-xl border border-border bg-bg p-6"
                >
                  <span className="absolute -top-3 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg shadow">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-text">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Compliance tracking preview ------------------------------- */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Workforce Accountability
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
                Real-time qualification visibility across shifts.
              </h2>
              <p className="mt-4 leading-relaxed text-text-muted">
                Track compliance metrics by department, monitor assessment pass rates, and verify that every
                front-line worker has mastered prerequisite SOPs before production line authorization.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
                <li className="flex items-start gap-2.5">
                  <Icon name="Check" size={16} className="mt-0.5 text-success" />
                  Structured tracking of plant safety and operational procedures
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon name="Check" size={16} className="mt-0.5 text-success" />
                  Automated certificate generation with unique verification IDs
                </li>
                <li className="flex items-start gap-2.5">
                  <Icon name="Check" size={16} className="mt-0.5 text-success" />
                  Protected compliance history and non-deletable qualification audit trails
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-bg-muted/40 p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
                Facility Qualification Status
              </p>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Safety &amp; EHS Mandatory</dt>
                  <dd className="font-semibold text-success">98.4% Compliant</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Machinery &amp; CNC Operations</dt>
                  <dd className="font-semibold text-text">91.2% Qualified</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Assembly &amp; Line SOPs</dt>
                  <dd className="font-semibold text-text">94.8% Qualified</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-3">
                  <dt className="text-text-muted">Active Workers Enrolled</dt>
                  <dd className="font-medium text-text">148 Operators</dd>
                </div>
                <div className="flex justify-between pt-2 text-base">
                  <dt className="font-semibold text-text">Overall Plant Readiness</dt>
                  <dd className="font-semibold text-success">95.6%</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-text-subtle">
                Audit metrics reflect live assessment records and completed SOP qualifications.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ ------------------------------------------------------- */}
        <section className="border-b border-border bg-bg-muted/40">
          <div className="mx-auto max-w-3xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Frequently asked
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Questions from technical trainers and supervisors.
            </h2>

            <dl className="mt-10 space-y-6">
              {FAQ.map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border border-border bg-bg p-6"
                >
                  <dt className="text-base font-semibold text-text">
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-text-muted">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA ------------------------------------------------------- */}
        <section className="bg-linear-to-br from-primary via-primary-hover to-info text-white">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to author factory training standards?
            </h2>
            <p className="mt-3 leading-relaxed text-white/85">
              Access the authoring suite to build, manage, and assign technical training.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={ctaTarget}>
                <Button
                  size="lg"
                  variant="secondary"
                  rightIcon={<Icon name="ArrowRight" size={18} />}
                >
                  {ctaLabel}
                </Button>
              </Link>
              <a href="mailto:support@opervanta.com?subject=Trainer%20Portal%20Inquiry">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  leftIcon={<Icon name="Mail" size={18} />}
                >
                  Contact training lead
                </Button>
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
