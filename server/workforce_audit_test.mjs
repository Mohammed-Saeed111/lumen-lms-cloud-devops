/**
 * Automated test suite for Workforce, Departments, Jobs, Training Records & Audit Trail
 * Run: node workforce_audit_test.mjs
 */

const BASE = 'http://localhost:5000/api';

const ADMIN_EMAIL = 'admin@lms.dev';
const ADMIN_PASS = 'Admin@123456';
const STUDENT_EMAIL = 'student@test.lms';
const STUDENT_PASS = 'Test@123456';

let passed = 0;
let failed = 0;

async function req(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data, ok: res.ok };
}

function assert(condition, name, details = '') {
  if (condition) {
    passed++;
    console.log(`✅ [PASS] ${name}`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${name}${details ? ' -> ' + details : ''}`);
  }
}

async function run() {
  console.log('--- OPERVANTA WORKFORCE & TRAINING RECORDS TEST SUITE ---');

  // 1. Auth check
  const adminLogin = await req('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
  assert(adminLogin.ok && adminLogin.data.token, 'Admin login succeeded');
  const adminToken = adminLogin.data.token;
  const adminUser = adminLogin.data.user;

  const studentLogin = await req('POST', '/auth/login', { body: { email: STUDENT_EMAIL, password: STUDENT_PASS } });
  assert(studentLogin.ok && studentLogin.data.token, 'Student login succeeded');
  const studentToken = studentLogin.data.token;
  const studentUser = studentLogin.data.user;

  // 2. Authorization check: Student cannot access workforce routes
  const studentForbidden = await req('GET', '/workforce/departments', { token: studentToken });
  assert(studentForbidden.status === 403, 'Student is forbidden from /workforce/departments (403)');

  // 3. Departments: List
  const deptList = await req('GET', '/workforce/departments', { token: adminToken });
  assert(deptList.ok && Array.isArray(deptList.data.data.items), 'Admin can list departments');

  // 4. Departments: Create test department
  const uniqueCode = `TEST_${Date.now().toString().slice(-4)}`;
  const createDept = await req('POST', '/workforce/departments', {
    token: adminToken,
    body: {
      code: uniqueCode,
      name: `Automated Test Dept ${uniqueCode}`,
      description: 'Temporary department created by automated test suite',
    },
  });
  assert(createDept.status === 201 && createDept.data.data._id, 'Created new department', JSON.stringify(createDept.data));
  const createdDeptId = createDept.data.data?._id;

  // 5. Duplicate department code check (Conflict 409)
  const dupDept = await req('POST', '/workforce/departments', {
    token: adminToken,
    body: {
      code: uniqueCode,
      name: 'Duplicate Code Department',
    },
  });
  assert(dupDept.status === 409, 'Duplicate department code rejected with 409 Conflict');

  // 6. Departments: Update
  const updateDept = await req('PATCH', `/workforce/departments/${createdDeptId}`, {
    token: adminToken,
    body: {
      description: 'Updated description for test department',
      isActive: true,
    },
  });
  assert(updateDept.ok && updateDept.data.data.description === 'Updated description for test department', 'Updated department details');

  // 7. Job Positions: Create test job position
  const jobCode = `JOB_${Date.now().toString().slice(-4)}`;
  const createJob = await req('POST', '/workforce/jobs', {
    token: adminToken,
    body: {
      code: jobCode,
      title: `Test Operator ${jobCode}`,
      departmentId: createdDeptId,
      description: 'Handles line operations in automated test',
    },
  });
  assert(createJob.status === 201 && createJob.data.data._id, 'Created new job position');
  const createdJobId = createJob.data.data?._id;

  // 8. Safety Check: Department with linked Job cannot be hard deleted
  const deleteBlockedDept = await req('DELETE', `/workforce/departments/${createdDeptId}`, { token: adminToken });
  assert(deleteBlockedDept.status === 409, 'Department with active job positions cannot be deleted (409 Conflict)');

  // 9. Job Positions: List
  const jobsList = await req('GET', `/workforce/jobs?departmentId=${createdDeptId}`, { token: adminToken });
  assert(jobsList.ok && jobsList.data.data.items.length === 1, 'Filter jobs by departmentId works');

  // 10. Update User Workforce Profile (with hireDate & audit logging)
  const employeeIdVal = `EMP-TEST-${Date.now().toString().slice(-4)}`;
  const updateWorkforce = await req('PATCH', `/admin/users/${studentUser._id}/workforce`, {
    token: adminToken,
    body: {
      department: `Automated Test Dept ${uniqueCode}`,
      jobTitle: `Test Operator ${jobCode}`,
      employeeId: employeeIdVal,
      hireDate: '2024-01-15T00:00:00.000Z',
    },
  });
  const updatedEmp = updateWorkforce.data.user || updateWorkforce.data.data;
  assert(updateWorkforce.ok && updatedEmp && updatedEmp.employeeId === employeeIdVal, 'Updated user workforce profile with hireDate');

  // 11. Safety Check: Duplicate employeeId rejected
  const dupEmp = await req('PATCH', `/admin/users/${adminUser._id}/workforce`, {
    token: adminToken,
    body: { employeeId: employeeIdVal },
  });
  assert(dupEmp.status === 409, 'Duplicate employeeId rejected with 409 Conflict');

  // 12. Employee Detail dossier
  const employeeDetail = await req('GET', `/workforce/employees/${studentUser._id}`, { token: adminToken });
  assert(
    employeeDetail.ok &&
    employeeDetail.data.data.employee.employeeId === employeeIdVal &&
    Array.isArray(employeeDetail.data.data.training.enrollments),
    'Employee dossier retrieved with safe user data and training history'
  );

  // 13. Training Assignment
  // Find a published course to test enrollment assignment
  const coursesRes = await req('GET', '/admin/courses?limit=1', { token: adminToken });
  const testCourse = coursesRes.data.data?.items?.[0];
  let assignedEnrollmentId = null;

  if (testCourse) {
    const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const assignRes = await req('POST', '/workforce/training/assign', {
      token: adminToken,
      body: {
        userId: studentUser._id,
        courseId: testCourse._id,
        isMandatory: true,
        certificateExpiresAt: expiryDate,
      },
    });
    assert(assignRes.status === 201 && assignRes.data.data.isMandatory === true, 'Admin successfully assigned mandatory training with certificate expiry');
    assignedEnrollmentId = assignRes.data.data?._id;

    // 14. Update Certificate Expiry
    const newExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
    const expiryRes = await req('PATCH', `/workforce/training/${assignedEnrollmentId}/expiry`, {
      token: adminToken,
      body: { certificateExpiresAt: newExpiry },
    });
    assert(expiryRes.ok && expiryRes.data.data.certificateExpiresAt === newExpiry, 'Successfully updated certificate expiry date');
  }

  // 15. Training Records List with filter
  const trainingList = await req('GET', `/workforce/training?userId=${studentUser._id}`, { token: adminToken });
  assert(trainingList.ok && trainingList.data.data.items.length >= 1, 'List training records filtered by userId');

  // 16. Audit Log Retrieval
  const auditRes = await req('GET', '/workforce/audit?limit=10', { token: adminToken });
  assert(auditRes.ok && auditRes.data.data.items.length >= 1, 'Audit log entries recorded and retrieved');

  // CLEANUP: Clean up test fixtures created during the run
  console.log('\n--- CLEANING UP TEST FIXTURES ---');

  // Reset student workforce fields
  await req('PATCH', `/admin/users/${studentUser._id}/workforce`, {
    token: adminToken,
    body: { department: '', jobTitle: '', employeeId: '' },
  });

  // Delete test job
  if (createdJobId) {
    const delJob = await req('DELETE', `/workforce/jobs/${createdJobId}`, { token: adminToken });
    assert(delJob.ok, 'Deleted test job position fixture');
  }

  // Delete test department
  if (createdDeptId) {
    const delDept = await req('DELETE', `/workforce/departments/${createdDeptId}`, { token: adminToken });
    assert(delDept.ok, 'Deleted test department fixture');
  }

  console.log(`\n========================================`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
