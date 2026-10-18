/**
 * Department model — first-class department document.
 *
 * Departments are used to group employees and training programs. Each
 * department has a human-readable code (e.g. "PROD"), a name, an optional
 * description, and an `isActive` flag for soft-deactivation.
 *
 * Design decisions:
 *  - `code` is unique (case-insensitive via pre-save normalisation) and
 *    serves as the stable key for cross-referencing from User.department
 *    during the backward-compatible migration period.
 *  - `isActive = false` is a soft archive — it prevents new assignments
 *    but never removes existing employee references.
 *  - The controller enforces "no employees assigned" before hard delete;
 *    deactivation is always allowed.
 *  - `createdBy` and `updatedBy` provide a minimal audit trail for
 *    consequential admin changes without a full event-sourcing setup.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const departmentSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, 'Department code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Department code must be at most 20 characters'],
      match: [/^[A-Z0-9_-]+$/, 'Department code must contain only letters, numbers, hyphens, or underscores'],
    },
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: [100, 'Department name must be at most 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Audit trail — who created / last modified this department record.
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

// Unique department codes (case-insensitive via pre-save uppercase normalisation).
departmentSchema.index({ code: 1 }, { unique: true });
// Full-text search by name for the admin list endpoint.
departmentSchema.index({ name: 1 });

export const Department =
  mongoose.models.Department || mongoose.model('Department', departmentSchema);

export default Department;
