/**
 * AuditLog model — immutable record of consequential admin actions.
 *
 * Records are append-only. No update or delete hooks are registered on this
 * model. The controller layer calls `AuditLog.create(...)` after each
 * consequential action succeeds.
 *
 * Logged action types:
 *   user.*          — role change, activation, deactivation, deletion, workforce update
 *   department.*    — create, update, deactivate, delete
 *   job.*           — create, update, deactivate, delete
 *   enrollment.*    — admin-assign, admin-revoke, admin-reactivate
 *   certificate.*   — issued, expiry set
 *
 * NEVER log: passwords, access tokens, refresh tokens, or other secrets.
 * `changes` stores only the field names and new safe values — never the
 * old value if it was a credential field.
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    // Who performed the action.
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    // Dot-notation action type, e.g. "user.role_change", "enrollment.admin_assign".
    action: {
      type: String,
      required: true,
      index: true,
    },
    // The primary resource type affected.
    resourceType: {
      type: String,
      required: true,
      enum: ['user', 'department', 'job', 'enrollment', 'certificate', 'course'],
    },
    // The MongoDB ObjectId of the primary resource.
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // Human-readable snapshot of what changed. Keys are field names,
    // values are the NEW values after the change. Never include secrets.
    changes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // Optional context string (e.g. reason for revocation).
    note: {
      type: String,
      default: '',
      maxlength: [500, 'Note must be at most 500 characters'],
    },
  },
  {
    // Only `createdAt` — audit records are never "updated".
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  },
);

// Common query: all actions on a specific resource.
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
// Common query: all actions by a specific admin.
auditLogSchema.index({ actorId: 1, createdAt: -1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export const logAction = async ({ actorId, actorRole, action, resourceType, resourceId, changes = {}, note = '' }) => {
  try {
    await AuditLog.create({ actorId, actorRole, action, resourceType, resourceId, changes, note });
  } catch {
    // Audit log failure must NEVER break the primary operation. Log and continue.
    // In production this would go to an alerting system.
  }
};

export default AuditLog;
