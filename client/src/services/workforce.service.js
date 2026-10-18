/**
 * Workforce service — wraps `/api/workforce/*` endpoints.
 *
 * Every endpoint on the backend is gated by `protect + adminOnly + adminLimiter`.
 * All functions follow the same pattern as `admin.service.js`.
 */

import api from '../api/axios.js';

const DEFAULT_LIMIT = 20;

// ── Departments ──────────────────────────────────────────────────────────────

export const listDepartments = async ({ search, isActive, page = 1, limit = DEFAULT_LIMIT } = {}) => {
  const { data } = await api.get('/workforce/departments', {
    params: { search, isActive, page, limit },
  });
  return data;
};

export const getDepartmentById = async (id) => {
  const { data } = await api.get(`/workforce/departments/${id}`);
  return data;
};

export const createDepartment = async ({ code, name, description }) => {
  const { data } = await api.post('/workforce/departments', { code, name, description });
  return data;
};

export const updateDepartment = async (id, fields) => {
  const { data } = await api.patch(`/workforce/departments/${id}`, fields);
  return data;
};

export const deleteDepartment = async (id) => {
  const { data } = await api.delete(`/workforce/departments/${id}`);
  return data;
};

// ── Job Positions ────────────────────────────────────────────────────────────

export const listJobs = async ({ search, departmentId, isActive, page = 1, limit = DEFAULT_LIMIT } = {}) => {
  const { data } = await api.get('/workforce/jobs', {
    params: { search, departmentId, isActive, page, limit },
  });
  return data;
};

export const getJobById = async (id) => {
  const { data } = await api.get(`/workforce/jobs/${id}`);
  return data;
};

export const createJob = async (fields) => {
  const { data } = await api.post('/workforce/jobs', fields);
  return data;
};

export const updateJob = async (id, fields) => {
  const { data } = await api.patch(`/workforce/jobs/${id}`, fields);
  return data;
};

export const deleteJob = async (id) => {
  const { data } = await api.delete(`/workforce/jobs/${id}`);
  return data;
};

// ── Employee Detail ──────────────────────────────────────────────────────────

export const getEmployeeDetail = async (id) => {
  const { data } = await api.get(`/workforce/employees/${id}`);
  return data;
};

// ── Training Records ─────────────────────────────────────────────────────────

export const listTrainingRecords = async ({
  userId, courseId, department, status, search, page = 1, limit = DEFAULT_LIMIT,
} = {}) => {
  const { data } = await api.get('/workforce/training', {
    params: { userId, courseId, department, status, search, page, limit },
  });
  return data;
};

export const adminAssignTraining = async ({ userId, courseId, isMandatory, certificateExpiresAt }) => {
  const { data } = await api.post('/workforce/training/assign', {
    userId, courseId, isMandatory, certificateExpiresAt,
  });
  return data;
};

export const setTrainingExpiry = async (enrollmentId, certificateExpiresAt) => {
  const { data } = await api.patch(`/workforce/training/${enrollmentId}/expiry`, {
    certificateExpiresAt,
  });
  return data;
};

// ── Audit Log ────────────────────────────────────────────────────────────────

export const listAuditLog = async ({ resourceType, resourceId, actorId, page = 1, limit = 30 } = {}) => {
  const { data } = await api.get('/workforce/audit', {
    params: { resourceType, resourceId, actorId, page, limit },
  });
  return data;
};

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
