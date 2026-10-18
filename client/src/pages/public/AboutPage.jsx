/**
 * `AboutPage` — `/about`.
 *
 * Brand / mission page linked from the footer. Stays purely static (no
 * data fetching) so it can render instantly and double as a high-trust
 * landing target from press, partnerships and email signatures.
 *
 * Layout: hero strip → mission → product pillars → team principles →
 * CTA back into the catalog. Composed from the same UI primitives used
 * by the marketing landing page so the visual language stays consistent.
 */

import { Link } from 'react-router-dom';

import { Seo } from '../../components/seo/index.js';
import { Button, Icon } from '../../components/ui/index.js';
import { ROUTES } from '../../utils/constants.js';

const PILLARS = [
  {
    icon: 'ShieldCheck',
    title: 'Standard Operating Procedures & Safety',
    body: 'Every training module directly reinforces standardized operating procedures (SOPs), workplace safety protocols, and hazard mitigation on the plant floor.',
  },
  {
    icon: 'Award',
    title: 'Verifiable Competency Records',
    body: 'Training records and qualification tracking designed to support plant safety protocols and internal workforce oversight.',
  },
  {
    icon: 'Users',
    title: 'Supervisor & Workforce Alignment',
    body: 'Connecting shift supervisors, technical trainers, and front-line workers with clear role assignments and tracked progression paths.',
  },
  {
    icon: 'TrendingUp',
    title: 'Continuous Skill & Safety Qualification',
    body: 'Empowering operators with structured digital curriculum and assessment gates before undertaking critical machinery operations.',
  },
];

const PRINCIPLES = [
  {
    title: 'Safety is the primary baseline.',
    body: 'Operational excellence starts with uncompromised worker safety and rigorous verification of mandatory training.',
  },
  {
    title: 'Traceable workforce records.',
    body: 'Training records, timestamps, and assessment completions remain structured and accessible for internal supervisory oversight.',
  },
  {
    title: 'Accessibility across the facility.',
    body: 'Responsive interfaces optimized for shop-floor kiosks, rugged tablets, and control room workstations.',
  },
  {
    title: 'Clear operational transparency.',
    body: 'Eliminating ambiguous qualification tracking so plant leadership always knows workforce readiness status.',
  },
];

const STATS = [
  { value: 'SOP', label: 'Standardized workflows' },
  { value: 'EHS', label: 'Safety documentation' },
  { value: '24/7', label: 'Plant floor accessibility' },
  { value: 'Role', label: 'Based qualification' },
];

export default function AboutPage() {
  return (
    <>
      <Seo
        title="About Opervanta"
        description="Industrial Workforce Training & Competency Management Platform — منصة التدريب الصناعي وإدارة كفاءة العاملين."
        url="/about"
      />

      <div className="bg-bg">
        {/* Hero ------------------------------------------------------ */}
        <section className="relative isolate overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-primary/10 via-transparent to-info/10"
          />
          <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              About Opervanta
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-text sm:text-5xl">
              Industrial Workforce Training &amp; Competency Management Platform
            </h1>
            <p className="mt-3 text-lg font-medium text-text-subtle font-arabic" dir="rtl">
              منصة التدريب الصناعي وإدارة كفاءة العاملين.
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
              Opervanta is purpose-built to help industrial facilities and manufacturing plants
              organize employee training, track qualification progress, and prepare operators
              for safe, compliant shop-floor execution.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={ROUTES.catalog}>
                <Button size="lg" rightIcon={<Icon name="ArrowRight" size={18} />}>
                  Training catalog
                </Button>
              </Link>
              <Link to={ROUTES.teach}>
                <Button
                  size="lg"
                  variant="outline"
                  leftIcon={<Icon name="ShieldCheck" size={18} />}
                >
                  Trainer portal
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats ----------------------------------------------------- */}
        <section className="border-b border-border bg-bg-muted/40">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission --------------------------------------------------- */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Our Mission
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Ensure every factory operator has the verified knowledge to work safely and productively.
          </h2>
          <p className="mt-5 leading-relaxed text-text-muted">
            Internal industrial training demands precision, accountability, and traceability.
            Opervanta transforms fragmented safety binders and spreadsheets into an integrated digital
            training platform with verifiable qualification standards.
          </p>
        </section>

        {/* Pillars --------------------------------------------------- */}
        <section className="border-y border-border bg-bg-muted/40">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Core Pillars
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              Engineered for manufacturing compliance and operations.
            </h2>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {PILLARS.map((pillar) => (
                <li
                  key={pillar.title}
                  className="rounded-xl border border-border bg-bg p-6"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={pillar.icon} size={20} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-text">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {pillar.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Principles ------------------------------------------------ */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle">
            Operating Principles
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Four commitments to factory operations.
          </h2>
          <ol className="mt-8 space-y-6">
            {PRINCIPLES.map((principle, index) => (
              <li key={principle.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-text">
                    {principle.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    {principle.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA ------------------------------------------------------- */}
        <section className="border-t border-border bg-linear-to-br from-primary via-primary-hover to-info text-white">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to standardize plant workforce training?
            </h2>
            <p className="mt-3 leading-relaxed text-white/85">
              Access role-based qualifications, SOP modules, and safety assessments.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={ROUTES.catalog}>
                <Button
                  size="lg"
                  variant="secondary"
                  rightIcon={<Icon name="ArrowRight" size={18} />}
                >
                  Training catalog
                </Button>
              </Link>
              <Link to={ROUTES.register}>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  Workforce access
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
