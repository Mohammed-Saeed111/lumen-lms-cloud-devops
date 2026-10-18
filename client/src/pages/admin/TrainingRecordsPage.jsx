/**
 * Training Records & Compliance management page — `/admin/training`
 *
 * Provides factory-wide training compliance tracking:
 *   - Search & filtering by status (active, completed, in-progress, expiring, expired, revoked)
 *   - Filter by department
 *   - Admin-initiated training assignment with mandatory flag
 *   - Certificate expiry date management
 *   - Audit log drawer for full traceability
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Dropdown,
  EmptyState,
  FormField,
  Icon,
  IconButton,
  Input,
  Modal,
  Pagination,
  ProgressBar,
  Select,
  Skeleton,
  Toggle,
  Tooltip,
  toast,
} from '../../components/ui/index.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listCoursesAdmin, listUsers } from '../../services/admin.service.js';
import {
  adminAssignTraining,
  listAuditLog,
  listDepartments,
  listTrainingRecords,
  setTrainingExpiry,
} from '../../services/workforce.service.js';
import { ROUTES } from '../../utils/constants.js';

const PAGE_LIMIT = 20;

function TrainingSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg shadow-xs p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-44 rounded-md" />
          <Skeleton className="h-6 w-52 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function TrainingRecordsPage() {
  useDocumentTitle('Training Records · Opervanta Admin');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reference data for assignment
  const [usersList, setUsersList] = useState([]);
  const [coursesList, setCoursesList] = useState([]);

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignData, setAssignData] = useState({
    userId: '',
    courseId: '',
    isMandatory: false,
    certificateExpiresAt: '',
  });
  const [assignErrors, setAssignErrors] = useState({});
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Expiry modal
  const [expiryModalState, setExpiryModalState] = useState({
    open: false,
    record: null,
    expiryDate: '',
    submitting: false,
  });

  // Audit log drawer
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Load departments
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await listDepartments({ limit: 100, isActive: true });
        setDepartments(res?.data?.items ?? []);
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    }
    loadDepts();
  }, []);

  // Fetch training records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listTrainingRecords({
        search: debouncedSearch.trim() || undefined,
        department: departmentFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: PAGE_LIMIT,
      });
      const data = res?.data ?? {};
      setRecords(data.items ?? []);
      setPageInfo({
        page: data.page ?? 1,
        limit: data.limit ?? PAGE_LIMIT,
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load training records');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, departmentFilter, statusFilter, page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, statusFilter]);

  // Derived stats
  const stats = useMemo(() => {
    const total = pageInfo.total;
    const completed = records.filter((r) => r.completedAt).length;
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expiring = records.filter(
      (r) =>
        r.certificateExpiresAt &&
        new Date(r.certificateExpiresAt) > now &&
        new Date(r.certificateExpiresAt) - now <= thirtyDays
    ).length;
    const expired = records.filter(
      (r) => r.certificateExpiresAt && new Date(r.certificateExpiresAt) < now
    ).length;

    return { total, completed, expiring, expired };
  }, [pageInfo.total, records]);

  // Load users & courses for assignment
  const handleOpenAssignModal = async () => {
    setAssignData({
      userId: '',
      courseId: '',
      isMandatory: false,
      certificateExpiresAt: '',
    });
    setAssignErrors({});
    setAssignModalOpen(true);

    try {
      const [uRes, cRes] = await Promise.all([
        listUsers({ limit: 100, isActive: true }),
        listCoursesAdmin({ limit: 100, status: 'published' }),
      ]);
      setUsersList(uRes?.data?.items ?? []);
      setCoursesList(cRes?.data?.items ?? []);
    } catch (err) {
      console.error('Failed to load users/courses for assignment', err);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!assignData.userId) errors.userId = 'Please select an employee.';
    if (!assignData.courseId) errors.courseId = 'Please select a course.';
    setAssignErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setAssignSubmitting(true);
    try {
      await adminAssignTraining({
        userId: assignData.userId,
        courseId: assignData.courseId,
        isMandatory: assignData.isMandatory,
        certificateExpiresAt: assignData.certificateExpiresAt || undefined,
      });
      toast.success('Training assigned successfully');
      setAssignModalOpen(false);
      fetchRecords();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to assign training');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Expiry date modal
  const handleOpenExpiryModal = (record) => {
    const currentExpiry = record.certificateExpiresAt
      ? new Date(record.certificateExpiresAt).toISOString().split('T')[0]
      : '';
    setExpiryModalState({
      open: true,
      record,
      expiryDate: currentExpiry,
      submitting: false,
    });
  };

  const handleSaveExpiry = async (e) => {
    e.preventDefault();
    if (!expiryModalState.record) return;

    setExpiryModalState((prev) => ({ ...prev, submitting: true }));
    try {
      await setTrainingExpiry(
        expiryModalState.record._id,
        expiryModalState.expiryDate ? new Date(expiryModalState.expiryDate).toISOString() : null
      );
      toast.success('Certificate expiry updated');
      setExpiryModalState({ open: false, record: null, expiryDate: '', submitting: false });
      fetchRecords();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update certificate expiry');
      setExpiryModalState((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Audit logs drawer
  const handleOpenAudit = async () => {
    setAuditDrawerOpen(true);
    setAuditLoading(true);
    try {
      const res = await listAuditLog({ limit: 50 });
      setAuditLogs(res?.data?.items ?? []);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Training Records & Compliance</h1>
          <p className="text-sm text-text-muted mt-1">
            Monitor factory-wide safety certifications, course progress, and compliance deadlines.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleOpenAudit} icon="History" variant="outline">
            Audit Trail
          </Button>
          <Button onClick={handleOpenAssignModal} icon="Plus" variant="primary">
            Assign Training
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon name="GraduationCap" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Total Enrollments</p>
            <p className="text-2xl font-bold text-text">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10 text-success">
            <Icon name="Award" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Completed In View</p>
            <p className="text-2xl font-bold text-text">{stats.completed}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10 text-warning">
            <Icon name="AlertTriangle" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Expiring Soon (≤30d)</p>
            <p className="text-2xl font-bold text-text">{stats.expiring}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-error/10 text-error">
            <Icon name="Clock" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Expired Certs</p>
            <p className="text-2xl font-bold text-text">{stats.expired}</p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1 max-w-2xl">
          <div className="flex-1">
            <Input
              placeholder="Search by course title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon="Search"
              allowClear
              onClear={() => setSearch('')}
            />
          </div>
          <div className="w-full sm:w-52">
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap gap-1.5 self-start md:self-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
            { key: 'in-progress', label: 'In Progress' },
            { key: 'expiring', label: 'Expiring Soon' },
            { key: 'expired', label: 'Expired' },
            { key: 'revoked', label: 'Revoked' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === item.key
                  ? 'bg-primary text-primary-fg shadow-xs'
                  : 'bg-bg-subtle text-text-muted hover:text-text hover:bg-bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Records Table */}
      {loading ? (
        <TrainingSkeleton />
      ) : error ? (
        <Card className="p-6 text-center text-error border-error/20 bg-error/5">
          <Icon name="AlertCircle" size={32} className="mx-auto mb-2 text-error" />
          <p className="font-semibold">{error}</p>
          <Button onClick={fetchRecords} variant="outline" size="sm" className="mt-3">
            Retry
          </Button>
        </Card>
      ) : records.length === 0 ? (
        <EmptyState
          icon="GraduationCap"
          title="No training records found"
          description={search ? 'No records match your search criteria.' : 'Assign training courses to employees to track workforce compliance.'}
          action={
            <Button onClick={handleOpenAssignModal} icon="Plus" variant="primary">
              Assign Training
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-bg shadow-xs">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-bg-subtle">
              <tr>
                <th scope="col" className="px-4 py-3 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Employee
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Course
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Progress & Status
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Certificate Expiry
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle whitespace-nowrap">
                  Enrolled
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-subtle pr-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => {
                const user = r.userId || {};
                const course = r.courseId || {};
                const isRevoked = r.status === 'revoked';
                const isCompleted = !!r.completedAt;

                // Expiry calculation
                let expiryBadge = null;
                if (r.certificateExpiresAt) {
                  const now = new Date();
                  const expDate = new Date(r.certificateExpiresAt);
                  const isExpired = expDate < now;
                  const isExpiringSoon = !isExpired && expDate - now <= 30 * 24 * 60 * 60 * 1000;

                  if (isExpired) {
                    expiryBadge = (
                      <Badge variant="error" size="sm" className="font-medium">
                        Expired: {formatDate(r.certificateExpiresAt)}
                      </Badge>
                    );
                  } else if (isExpiringSoon) {
                    expiryBadge = (
                      <Badge variant="warning" size="sm" className="font-medium">
                        Expiring: {formatDate(r.certificateExpiresAt)}
                      </Badge>
                    );
                  } else {
                    expiryBadge = (
                      <span className="text-xs text-text-muted">
                        Expires: {formatDate(r.certificateExpiresAt)}
                      </span>
                    );
                  }
                } else {
                  expiryBadge = <span className="text-xs text-text-subtle italic">No expiry</span>;
                }

                const actionItems = [
                  {
                    id: 'viewEmployee',
                    label: 'View Employee Record',
                    icon: 'ExternalLink',
                    onSelect: () => {
                      if (user._id) window.location.assign(ROUTES.adminEmployee(user._id));
                    },
                  },
                  {
                    id: 'setExpiry',
                    label: 'Update Expiry Date',
                    icon: 'Calendar',
                    onSelect: () => handleOpenExpiryModal(r),
                  },
                ];

                return (
                  <tr
                    key={r._id}
                    className={`transition-colors hover:bg-bg-subtle ${isRevoked ? 'opacity-60 bg-bg-muted/30' : ''}`}
                  >
                    {/* Employee */}
                    <td className="px-4 py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" src={user.avatar} name={user.name || 'User'} />
                        <div className="min-w-0">
                          <Link
                            to={user._id ? ROUTES.adminEmployee(user._id) : '#'}
                            className="font-medium text-text hover:text-primary truncate block max-w-[200px]"
                          >
                            {user.name || 'Unknown'}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            {user.employeeId && (
                              <span className="font-mono font-medium text-primary">{user.employeeId}</span>
                            )}
                            {user.department && <span>· {user.department}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Course */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-text max-w-[240px] truncate">
                        {course.title || 'Untitled Course'}
                      </div>
                      <div className="text-xs text-text-subtle">
                        {course.category || 'General'}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.isMandatory ? (
                        <Badge variant="primary" size="sm" className="font-semibold">
                          Mandatory
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Elective
                        </Badge>
                      )}
                    </td>

                    {/* Progress & Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isRevoked ? (
                        <Badge variant="neutral" size="sm">
                          Revoked
                        </Badge>
                      ) : isCompleted ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="success" size="sm">
                            Completed
                          </Badge>
                          <span className="text-xs text-text-muted">{formatDate(r.completedAt)}</span>
                        </div>
                      ) : (
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-xs font-medium text-text-muted">
                            <span>In Progress</span>
                            <span>{r.progressPercentage || 0}%</span>
                          </div>
                          <ProgressBar value={r.progressPercentage || 0} size="sm" />
                        </div>
                      )}
                    </td>

                    {/* Certificate Expiry */}
                    <td className="px-4 py-3 whitespace-nowrap">{expiryBadge}</td>

                    {/* Enrolled date & assigner */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-text-muted">
                      <div>{formatDate(r.enrolledAt)}</div>
                      {r.assignedBy && (
                        <div className="text-text-subtle text-[11px]">
                          By Admin
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 pr-5 text-right whitespace-nowrap">
                      <Dropdown
                        align="end"
                        trigger={
                          <IconButton variant="ghost" aria-label="Training record actions">
                            <Icon name="MoreHorizontal" size={16} />
                          </IconButton>
                        }
                        items={actionItems}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pageInfo.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={pageInfo.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Assign Training Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => !assignSubmitting && setAssignModalOpen(false)}
        title="Assign Workforce Training"
        description="Enroll an employee in a course with compliance tracking and optional certification expiry."
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <FormField label="Select Employee" error={assignErrors.userId} required>
            <Select
              value={assignData.userId}
              onChange={(e) => setAssignData((prev) => ({ ...prev, userId: e.target.value }))}
            >
              <option value="">-- Choose Employee --</option>
              {usersList.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.employeeId ? `${u.employeeId} · ` : ''}{u.department || 'Unassigned'})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Select Course" error={assignErrors.courseId} required>
            <Select
              value={assignData.courseId}
              onChange={(e) => setAssignData((prev) => ({ ...prev, courseId: e.target.value }))}
            >
              <option value="">-- Choose Course --</option>
              {coursesList.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title} ({c.category || 'General'})
                </option>
              ))}
            </Select>
          </FormField>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg-subtle">
            <div>
              <p className="text-sm font-medium text-text">Mandatory Compliance Training</p>
              <p className="text-xs text-text-muted">Flag as required for employee job role & safety audits</p>
            </div>
            <Toggle
              checked={assignData.isMandatory}
              onChange={(next) => setAssignData((prev) => ({ ...prev, isMandatory: next }))}
            />
          </div>

          <FormField
            label="Certificate Expiry Date (Optional)"
            helperText="If specified, system alerts when certification validity expires (e.g. annual refresher)"
          >
            <Input
              type="date"
              value={assignData.certificateExpiresAt}
              onChange={(e) => setAssignData((prev) => ({ ...prev, certificateExpiresAt: e.target.value }))}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setAssignModalOpen(false)} disabled={assignSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={assignSubmitting}>
              Assign Training
            </Button>
          </div>
        </form>
      </Modal>

      {/* Set Expiry Modal */}
      <Modal
        open={expiryModalState.open}
        onClose={() => !expiryModalState.submitting && setExpiryModalState({ open: false, record: null, expiryDate: '', submitting: false })}
        title="Update Certificate Expiry"
        description={`Set or clear certification validity date for ${expiryModalState.record?.userId?.name || 'employee'}.`}
      >
        <form onSubmit={handleSaveExpiry} className="space-y-4">
          <FormField label="Expiration Date" helperText="Leave empty to remove certificate expiration">
            <Input
              type="date"
              value={expiryModalState.expiryDate}
              onChange={(e) => setExpiryModalState((prev) => ({ ...prev, expiryDate: e.target.value }))}
            />
          </FormField>

          <div className="flex justify-between items-center pt-4 border-t border-border">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setExpiryModalState((prev) => ({ ...prev, expiryDate: '' }))}
              disabled={expiryModalState.submitting}
            >
              Clear Expiry
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setExpiryModalState({ open: false, record: null, expiryDate: '', submitting: false })}
                disabled={expiryModalState.submitting}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={expiryModalState.submitting}>
                Save Expiry
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Audit Log Drawer */}
      <Drawer
        open={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        title="Workforce Audit Trail"
        side="right"
        size="lg"
      >
        <div className="p-4 space-y-4">
          <p className="text-xs text-text-muted">
            Append-only record of administrative actions, training assignments, and workforce profile changes.
          </p>

          {auditLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <EmptyState
              icon="History"
              title="No audit entries"
              description="Administrative actions will be logged here automatically."
            />
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log._id} className="p-3 rounded-xl border border-border bg-bg-subtle text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="primary" size="sm" className="font-mono">
                      {log.action}
                    </Badge>
                    <span className="text-text-subtle">{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="font-medium text-text">
                    By: {log.actorId?.name || 'Administrator'} ({log.actorRole})
                  </p>
                  {log.note && <p className="text-text-muted">{log.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
