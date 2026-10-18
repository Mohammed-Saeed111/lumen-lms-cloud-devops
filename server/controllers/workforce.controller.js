/**
 * Workforce controller — departments, job positions, admin-managed
 * employee training records, and admin-initiated enrollments.
 *
 * Every handler here is mounted behind `protect + adminOnly + adminLimiter`
 * via `workforce.routes.js`. The controller adds business-rule guards on
 * top of that:
 *
 *  - Departments and positions cannot be hard-deleted while employees
 *    or other records still reference them (prefer deactivation).
 *  - Admin-initiated enrollment reuses the existing `Enrollment` model
 *    and the reactivation logic from `enrollment.controller.js` to avoid
 *    duplicating records.
 *  - Certificate expiry is opt-in per enrollment, never automatic.
 *  - Audit log records are written after every mutation succeeds.
 *
 * NEVER log passwords, tokens, or secrets.
 */

import mongoose from 'mongoose';

import { AuditLog, logAction } from '../models/AuditLog.model.js';
import { Course } from '../models/Course.model.js';
import { Department } from '../models/Department.model.js';
import { Enrollment } from '../models/Enrollment.model.js';
import { JobPosition } from '../models/JobPosition.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';

// ────────────────────────────────────────────────────────────────────────────
// Helper: build pagination tuple from query params
// ────────────────────────────────────────────────────────────────────────────
const paginate = (query, defaults = { page: 1, limit: 20, maxLimit: 100 }) => {
  const page = Math.max(1, parseInt(query.page, 10) || defaults.page);
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(query.limit, 10) || defaults.limit),
  );
  return { page, limit, skip: (page - 1) * limit };
};

// ════════════════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/workforce/departments
 * List all departments with optional search and isActive filter.
 */
export const listDepartments = asyncHandler(async (req, res) => {
  const { search, isActive } = req.query;
  const { page, limit, skip } = paginate(req.query);

  const filter = {};
  if (search?.trim()) {
    const re = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: re }, { code: re }];
  }
  if (isActive === 'true') filter.isActive = true;
  else if (isActive === 'false') filter.isActive = false;

  const [items, total] = await Promise.all([
    Department.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);

  // Augment each department with live employee count from User collection.
  const deptNames = items.map((d) => d.name);
  const counts = await User.aggregate([
    { $match: { department: { $in: deptNames } } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c.count]));

  const departments = items.map((d) => ({
    ...d,
    employeeCount: countMap.get(d.name) ?? 0,
  }));

  res.json({ success: true, data: { items: departments, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

/**
 * GET /api/workforce/departments/:id
 * Single department with employee + position counts.
 */
export const getDepartmentById = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id).lean();
  if (!dept) throw ApiError.notFound('Department not found.');

  const [employeeCount, positionCount] = await Promise.all([
    User.countDocuments({ department: dept.name }),
    JobPosition.countDocuments({ departmentId: dept._id }),
  ]);

  res.json({ success: true, data: { ...dept, employeeCount, positionCount } });
});

/**
 * POST /api/workforce/departments
 * Create a new department.
 */
export const createDepartment = asyncHandler(async (req, res) => {
  const { code, name, description } = req.body;

  const dept = await Department.create({
    code: code.trim().toUpperCase(),
    name: name.trim(),
    description: description?.trim() ?? '',
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await logAction({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'department.create',
    resourceType: 'department',
    resourceId: dept._id,
    changes: { code: dept.code, name: dept.name },
  });

  res.status(201).json({ success: true, data: dept });
});

/**
 * PATCH /api/workforce/departments/:id
 * Update a department's name, description, or isActive flag.
 * Code is immutable after creation to preserve employee string references.
 */
export const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound('Department not found.');

  const changes = {};
  if (req.body.name !== undefined) { dept.name = req.body.name.trim(); changes.name = dept.name; }
  if (req.body.description !== undefined) { dept.description = req.body.description.trim(); changes.description = dept.description; }
  if (typeof req.body.isActive === 'boolean') { dept.isActive = req.body.isActive; changes.isActive = dept.isActive; }
  dept.updatedBy = req.user._id;

  await dept.save();

  await logAction({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'department.update',
    resourceType: 'department',
    resourceId: dept._id,
    changes,
  });

  res.json({ success: true, data: dept });
});

/**
 * DELETE /api/workforce/departments/:id
 * Hard delete — only allowed when no employees reference this department
 * AND no job positions belong to it. Always prefer deactivation instead.
 */
export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound('Department not found.');

  const [employeeCount, positionCount] = await Promise.all([
    User.countDocuments({ department: dept.name }),
    JobPosition.countDocuments({ departmentId: dept._id }),
  ]);

  if (employeeCount > 0) {
    throw ApiError.conflict(
      `Cannot delete department "${dept.name}" — ${employeeCount} employee(s) still assigned. Reassign or deactivate instead.`,
    );
  }
  if (positionCount > 0) {
    throw ApiError.conflict(
      `Cannot delete department "${dept.name}" — ${positionCount} job position(s) still linked. Delete those positions first.`,
    );
  }

  await Department.deleteOne({ _id: dept._id });

  await logAction({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: 'department.delete',
    resourceType: 'department',
    resourceId: dept._id,
    changes: { code: dept.code, name: dept.name },
  });

  res.json({ success: true, message: `Department "${dept.name}" deleted.` });
});

