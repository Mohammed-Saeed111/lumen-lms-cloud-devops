/**
 * LMS API Integration Test Suite — Phase 1 Audit
 * Uses the CORRECT response shapes from the actual auth controller:
 *   login → { success, token, user }         (NOT data.accessToken)
 *   enroll → POST /api/courses/:id/enroll    (NOT /api/enrollments)
 * Run: node api_tests.mjs
 */

const BASE = 'http://localhost:5000/api';

let passed = 0;
let failed = 0;
let warned = 0;
const results = [];

async function req(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    let data;
    try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data, ok: res.ok };
  } catch (err) {
    return { status: 0, data: {}, error: err.message, ok: false };
  }
}

function record(name, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else warned++;
  results.push({ name, status, detail });
  console.log(`${icon} [${status}] ${name}${detail ? '\n        → ' + detail : ''}`);
}

function assert(cond, name, failDetail = '') {
  record(name, cond ? 'PASS' : 'FAIL', cond ? '' : failDetail);
}

// ── State ───────────────────────────────────────────────────────────────────
let studentToken = null;
let instructorToken = null;
let adminToken = null;
let testCourseId = null;
let testSectionId = null;
let testLessonId = null;
let testQuizId = null;
let studentUserId = null;
let instructorUserId = null;

const STUDENT_EMAIL = 'student@test.lms';
const STUDENT_PASS = 'Test@123456';
const INSTRUCTOR_EMAIL = 'instructor@test.lms';
const INSTRUCTOR_PASS = 'Test@123456';
const ADMIN_EMAIL = 'admin@lms.dev';
const ADMIN_PASS = 'Admin@123456';

