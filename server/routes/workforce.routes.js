/**
 * `/api/workforce` route group — industrial workforce management.
 *
 * Every endpoint here is gated by THREE layers:
 *   1. `protect`       — JWT must verify, account must be active.
 *   2. `adminOnly`     — `req.user.role === 'admin'`.
 *   3. `adminLimiter`  — 100 requests / 10 minutes per admin user.
 *
 * Routes:
 *   Departments:
 *     GET    /departments              paginated, searchable
 *     GET    /departments/:id          single department with counts
 *     POST   /departments              create
 *     PATCH  /departments/:id          update name/description/isActive
 *     DELETE /departments/:id          hard delete (guarded)
 *
 *   Job Positions:
 *     GET    /jobs                     paginated, searchable
 *     GET    /jobs/:id                 single position with required courses
 *     POST   /jobs                     create
 *     PATCH  /jobs/:id                 update
 *     DELETE /jobs/:id                 hard delete (guarded)
 *
 *   Employee detail:
 *     GET    /employees/:id            full profile + training history
 *
 *   Training Records:
 *     GET    /training                 paginated, filterable enrollment list
 *     POST   /training/assign          admin-initiated enrollment
 *     PATCH  /training/:enrollmentId/expiry  set/clear certificate expiry
 *
 *   Audit log:
 *     GET    /audit                    paginated audit log
 */

import { Router } from 'express';

import {
  adminAssignTraining,
  createDepartment,
  createJob,
  deleteDepartment,
  deleteJob,
  getDepartmentById,
  getEmployeeDetail,
  getJobById,
  listAuditLog,
  listDepartments,
  listJobs,
  listTrainingRecords,
  setTrainingExpiry,
  updateDepartment,
  updateJob,
} from '../controllers/workforce.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminLimiter } from '../middleware/rateLimit.middleware.js';
import { adminOnly } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  assignTrainingValidator,
  createDepartmentValidator,
  createJobValidator,
  departmentIdParamValidator,
  employeeIdParamValidator,
  enrollmentIdParamValidator,
  jobIdParamValidator,
  listAuditValidator,
  listDepartmentsValidator,
  listJobsValidator,
  listTrainingValidator,
  setExpiryValidator,
  updateDepartmentValidator,
  updateJobValidator,
} from '../validators/workforce.validator.js';

const router = Router();

router.use(protect, adminOnly, adminLimiter);

// Departments
router.get('/departments', validate(listDepartmentsValidator), listDepartments);
router.get('/departments/:id', validate(departmentIdParamValidator), getDepartmentById);
router.post('/departments', validate(createDepartmentValidator), createDepartment);
router.patch('/departments/:id', validate(updateDepartmentValidator), updateDepartment);
router.delete('/departments/:id', validate(departmentIdParamValidator), deleteDepartment);

// Job Positions
router.get('/jobs', validate(listJobsValidator), listJobs);
router.get('/jobs/:id', validate(jobIdParamValidator), getJobById);
router.post('/jobs', validate(createJobValidator), createJob);
router.patch('/jobs/:id', validate(updateJobValidator), updateJob);
router.delete('/jobs/:id', validate(jobIdParamValidator), deleteJob);

// Employee detail
router.get('/employees/:id', validate(employeeIdParamValidator), getEmployeeDetail);

// Training records — static path before dynamic :enrollmentId
router.post('/training/assign', validate(assignTrainingValidator), adminAssignTraining);
router.get('/training', validate(listTrainingValidator), listTrainingRecords);
router.patch('/training/:enrollmentId/expiry', validate(setExpiryValidator), setTrainingExpiry);

// Audit log
router.get('/audit', validate(listAuditValidator), listAuditLog);

export default router;