// ════════════════════════════════════════════════════════════════════════════
// JOB POSITIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/workforce/jobs
 * List job positions with optional search, department, and isActive filter.
 */
export const listJobs = asyncHandler(async (req, res) => {
  const { search, departmentId, isActive } = req.query;
  const { page, limit, skip } = paginate(req.query);

  const filter = {};
  if (search?.trim()) {
    const re = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ title: re }, { code: re }];
  }
  if (departmentId && mongoose.isValidObjectId(departmentId)) filter.departmentId = departmentId;
  if (isActive === 'true') filter.isActive = true;
  else if (isActive === 'false') filter.isActive = false;

  const [items, total] = await Promise.all([
    JobPosition.find(filter)
      .sort({ title: 1 })
      .skip(skip)
      .limit(limit)
      .populate('departmentId', 'name code')
      .lean(),
    JobPosition.countDocuments(filter),
  ]);

  // Augment with employee count for each position.
  const positionTitles = items.map((j) => j.title);
  const counts = await User.aggregate([
    { $match: { jobTitle: { $in: positionTitles } } },
    { $group: { _id: '$jobTitle', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c.count]));
  const jobs = items.map((j) => ({ ...j, employeeCount: countMap.get(j.title) ?? 0 }));

  res.json({ success: true, data: { items: jobs, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

/**
 * GET /api/workforce/jobs/:id
 */
export const getJobById = asyncHandler(async (req, res) => {
  const job = await JobPosition.findById(req.params.id)
    .populate('departmentId', 'name code')
    .populate('requiredCourseIds', 'title slug category status')
    .lean();
  if (!job) throw ApiError.notFound('Job position not found.');

  const employeeCount = await User.countDocuments({ jobTitle: job.title });
  res.json({ success: true, data: { ...job, employeeCount } });
});

/**
 * POST /api/workforce/jobs
 */
export const createJob = asyncHandler(async (req, res) => {
  const { code, title, description, departmentId, requiredCourseIds } = req.body;

  // Validate departmentId if provided.
  if (departmentId) {
    if (!mongoose.isValidObjectId(departmentId)) throw ApiError.badRequest('Invalid department ID.');
    const deptExists = await Department.exists({ _id: departmentId });
    if (!deptExists) throw ApiError.badRequest('Referenced department does not exist.');
  }

  // Validate course IDs if provided.
  const courseIds = Array.isArray(requiredCourseIds) ? requiredCourseIds : [];
  if (courseIds.length > 0) {
    const found = await Course.countDocuments({ _id: { $in: courseIds } });
    if (found !== courseIds.length) throw ApiError.badRequest('One or more required course IDs are invalid.');
  }

  const job = await JobPosition.create({
    code: code.trim().toUpperCase(),
    title: title.trim(),
    description: description?.trim() ?? '',
    departmentId: departmentId || null,
    requiredCourseIds: courseIds,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await logAction({
    actorId: req.user._id, actorRole: req.user.role,
    action: 'job.create', resourceType: 'job', resourceId: job._id,
    changes: { code: job.code, title: job.title },
  });

  res.status(201).json({ success: true, data: job });
});

/**
 * PATCH /api/workforce/jobs/:id
 */
export const updateJob = asyncHandler(async (req, res) => {
  const job = await JobPosition.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job position not found.');

  const changes = {};
  if (req.body.title !== undefined) { job.title = req.body.title.trim(); changes.title = job.title; }
  if (req.body.description !== undefined) { job.description = req.body.description.trim(); changes.description = job.description; }
  if (typeof req.body.isActive === 'boolean') { job.isActive = req.body.isActive; changes.isActive = job.isActive; }

  if (req.body.departmentId !== undefined) {
    const dId = req.body.departmentId;
    if (dId && !mongoose.isValidObjectId(dId)) throw ApiError.badRequest('Invalid department ID.');
    if (dId) {
      const deptExists = await Department.exists({ _id: dId });
      if (!deptExists) throw ApiError.badRequest('Referenced department does not exist.');
    }
    job.departmentId = dId || null;
    changes.departmentId = dId || null;
  }

  if (Array.isArray(req.body.requiredCourseIds)) {
    const courseIds = req.body.requiredCourseIds;
    if (courseIds.length > 0) {
      const found = await Course.countDocuments({ _id: { $in: courseIds } });
      if (found !== courseIds.length) throw ApiError.badRequest('One or more required course IDs are invalid.');
    }
    job.requiredCourseIds = courseIds;
    changes.requiredCourseIds = courseIds;
  }

  job.updatedBy = req.user._id;
  await job.save();

  await logAction({
    actorId: req.user._id, actorRole: req.user.role,
    action: 'job.update', resourceType: 'job', resourceId: job._id, changes,
  });

  res.json({ success: true, data: job });
});

/**
 * DELETE /api/workforce/jobs/:id
 * Allowed only when no employees hold this job title.
 */
export const deleteJob = asyncHandler(async (req, res) => {
  const job = await JobPosition.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job position not found.');

  const employeeCount = await User.countDocuments({ jobTitle: job.title });
  if (employeeCount > 0) {
    throw ApiError.conflict(
      `Cannot delete position "${job.title}" — ${employeeCount} employee(s) still assigned. Reassign or deactivate instead.`,
    );
  }

  await JobPosition.deleteOne({ _id: job._id });

  await logAction({
    actorId: req.user._id, actorRole: req.user.role,
    action: 'job.delete', resourceType: 'job', resourceId: job._id,
    changes: { code: job.code, title: job.title },
  });

  res.json({ success: true, message: `Position "${job.title}" deleted.` });
});

// ════════════════════════════════════════════════════════════════════════════
// EMPLOYEE DETAILS
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/workforce/employees/:id
 * Full employee profile including training history, quiz results, and
 * certificate status. Admins only.
 */
export const getEmployeeDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid employee ID.');

  const user = await User.findById(id).lean();
  if (!user) throw ApiError.notFound('Employee not found.');

  // Remove sensitive fields.
  const { password, emailVerificationToken, passwordResetToken,
    tokenVersion, failedLoginAttempts, lockUntil, twoFactorSecret, ...safeUser } = user;

  // Load training records with course details.
  const enrollments = await Enrollment.find({ userId: id })
    .populate('courseId', 'title slug category level status')
    .sort({ enrolledAt: -1 })
    .lean();

  // Load quiz attempts for training history.
  const quizAttempts = await QuizAttempt.find({ userId: id })
    .populate('quizId', 'title passingScore')
    .populate('courseId', 'title')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Audit trail for this employee.
  const auditLog = await AuditLog.find({ resourceType: 'user', resourceId: id })
    .populate('actorId', 'name email')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json({
    success: true,
    data: {
      employee: safeUser,
      training: { enrollments, quizAttempts },
      auditLog,
    },
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN TRAINING RECORDS (enrollment management)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/workforce/training
 * Paginated training records with filters: userId, courseId, department,
 * status (active/revoked/completed/overdue/expiring).
 */
export const listTrainingRecords = asyncHandler(async (req, res) => {
  const { userId, courseId, department, status, search } = req.query;
  const { page, limit, skip } = paginate(req.query, { page: 1, limit: 25, maxLimit: 100 });

  // Build the enrollment filter.
  const enrollFilter = {};
  if (userId && mongoose.isValidObjectId(userId)) enrollFilter.userId = userId;
  if (courseId && mongoose.isValidObjectId(courseId)) enrollFilter.courseId = courseId;

  // Map UI status to Mongo query.
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (status === 'active') enrollFilter.status = 'active';
  else if (status === 'revoked') enrollFilter.status = 'revoked';
  else if (status === 'completed') { enrollFilter.status = 'active'; enrollFilter.completedAt = { $ne: null }; }
  else if (status === 'in-progress') { enrollFilter.status = 'active'; enrollFilter.completedAt = null; }
  else if (status === 'expiring') {
    enrollFilter.status = 'active';
    enrollFilter.certificateExpiresAt = { $gt: now, $lte: thirtyDaysLater };
  }
  else if (status === 'expired') {
    enrollFilter.status = 'active';
    enrollFilter.certificateExpiresAt = { $lt: now };
  }

  // If filtering by department, first get user IDs in that department.
  if (department?.trim()) {
    const deptUsers = await User.find({ department: department.trim() }, '_id').lean();
    const userIds = deptUsers.map((u) => u._id);
    enrollFilter.userId = { $in: userIds };
  }

  // If search term, match against course title.
  let courseFilter = {};
  if (search?.trim()) {
    const re = new RegExp(escapeRegex(search.trim()), 'i');
    const matchedCourses = await Course.find({ title: re }, '_id').lean();
    courseFilter = { courseId: { $in: matchedCourses.map((c) => c._id) } };
  }

  const combinedFilter = { ...enrollFilter, ...courseFilter };

  const [items, total] = await Promise.all([
    Enrollment.find(combinedFilter)
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email employeeId department jobTitle avatar')
      .populate('courseId', 'title slug category level status')
      .populate('assignedBy', 'name email')
      .lean(),
    Enrollment.countDocuments(combinedFilter),
  ]);

  res.json({ success: true, data: { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

/**
 * POST /api/workforce/training/assign
 * Admin-initiated enrollment. Reactivates revoked enrollment if one exists.
 * Body: { userId, courseId, isMandatory, certificateExpiresAt }
 */
export const adminAssignTraining = asyncHandler(async (req, res) => {
  const { userId, courseId, isMandatory = false, certificateExpiresAt } = req.body;

  if (!mongoose.isValidObjectId(userId)) throw ApiError.badRequest('Invalid userId.');
  if (!mongoose.isValidObjectId(courseId)) throw ApiError.badRequest('Invalid courseId.');

  const [targetUser, course] = await Promise.all([
    User.findById(userId),
    Course.findById(courseId, 'title enrollmentCount status'),
  ]);
  if (!targetUser) throw ApiError.notFound('Employee not found.');
  if (!course) throw ApiError.notFound('Course not found.');

  // Check for existing enrollment.
  const existing = await Enrollment.findOne({ userId, courseId });

  let enrollment;
  if (existing) {
    if (existing.status === 'active') {
      // Already active — update mandatory flag and expiry if provided, idempotent.
      existing.isMandatory = isMandatory;
      if (certificateExpiresAt) existing.certificateExpiresAt = new Date(certificateExpiresAt);
      existing.assignedBy = req.user._id;
      existing.assignedAt = new Date();
      await existing.save();
      enrollment = existing;
    } else {
      // Revoked → reactivate (mirrors enrollment.controller.js logic).
      existing.status = 'active';
      existing.revokedAt = null;
      existing.revokedBy = null;
      existing.isMandatory = isMandatory;
      existing.assignedBy = req.user._id;
      existing.assignedAt = new Date();
      if (certificateExpiresAt) existing.certificateExpiresAt = new Date(certificateExpiresAt);
      await existing.save();
      await Course.updateOne({ _id: courseId }, { $inc: { enrollmentCount: 1 } });
      enrollment = existing;
    }
  } else {
    // New enrollment.
    enrollment = await Enrollment.create({
      userId,
      courseId,
      isMandatory,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      certificateExpiresAt: certificateExpiresAt ? new Date(certificateExpiresAt) : null,
    });
  }

  await logAction({
    actorId: req.user._id, actorRole: req.user.role,
    action: 'enrollment.admin_assign', resourceType: 'enrollment', resourceId: enrollment._id,
    changes: { userId, courseId, isMandatory },
    note: `Admin enrolled ${targetUser.name} in "${course.title}"`,
  });

  res.status(201).json({ success: true, data: enrollment });
});

/**
 * PATCH /api/workforce/training/:enrollmentId/expiry
 * Set or update the certificate expiry date on an existing enrollment.
 * Body: { certificateExpiresAt: ISO string | null }
 */
export const setTrainingExpiry = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.enrollmentId)
    .populate('userId', 'name')
    .populate('courseId', 'title');
  if (!enrollment) throw ApiError.notFound('Enrollment not found.');

  const expiry = req.body.certificateExpiresAt;
  enrollment.certificateExpiresAt = expiry ? new Date(expiry) : null;
  await enrollment.save();

  await logAction({
    actorId: req.user._id, actorRole: req.user.role,
    action: 'certificate.expiry_set', resourceType: 'enrollment', resourceId: enrollment._id,
    changes: { certificateExpiresAt: expiry ?? null },
  });

  res.json({ success: true, data: enrollment });
});

/**
 * GET /api/workforce/audit
 * Admin audit log — paginated, filterable by resourceType and resourceId.
 */
export const listAuditLog = asyncHandler(async (req, res) => {
  const { resourceType, resourceId, actorId } = req.query;
  const { page, limit, skip } = paginate(req.query, { page: 1, limit: 30, maxLimit: 100 });

  const filter = {};
  if (resourceType) filter.resourceType = resourceType;
  if (resourceId && mongoose.isValidObjectId(resourceId)) filter.resourceId = resourceId;
  if (actorId && mongoose.isValidObjectId(actorId)) filter.actorId = actorId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actorId', 'name email role')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ success: true, data: { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

export default {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getEmployeeDetail,
  listTrainingRecords,
  adminAssignTraining,
  setTrainingExpiry,
  listAuditLog,
};
