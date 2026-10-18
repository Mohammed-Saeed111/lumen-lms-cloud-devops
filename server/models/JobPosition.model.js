/**
 * JobPosition model — first-class job position document.
 *
 * Job positions define the roles within each department (e.g. "Line Operator",
 * "Maintenance Technician", "Quality Inspector"). They are separate from the
 * `User.role` field (which controls platform access level: worker/trainer/admin)
 * and represent operational job functions.
 *
 * Design decisions:
 *  - `code` is unique per department (compound index) to allow the same job
 *    code in different departments without conflict.
 *  - `departmentId` references the Department model. If null/unset, the
 *    position is cross-departmental (e.g. HSE Officer, Plant Manager).
 *  - `isActive = false` is soft-archive. The controller prevents hard delete
 *    when employees are assigned to the position.
 *  - `requiredCourseIds` stores an array of Course ObjectIds that employees
 *    in this position must complete. This drives the "mandatory training" view
 *    without duplicating the Course model.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const jobPositionSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, 'Job code is required'],
      trim: true,
      uppercase: true,
      maxlength: [30, 'Job code must be at most 30 characters'],
      match: [/^[A-Z0-9_-]+$/, 'Job code must contain only letters, numbers, hyphens, or underscores'],
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [100, 'Job title must be at most 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Description must be at most 1000 characters'],
    },
    // Optional department this position belongs to. Null = cross-departmental.
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Courses that employees in this position are required to complete.
    // These IDs are validated against the Course collection at mutation time.
    requiredCourseIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
      default: [],
    },
    // Audit trail.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// A position code must be unique within a department (or globally if null dept).
jobPositionSchema.index({ code: 1, departmentId: 1 }, { unique: true });
jobPositionSchema.index({ title: 1 });

export const JobPosition =
  mongoose.models.JobPosition || mongoose.model('JobPosition', jobPositionSchema);

export default JobPosition;