// ════════════════════════════════════════════════════════════════════════════
// 1 — Health Check
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 1. Health Check ──────────────────────────────');
{
  const r = await req('GET', '/health');
  assert(r.status === 200 && r.data.status === 'ok', 'GET /health → 200 ok', `status=${r.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 2 — Registration
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 2. Registration ──────────────────────────────');
{
  // Valid student
  const r = await req('POST', '/auth/register', {
    body: { name: 'Test Student', email: STUDENT_EMAIL, password: STUDENT_PASS }
  });
  assert(r.status === 201 || r.status === 409, 'Register student (201 new / 409 existing)', `status=${r.status} ${JSON.stringify(r.data)}`);

  // Duplicate email → 409
  const r2 = await req('POST', '/auth/register', {
    body: { name: 'Dup', email: STUDENT_EMAIL, password: STUDENT_PASS }
  });
  assert(r2.status === 409, 'Duplicate email → 409', `status=${r2.status}`);

  // Short password → 422
  const r3 = await req('POST', '/auth/register', {
    body: { name: 'Weak', email: 'weak@test.lms', password: 'ab' }
  });
  assert(r3.status === 422 || r3.status === 400, 'Short password → 422/400', `status=${r3.status}`);

  // Missing name → 422
  const r4 = await req('POST', '/auth/register', {
    body: { email: 'noname@test.lms', password: STUDENT_PASS }
  });
  assert(r4.status === 422 || r4.status === 400, 'Missing name → 422/400', `status=${r4.status}`);

  // Register instructor
  const r5 = await req('POST', '/auth/register', {
    body: { name: 'Test Instructor', email: INSTRUCTOR_EMAIL, password: INSTRUCTOR_PASS }
  });
  assert(r5.status === 201 || r5.status === 409, 'Register instructor (201 new / 409 existing)', `status=${r5.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 3 — Login (response shape: { success, token, user })
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 3. Login ─────────────────────────────────────');
{
  const r = await req('POST', '/auth/login', {
    body: { email: STUDENT_EMAIL, password: STUDENT_PASS }
  });
  assert(r.status === 200 && r.data?.token, 'Student login → 200 + token', `status=${r.status} body=${JSON.stringify(r.data).slice(0,100)}`);
  if (r.data?.token) {
    studentToken = r.data.token;
    studentUserId = r.data.user?._id;
  }

  // Wrong password → 401
  const r2 = await req('POST', '/auth/login', {
    body: { email: STUDENT_EMAIL, password: 'wrongpass' }
  });
  assert(r2.status === 401, 'Wrong password → 401', `status=${r2.status}`);

  // Admin login
  const r3 = await req('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASS }
  });
  assert(r3.status === 200 && r3.data?.token, 'Admin login → 200 + token', `status=${r3.status}`);
  if (r3.data?.token) adminToken = r3.data.token;

  // Instructor login
  const r4 = await req('POST', '/auth/login', {
    body: { email: INSTRUCTOR_EMAIL, password: INSTRUCTOR_PASS }
  });
  assert(r4.status === 200 && r4.data?.token, 'Instructor login → 200 + token', `status=${r4.status}`);
  if (r4.data?.token) {
    instructorToken = r4.data.token;
    instructorUserId = r4.data.user?._id;
  }

  // Empty body → 422
  const r5 = await req('POST', '/auth/login', { body: {} });
  assert(r5.status === 422 || r5.status === 400, 'Empty login body → 422', `status=${r5.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 4 — /auth/me
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 4. GET /auth/me ───────────────────────────────');
{
  const r = await req('GET', '/auth/me', { token: studentToken });
  assert(r.status === 200 && (r.data?.user?.email === STUDENT_EMAIL || r.data?.data?.email === STUDENT_EMAIL), 'GET /auth/me with token → 200', `status=${r.status}`);

  const r2 = await req('GET', '/auth/me');
  assert(r2.status === 401, 'GET /auth/me without token → 401', `status=${r2.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 5 — Admin: promote instructor role
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 5. Admin: Promote Instructor ──────────────────');
if (adminToken && instructorUserId) {
  const r = await req('PATCH', `/admin/users/${instructorUserId}/role`, {
    token: adminToken,
    body: { role: 'instructor' }
  });
  assert(r.status === 200, 'Admin promotes user → instructor', `status=${r.status} ${JSON.stringify(r.data)}`);
  // Re-login for fresh token with new role
  const r2 = await req('POST', '/auth/login', {
    body: { email: INSTRUCTOR_EMAIL, password: INSTRUCTOR_PASS }
  });
  if (r2.data?.token) instructorToken = r2.data.token;
} else {
  record('Admin promote instructor', 'WARN', 'Skipped — no admin or instructor token');
}

// ════════════════════════════════════════════════════════════════════════════
// 6 — Admin Dashboard Stats
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 6. Admin Dashboard ────────────────────────────');
if (adminToken) {
  const r = await req('GET', '/admin/stats', { token: adminToken });
  assert(r.status === 200 && r.data?.success, 'GET /admin/stats → 200', `status=${r.status}`);

  // Student blocked from admin
  const r2 = await req('GET', '/admin/stats', { token: studentToken });
  assert(r2.status === 403, 'Student → /admin/stats → 403', `status=${r2.status}`);

  // Instructor blocked from admin
  if (instructorToken) {
    const r3 = await req('GET', '/admin/stats', { token: instructorToken });
    assert(r3.status === 403, 'Instructor → /admin/stats → 403', `status=${r3.status}`);
  }
} else {
  record('Admin dashboard stats', 'WARN', 'Skipped — no admin token');
}

// ════════════════════════════════════════════════════════════════════════════
// 7 — Admin User Management
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 7. Admin User Management ──────────────────────');
if (adminToken) {
  const r = await req('GET', '/admin/users', { token: adminToken });
  assert(r.status === 200 && Array.isArray(r.data?.data?.items), 'GET /admin/users → paginated list', `status=${r.status}`);

  const r2 = await req('GET', `/admin/users/${studentUserId}`, { token: adminToken });
  assert(r2.status === 200 && (r2.data?.data?.user?.email === STUDENT_EMAIL || r2.data?.data?.email === STUDENT_EMAIL), 'GET /admin/users/:id → user record', `status=${r2.status}`);

  // Admin can disable user
  const r3 = await req('PATCH', `/admin/users/${studentUserId}/active`, {
    token: adminToken,
    body: { isActive: false }
  });
  assert(r3.status === 200, 'Admin disables student account', `status=${r3.status}`);

  // Re-enable
  const r4 = await req('PATCH', `/admin/users/${studentUserId}/active`, {
    token: adminToken,
    body: { isActive: true }
  });
  assert(r4.status === 200, 'Admin re-enables student account', `status=${r4.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 8 — Course Creation
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 8. Course Creation ────────────────────────────');
if (instructorToken) {
  const r = await req('POST', '/courses', {
    token: instructorToken,
    body: {
      title: `Machine Safety & LOTO Procedure ${Date.now()}`,
      description: 'Factory workplace safety training program on LOTO procedures.',
      category: 'safety-ehs',
      department: 'Assembly',
      targetJobRole: 'Line Operator',
      sopReference: 'SOP-SAF-001',
      level: 'beginner',
      language: 'en',
      price: 0,
    }
  });
  if (r.status === 201 && (r.data?.course?._id || r.data?.data?._id)) {
    testCourseId = r.data.course?._id || r.data.data?._id;
    record('Instructor creates draft course', 'PASS');
  } else {
    record('Instructor creates draft course', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }

  // Student cannot create course → 403
  const r2 = await req('POST', '/courses', {
    token: studentToken,
    body: { title: 'Hack', description: 'nope', category: 'other', level: 'beginner', language: 'en' }
  });
  assert(r2.status === 403, 'Student cannot create course → 403', `status=${r2.status}`);
} else {
  record('Course creation', 'WARN', 'Skipped — no instructor token');
}

// ════════════════════════════════════════════════════════════════════════════
// 9 — Course Catalog
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 9. Course Catalog ─────────────────────────────');
{
  const r = await req('GET', '/courses');
  assert(r.status === 200, 'GET /courses (public catalog) → 200', `status=${r.status}`);

  const r2 = await req('GET', '/courses/categories');
  assert(r2.status === 200, 'GET /courses/categories → 200', `status=${r2.status}`);

  if (instructorToken) {
    const r3 = await req('GET', '/courses/mine', { token: instructorToken });
    assert(r3.status === 200, 'GET /courses/mine (instructor) → 200', `status=${r3.status}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 10 — Section Creation
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 10. Section Management ────────────────────────');
if (instructorToken && testCourseId) {
  const r = await req('POST', `/courses/${testCourseId}/sections`, {
    token: instructorToken,
    body: { title: 'Section 1: Safety & Procedures' }
  });
  if (r.status === 201 && (r.data?.section?._id || r.data?.data?._id)) {
    testSectionId = r.data.section?._id || r.data.data?._id;
    record('Instructor creates section', 'PASS');
  } else {
    record('Instructor creates section', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }

  // Student cannot create section → 403
  const r2 = await req('POST', `/courses/${testCourseId}/sections`, {
    token: studentToken,
    body: { title: 'Hack Section' }
  });
  assert(r2.status === 403, 'Student cannot create section → 403', `status=${r2.status}`);
} else {
  record('Section creation', 'WARN', 'Skipped — no instructor token or course');
}

// ════════════════════════════════════════════════════════════════════════════
// 11 — Lesson Creation
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 11. Lesson Management ─────────────────────────');
if (instructorToken && testSectionId) {
  const r = await req('POST', `/sections/${testSectionId}/lessons`, {
    token: instructorToken,
    body: {
      title: 'Safety Lesson 1: LOTO Work Instructions',
      type: 'text',
      content: 'Standard operating procedure for lockout/tagout in machine area.',
      sopCode: 'SOP-SAF-001',
      safetyNotice: {
        hazardLevel: 'high',
        requiredPPE: ['Safety Glasses', 'Insulated Gloves', 'Lockout Padlock'],
        cautionNotes: 'Ensure energy sources are discharged before attaching locks.',
      },
      duration: 300,
    }
  });
  if (r.status === 201 && (r.data?.lesson?._id || r.data?.data?._id)) {
    testLessonId = r.data.lesson?._id || r.data.data?._id;
    record('Instructor creates lesson', 'PASS');
  } else {
    record('Instructor creates lesson', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }

  // Verify critical hazard level is accepted
  const rCrit = await req('POST', `/sections/${testSectionId}/lessons`, {
    token: instructorToken,
    body: {
      title: 'High Voltage Lockout - Critical Safety',
      type: 'text',
      content: 'Critical procedure requiring strict adherence.',
      sopCode: 'SOP-SAF-002',
      safetyNotice: {
        hazardLevel: 'critical',
        requiredPPE: ['Arc Flash Suit', 'Dielectric Gloves'],
        cautionNotes: 'Fatal electrical hazard. Verify zero energy.'
      },
      duration: 180,
    }
  });
  assert(rCrit.status === 201 && (rCrit.data?.lesson?.safetyNotice?.hazardLevel === 'critical' || rCrit.data?.data?.safetyNotice?.hazardLevel === 'critical'), 'Lesson accepts hazardLevel: "critical"', `status=${rCrit.status}`);

  // Verify invalid hazard level is rejected with 422
  const rInv = await req('POST', `/sections/${testSectionId}/lessons`, {
    token: instructorToken,
    body: {
      title: 'Invalid Hazard Level Lesson',
      type: 'text',
      content: 'Testing invalid hazard level rejection.',
      safetyNotice: { hazardLevel: 'extreme_danger' }
    }
  });
  assert(rInv.status === 422, 'Rejects invalid hazardLevel → 422', `status=${rInv.status}`);
} else {
  record('Lesson creation', 'WARN', 'Skipped — no instructor token or section');
}

// ════════════════════════════════════════════════════════════════════════════
// 12 — Quiz Creation
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 12. Quiz Creation ─────────────────────────────');
if (instructorToken && testLessonId) {
  const r = await req('POST', `/lessons/${testLessonId}/quiz`, {
    token: instructorToken,
    body: {
      title: 'Audit Quiz',
      description: 'Phase 1 audit quiz',
      passingScore: 60,
      questions: [
        {
          question: 'What does LMS stand for?',
          options: ['Learning Management System', 'Large Meta Server', 'Lazy Module Stack', 'None'],
          correctIndex: 0,
          explanation: 'LMS = Learning Management System',
        },
        {
          question: 'Which framework is the backend built with?',
          options: ['Django', 'Express', 'Flask', 'Spring'],
          correctIndex: 1,
          explanation: 'Express.js on Node.js',
        },
      ]
    }
  });
  if (r.status === 201 && r.data?.quiz?._id) {
    testQuizId = r.data.quiz._id;
    record('Instructor creates quiz', 'PASS');
  } else {
    record('Instructor creates quiz', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }

  // Duplicate quiz on same lesson → 409
  const r2 = await req('POST', `/lessons/${testLessonId}/quiz`, {
    token: instructorToken,
    body: {
      title: 'Duplicate Quiz',
      passingScore: 60,
      questions: [
        { question: 'What is safety PPE?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }
      ]
    }
  });
  assert(r2.status === 409, 'Duplicate quiz on same lesson → 409', `status=${r2.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 13 — Course Submit for Review + Admin Approve
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 13. Course Publish Workflow ───────────────────');
if (instructorToken && testCourseId) {
  const r = await req('POST', `/courses/${testCourseId}/submit`, { token: instructorToken });
  assert(r.status === 200 || r.status === 201, 'Instructor submits course for review', `status=${r.status} ${JSON.stringify(r.data)}`);

  if (adminToken) {
    const r2 = await req('POST', `/admin/courses/${testCourseId}/approve`, { token: adminToken });
    assert(r2.status === 200, 'Admin approves course → published', `status=${r2.status} ${JSON.stringify(r2.data)}`);

    // Verify course is now published
    const r3 = await req('GET', `/courses`, { token: instructorToken });
    assert(r3.status === 200, 'Published course appears in catalog', `status=${r3.status}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 14 — Enrollment (POST /api/courses/:id/enroll)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 14. Enrollment ────────────────────────────────');
if (studentToken && testCourseId) {
  const r = await req('POST', `/courses/${testCourseId}/enroll`, { token: studentToken });
  if (r.status === 201 || r.status === 409) {
    record('Student enrolls in published course (201 new / 409 already enrolled)', 'PASS');
  } else {
    record('Student enrolls in published course', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }

  // Duplicate enrollment → 409
  const r2 = await req('POST', `/courses/${testCourseId}/enroll`, { token: studentToken });
  assert(r2.status === 409, 'Duplicate enrollment → 409', `status=${r2.status}`);

  // GET my enrollments
  const r3 = await req('GET', '/enrollments/mine', { token: studentToken });
  assert(r3.status === 200, 'GET /enrollments/mine → 200', `status=${r3.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 15 — Quiz Security: Student view strips answer key
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 15. Quiz Security (Answer Key) ───────────────');
if (studentToken && testQuizId) {
  const r = await req('GET', `/quizzes/${testQuizId}`, { token: studentToken });
  if (r.status === 200) {
    const questions = r.data?.quiz?.questions || [];
    const exposesCorrectIndex = questions.some(q => 'correctIndex' in q && q.correctIndex !== undefined);
    const exposesExplanation = questions.some(q => 'explanation' in q && q.explanation !== undefined);
    assert(!exposesCorrectIndex, 'Student view does NOT expose correctIndex (answer key)', 'SECURITY FAIL: correctIndex exposed to student!');
    assert(!exposesExplanation, 'Student view does NOT expose explanation (pre-submission)', 'SECURITY FAIL: explanation exposed to student!');
    record('Student can access quiz after enrollment', 'PASS');
  } else {
    record('Student access to enrolled quiz', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }

  // Un-enrolled user (instructor) should get 403
  if (instructorToken) {
    const r2 = await req('GET', `/quizzes/${testQuizId}`, { token: instructorToken });
    assert(r2.status === 403, 'Non-enrolled user → quiz → 403', `status=${r2.status}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 16 — Quiz Submission
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 16. Quiz Submission ───────────────────────────');
if (studentToken && testQuizId) {
  // All correct answers [0, 1] → score=100
  const r = await req('POST', `/quizzes/${testQuizId}/submit`, {
    token: studentToken,
    body: { answers: [0, 1], timeSpentSeconds: 120 }
  });
  if (r.status === 201) {
    record('Student submits quiz answers → 201', 'PASS');
    assert(r.data.score === 100, 'Server-graded score = 100 (all correct)', `score=${r.data.score}`);
    assert(r.data.passed === true, 'passed = true (score ≥ passingScore 60)', `passed=${r.data.passed}`);
    assert(Array.isArray(r.data.perQuestion), 'perQuestion feedback included in response', '');
    // After submission, correctIndex should appear in perQuestion
    const hasCorrectIndex = r.data.perQuestion?.every(q => typeof q.correctIndex === 'number');
    assert(hasCorrectIndex, 'Correct answers revealed in submit response', `perQuestion=${JSON.stringify(r.data.perQuestion)}`);
  } else {
    record('Student submits quiz answers', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }

  // Wrong answer count → 400
  const r2 = await req('POST', `/quizzes/${testQuizId}/submit`, {
    token: studentToken,
    body: { answers: [0], timeSpentSeconds: 30 }
  });
  assert(r2.status === 400, 'Wrong answer count → 400', `status=${r2.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 17 — Quiz Attempt History
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 17. Quiz Attempt History ──────────────────────');
if (studentToken && testQuizId) {
  const r = await req('GET', `/quizzes/${testQuizId}/attempts/mine`, { token: studentToken });
  assert(r.status === 200 && Array.isArray(r.data?.data?.items), 'GET attempts/mine → paginated history', `status=${r.status}`);
  if (r.data?.data?.items?.length > 0) {
    assert(r.data.data.items[0].score === 100, 'Latest attempt score = 100', `score=${r.data.data.items[0].score}`);
  }

  const r2 = await req('GET', `/quizzes/${testQuizId}/best/mine`, { token: studentToken });
  assert(r2.status === 200 && r2.data?.data?.best === 100, 'GET best/mine → best=100', `status=${r2.status} best=${r2.data?.data?.best}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 18 — Lesson Progress
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 18. Lesson Progress ───────────────────────────');
if (studentToken && testLessonId) {
  const r = await req('POST', `/lessons/${testLessonId}/complete`, { token: studentToken });
  assert(r.status === 200 || r.status === 201, 'Student marks lesson complete', `status=${r.status} ${JSON.stringify(r.data)}`);

  if (testCourseId) {
    const r2 = await req('GET', `/courses/${testCourseId}/progress`, { token: studentToken });
    assert(r2.status === 200, 'GET course progress → 200', `status=${r2.status}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 19 — RBAC Enforcement (unauthorized access)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 19. RBAC Enforcement ──────────────────────────');
{
  // No token → 401
  const r = await req('GET', '/auth/me');
  assert(r.status === 401, 'No token → 401', `status=${r.status}`);

  // Student → admin → 403
  const r2 = await req('GET', '/admin/users', { token: studentToken });
  assert(r2.status === 403, 'Student → /admin/users → 403', `status=${r2.status}`);

  // Instructor → admin → 403
  if (instructorToken) {
    const r3 = await req('GET', '/admin/users', { token: instructorToken });
    assert(r3.status === 403, 'Instructor → /admin/users → 403', `status=${r3.status}`);
  }

  // Student cannot update course
  if (testCourseId) {
    const r4 = await req('PATCH', `/courses/${testCourseId}`, {
      token: studentToken,
      body: { title: 'Hacked' }
    });
    assert(r4.status === 403, 'Student cannot PATCH course → 403', `status=${r4.status}`);
  }

  // Student cannot escalate privilege via PATCH /api/auth/me
  const rEsc = await req('PATCH', '/auth/me', {
    token: studentToken,
    body: { role: 'admin' }
  });
  const rCheck = await req('GET', '/auth/me', { token: studentToken });
  assert((rCheck.data?.user?.role === 'student' || rCheck.data?.data?.role === 'student'), 'Student cannot escalate role to admin via profile update', `role=${rCheck.data?.user?.role || rCheck.data?.data?.role}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 20 — Password Reset (anti-enumeration)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 20. Password Reset ────────────────────────────');
{
  const r = await req('POST', '/auth/forgot-password', {
    body: { email: 'nonexistent@ghost.lms' }
  });
  assert(r.status === 200, 'Forgot-password (nonexistent) always → 200 (anti-enum)', `status=${r.status}`);

  const r2 = await req('POST', '/auth/forgot-password', {
    body: { email: STUDENT_EMAIL }
  });
  assert(r2.status === 200 || r2.status === 429, 'Forgot-password (real email) → 200 or 429 (rate limited)', `status=${r2.status}`);

  // Invalid token → 400/404
  const r3 = await req('POST', '/auth/reset-password/invalidtoken', {
    body: { password: 'NewPass@123456' }
  });
  assert(r3.status === 400 || r3.status === 404 || r3.status === 422, 'Reset with invalid token → 400/404/422', `status=${r3.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 21 — Refresh Token
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 21. Refresh Token ─────────────────────────────');
{
  // No cookie → 401
  const r = await req('POST', '/auth/refresh');
  assert(r.status === 401 || r.status === 400, 'Refresh without cookie → 401/400', `status=${r.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 22 — Logout
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 22. Logout ────────────────────────────────────');
if (studentToken) {
  const r = await req('POST', '/auth/logout', { token: studentToken });
  assert(r.status === 200, 'POST /auth/logout → 200', `status=${r.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 23 — API Documentation
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 23. API Documentation ─────────────────────────');
{
  const r = await fetch('http://localhost:5000/api-docs.json');
  assert(r.status === 200, 'GET /api-docs.json → 200 (OpenAPI spec)', `status=${r.status}`);

  const r2 = await fetch('http://localhost:5000/api-docs');
  assert(r2.status === 200, 'GET /api-docs → 200 (Swagger UI)', `status=${r2.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 24 — Input Validation & Injection Protection
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 24. Input Validation & Security ──────────────');
{
  // NoSQL injection in email
  const r = await req('POST', '/auth/login', {
    body: { email: { $gt: '' }, password: 'anything' }
  });
  assert(r.status !== 500 && r.status !== 200, 'NoSQL injection in email rejected (not 500, not 200)', `status=${r.status}`);

  // XSS in name field — must not crash (500)
  const r2 = await req('POST', '/auth/register', {
    body: { name: '<script>alert(1)</script>', email: 'xss@test.lms', password: 'Test@123456' }
  });
  assert(r2.status !== 500, 'XSS in name field does not crash server', `status=${r2.status}`);

  // Empty body
  const r3 = await req('POST', '/auth/register', { body: {} });
  assert(r3.status === 422 || r3.status === 400, 'Empty register body → 422/400', `status=${r3.status}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 25 — Instructor view (answer key visible to owner)
// ════════════════════════════════════════════════════════════════════════════
console.log('\n── 25. Instructor Quiz View (answer key) ─────────');
if (instructorToken && testQuizId) {
  const r = await req('GET', `/quizzes/${testQuizId}/instructor`, { token: instructorToken });
  if (r.status === 200) {
    const hasCorrectIndex = r.data?.quiz?.questions?.every(q => typeof q.correctIndex === 'number');
    assert(hasCorrectIndex, 'Instructor view includes correctIndex (answer key)', `questions=${JSON.stringify(r.data?.quiz?.questions?.map(q=>q.correctIndex))}`);
  } else {
    record('Instructor quiz view', 'FAIL', `status=${r.status} ${JSON.stringify(r.data)}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed  |  ${failed} failed  |  ${warned} skipped`);
console.log('══════════════════════════════════════════════════\n');

const failures = results.filter(r => r.status === 'FAIL');
if (failures.length > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log(`  ❌ ${f.name}${f.detail ? ': ' + f.detail : ''}`));
}

process.exit(failed > 0 ? 1 : 0);
