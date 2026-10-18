/**
 * `TermsPage` — `/terms`.
 *
 * Static, plain-language Terms of Service. Copy is maintained directly in
 * this file (no CMS) so policy changes go through code review and ship
 * with the rest of the app. The shared `LegalPage` shell handles the
 * surrounding chrome (table of contents, last-updated stamp, contact
 * footer) — keep new sections in the order they should appear.
 */

import { Seo } from '../../components/seo/index.js';
import LegalPage from './_LegalPage.jsx';

const TERMS_SECTIONS = [
  {
    id: 'acceptance',
    title: 'Acceptance of these terms',
    body: [
      'By creating an account, accessing a training module or otherwise using Opervanta (the "Service"), you agree to be bound by these Terms of Service and by our Privacy Policy. If you do not agree, please do not use the Service.',
      'These terms apply to workforce learners, trainers, supervisors, and administrative personnel accessing the platform.',
    ],
  },
  {
    id: 'accounts',
    title: 'Your account',
    body: [
      'You are responsible for keeping your login credentials confidential and for all activity under your account. Notify us at support@opervanta.com if you suspect unauthorised access.',
      'We may suspend or terminate accounts that breach these terms, infringe other users\u2019 rights or expose the Service to operational, legal, or security risk.',
    ],
  },
  {
    id: 'content',
    title: 'Course content & training materials',
    body: [
      'Training materials, standard operating procedures, and safety modules uploaded to Opervanta are maintained for workforce training and operational instruction.',
      'Learners receive internal access to view and complete assigned training materials. Downloading, unauthorized distribution, or misuse of operational procedures outside plant authorization is prohibited.',
      'Feedback, questions, and responses submitted within training assessments are retained for training recordkeeping and operational evaluation.',
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: [
      'Do not upload or share content that is hazardous, defamatory, harassing, hateful, or that infringes intellectual-property rights. Do not attempt to disrupt the Service, probe for vulnerabilities outside our published security policy, or scrape platform data.',
      'Repeated violations will result in administrative account suspension or revocation of platform access.',
    ],
  },
  {
    id: 'assignments',
    title: 'Training assignments & access administration',
    body: [
      'Training modules on Opervanta are assigned by plant supervisors and administrators as part of organizational workforce development. Opervanta does not process individual retail purchases, consumer transactions, or instructor commission payouts.',
      'Access to modules is administered through internal role assignments. When an administrator revokes an active assignment, historical training records, completed lesson history, and assessment attempts remain preserved for audit and qualification tracking.',
    ],
  },
  {
    id: 'certificates',
    title: 'Certificates of completion',
    body: 'Certificates and completion records issued by Opervanta confirm that a learner has completed a specific training module or safety assessment on a specific date. They document internal workforce training and qualification records and do not constitute independent external statutory licenses unless explicitly validated by accredited certifying authorities.',
  },
  {
    id: 'availability',
    title: 'Availability & changes to the Service',
    body: [
      'We work hard to keep Opervanta available 24/7 for plant operations, but we do not guarantee uninterrupted access. Planned maintenance windows are communicated in advance whenever possible.',
      'We may add, modify or update training features as plant operations require. When training modules are revised or retired by instructors or administrators, historical completion records for previously certified workers remain preserved.',
    ],
  },
  {
    id: 'liability',
    title: 'Disclaimers & limitation of liability',
    body: [
      'The Service and training content are provided "as is" for internal workforce instruction and operational oversight. We do not warrant that all materials are error-free or that the platform alone guarantees statutory compliance.',
      'To the maximum extent permitted by law, our liability arising from your use of the Service is limited to direct administrative remedies or USD 100. We are not liable for indirect, incidental, or consequential damages.',
    ],
  },
  {
    id: 'termination',
    title: 'Termination',
    body: 'Administrative personnel may suspend or revoke access to training modules or accounts if users breach these terms, if continued access compromises plant security or safety, or as required by operational policies. Sections that by their nature should survive termination — including training records retention, content licenses for published materials, and limitation of liability — will continue to apply.',
  },
  {
    id: 'governing-law',
    title: 'Governing law & disputes',
    body: 'These terms are governed by the applicable laws of the jurisdiction in which Opervanta is deployed, without regard to conflict-of-laws principles. Any dispute will first be addressed through good-faith administrative review; if unresolved, it will be settled by competent authorities of that jurisdiction.',
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: 'We may update these Terms of Service from time to time. Material changes are announced via in-app notice and email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the revised terms.',
  },
];

export default function TermsPage() {
  return (
    <>
      <Seo
        title="Terms of Service"
        description="The rules that govern your use of Opervanta — accounts, content, training compliance and platform policies."
        url="/terms"
      />
      <LegalPage
        title="Terms of Service"
        subtitle="The agreement between you and Opervanta when you create an account, enrol in a course or publish content on the platform."
        effectiveDate="2026-04-01"
        intro="This is the plain-English version of our terms. We try to keep it short, specific and free of legalese — but where a section uses a defined word like “Service”, the meaning carries through the whole document."
        sections={TERMS_SECTIONS}
      />
    </>
  );
}
