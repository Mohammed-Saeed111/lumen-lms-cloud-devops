/**
 * `FaqAccordion` — six common questions wrapped in the shared `Accordion`
 * primitive. Doubles as SEO surface (each answer is plain text in the
 * DOM even when the panel is collapsed, since `Accordion` mounts the
 * panel content lazily — but the section is structured so a future
 * static-render pass can swap in a JSON-LD FAQPage block effortlessly).
 */

import { Accordion } from '../ui/index.js';
import { Reveal } from '../layout/index.js';

const FAQS = [
  {
    id: 'assignments',
    title: 'How are training modules assigned to workers?',
    content:
      'Plant supervisors and training administrators assign required modules based on job role, department, and facility safety standards.',
  },
  {
    id: 'compliance',
    title: 'How does Opervanta record training activity?',
    content:
      'Training progress, lesson completion, and quiz scores are recorded with timestamps and passing records for workforce oversight and supervisory reviews.',
  },
  {
    id: 'certificates',
    title: 'Are completion credentials verifiable?',
    content:
      'Yes. Every issued certificate includes a unique verification code and timestamp linked to employee records for internal supervisor verification.',
  },
  {
    id: 'devices',
    title: 'Can operators access training on shop-floor tablets?',
    content:
      'Opervanta is a fully responsive web application optimized for plant tablets, kiosk terminals, and mobile devices across facility operations.',
  },
  {
    id: 'instructors',
    title: 'Who authors and approves training modules?',
    content:
      'Standard operating procedures and technical courses are authored by certified plant trainers, safety engineers, and department supervisors.',
  },
  {
    id: 'assessments',
    title: 'What happens if a safety assessment is not passed?',
    content:
      'Operators can review procedure documentation, consult with their shift supervisor, and re-attempt the assessment according to plant policy guidelines.',
  },
];

export function FaqAccordion() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="mx-auto max-w-3xl px-6 py-16 lg:py-20"
    >
      <Reveal className="text-center mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Questions, answered
        </p>
        <h2
          id="faq-heading"
          className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-text"
        >
          Frequently asked questions
        </h2>
      </Reveal>

      <Reveal>
        <Accordion items={FAQS} type="single" />
      </Reveal>
    </section>
  );
}

export default FaqAccordion;
