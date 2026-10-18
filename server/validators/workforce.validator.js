/**
 * Validators for the `/api/workforce` route group.
 *
 * All routes here sit behind `protect + adminOnly`, so validators
 * only enforce request shape — business rules live in the controller.
 */

import { body, param, query } from 'express-validator';

import { mongoIdParam } from './course.validator.js';

const searchChain = () =>
  query('search').optional().isString().trim().isLength({ max: 100 })
    .withMessage('Search must be at most 100 characters.');

const pageChain = () =>
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.');

const limitChain = () =>
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.');

const isActiveQueryChain = () =>
  query('isActive').optional().isIn(['true', 'false']).withMessage('isActive must be "true" or "false".');

// ── Department validators ────────────────────────────────────────────────────

export const listDepartmentsValidator = [searchChain(), isActiveQueryChain(), pageChain(), limitChain()];
export const departmentIdParamValidator = [mongoIdParam('id')];

export const createDepartmentValidator = [
  body('code')
    .exists({ checkNull: true }).withMessage('Department code is required.')
    .bail().isString().trim().toUpperCase()
    .isLength({ min: 1, max: 20 }).withMessage('Code must be 1–20 characters.')
    .matches(/^[A-Z0-9_-]+$/).withMessage('Code must contain only letters, numbers, hyphens, or underscores.'),
  body('name')
    .exists({ checkNull: true }).withMessage('Department name is required.')
    .bail().isString().trim().isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2–100 characters.'),
  body('description').optional().isString().trim().isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters.'),
];

export const updateDepartmentValidator = [
  mongoIdParam('id'),
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2–100 characters.'),
  body('description').optional().isString().trim().isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
];

// ── Job position validators ──────────────────────────────────────────────────

export const listJobsValidator = [
  searchChain(), isActiveQueryChain(), pageChain(), limitChain(),
  query('departmentId').optional().isMongoId().withMessage('departmentId must be a valid MongoDB ID.'),
];
export const jobIdParamValidator = [mongoIdParam('id')];

export const createJobValidator = [
  body('code')
    .exists({ checkNull: true }).withMessage('Job code is required.')
    .bail().isString().trim().toUpperCase()
    .isLength({ min: 1, max: 30 }).withMessage('Code must be 1–30 characters.')
    .matches(/^[A-Z0-9_-]+$/).withMessage('Code must contain only letters, numbers, hyphens, or underscores.'),
  body('title')
    .exists({ checkNull: true }).withMessage('Job title is required.')
    .bail().isString().trim().isLength({ min: 2, max: 100 })
    .withMessage('Title must be 2–100 characters.'),
  body('description').optional().isString().trim().isLength({ max: 1000 })
    .withMessage('Description must be at most 1000 characters.'),
  body('departmentId').optional({ nullable: true }).isMongoId()
    .withMessage('departmentId must be a valid MongoDB ID.'),
  body('requiredCourseIds').optional().isArray().withMessage('requiredCourseIds must be an array.')
    .bail().custom((arr) => arr.every((id) => /^[a-f\d]{24}$/i.test(id)))
    .withMessage('Each requiredCourseId must be a valid MongoDB ID.'),
];

export const updateJobValidator = [
  mongoIdParam('id'),
  body('title').optional().isString().trim().isLength({ min: 2, max: 100 })
    .withMessage('Title must be 2–100 characters.'),
  body('description').optional().isString().trim().isLength({ max: 1000 })
    .withMessage('Description must be at most 1000 characters.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
  body('departmentId').optional({ nullable: true }).isMongoId()
    .withMessage('departmentId must be a valid MongoDB ID.'),
  body('requiredCourseIds').optional().isArray().withMessage('requiredCourseIds must be an array.')
    .bail().custom((arr) => arr.every((id) => /^[a-f\d]{24}$/i.test(id)))
    .withMessage('Each requiredCourseId must be a valid MongoDB ID.'),
];

// ── Training record validators ───────────────────────────────────────────────

export const listTrainingValidator = [
  query('userId').optional().isMongoId().withMessage('userId must be a valid MongoDB ID.'),
  query('courseId').optional().isMongoId().withMessage('courseId must be a valid MongoDB ID.'),
  query('department').optional().isString().trim().isLength({ max: 100 }),
  query('status').optional().isIn(['active', 'revoked', 'completed', 'in-progress', 'expiring', 'expired'])
    .withMessage('Invalid status filter.'),
  searchChain(), pageChain(), limitChain(),
];

export const assignTrainingValidator = [
  body('userId').isMongoId().withMessage('userId must be a valid MongoDB ID.'),
  body('courseId').isMongoId().withMessage('courseId must be a valid MongoDB ID.'),
  body('isMandatory').optional().isBoolean().withMessage('isMandatory must be a boolean.'),
  body('certificateExpiresAt').optional({ nullable: true }).isISO8601()
    .withMessage('certificateExpiresAt must be a valid ISO 8601 date.'),
];

export const setExpiryValidator = [
  mongoIdParam('enrollmentId'),
  body('certificateExpiresAt').optional({ nullable: true }).isISO8601()
    .withMessage('certificateExpiresAt must be a valid ISO 8601 date.'),
];

// ── Audit log validators ─────────────────────────────────────────────────────

export const listAuditValidator = [
  query('resourceType').optional().isIn(['user', 'department', 'job', 'enrollment', 'certificate', 'course'])
    .withMessage('Invalid resourceType.'),
  query('resourceId').optional().isMongoId().withMessage('resourceId must be a valid MongoDB ID.'),
  query('actorId').optional().isMongoId().withMessage('actorId must be a valid MongoDB ID.'),
  pageChain(), limitChain(),
];

export const employeeIdParamValidator = [mongoIdParam('id')];
export const enrollmentIdParamValidator = [mongoIdParam('enrollmentId')];
