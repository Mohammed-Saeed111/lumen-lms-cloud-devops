/**
 * Job Positions management page — `/admin/jobs`
 *
 * Manages industrial roles, positions, and position-based mandatory training requirements:
 *   - Search by title or code
 *   - Department filtering
 *   - Linking required courses for role-based training programs
 *   - Employee count tracking per position
 *   - Full create, edit, deactivate, and delete capabilities
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmModal,
  Dropdown,
  EmptyState,
  FormField,
  Icon,
  IconButton,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Textarea,
  Toggle,
  Tooltip,
  toast,
} from '../../components/ui/index.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listCoursesAdmin } from '../../services/admin.service.js';
import {
  createJob,
  deleteJob,
  listDepartments,
  listJobs,
  updateJob,
} from '../../services/workforce.service.js';
import { ROUTES } from '../../utils/constants.js';

const PAGE_LIMIT = 15;

function JobsSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg shadow-xs p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-6 w-32 rounded-md" />
          <Skeleton className="h-6 flex-1 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export default function JobsPage() {
  useDocumentTitle('Job Positions · Opervanta Admin');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalState, setEditModalState] = useState({ open: false, job: null });
  const [deleteModalState, setDeleteModalState] = useState({ open: false, job: null, loading: false });

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    departmentId: '',
    description: '',
    requiredCourseIds: [],
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch reference data (departments & courses for selectors)
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [deptRes, courseRes] = await Promise.all([
          listDepartments({ limit: 100, isActive: true }),
          listCoursesAdmin({ limit: 100, status: 'published' }),
        ]);
        setDepartments(deptRes?.data?.items ?? []);
        setCourses(courseRes?.data?.items ?? []);
      } catch (err) {
        // Non-blocking for page load
        console.error('Failed to load reference data for jobs', err);
      }
    }
    loadReferenceData();
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listJobs({
        search: debouncedSearch.trim() || undefined,
        departmentId: departmentFilter === 'all' ? undefined : departmentFilter,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        page,
        limit: PAGE_LIMIT,
      });
      const data = res?.data ?? {};
      setJobs(data.items ?? []);
      setPageInfo({
        page: data.page ?? 1,
        limit: data.limit ?? PAGE_LIMIT,
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load job positions');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, departmentFilter, activeFilter, page]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, activeFilter]);

  // Derived stats
  const stats = useMemo(() => {
    const total = pageInfo.total;
    const active = jobs.filter((j) => j.isActive).length;
    const totalAssignedEmployees = jobs.reduce((acc, j) => acc + (j.employeeCount || 0), 0);
    return { total, active, totalAssignedEmployees };
  }, [pageInfo.total, jobs]);

  // Form validation
  const validateForm = () => {
    const errors = {};
    if (!formData.code.trim()) errors.code = 'Job code is required (e.g. OP-LINE, TECH-01).';
    else if (formData.code.trim().length > 20) errors.code = 'Code cannot exceed 20 characters.';
    if (!formData.title.trim()) errors.title = 'Job title is required.';
    else if (formData.title.trim().length > 100) errors.title = 'Title cannot exceed 100 characters.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create
  const handleOpenCreate = () => {
    setFormData({
      code: '',
      title: '',
      departmentId: '',
      description: '',
      requiredCourseIds: [],
      isActive: true,
    });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await createJob({
        code: formData.code.trim().toUpperCase(),
        title: formData.title.trim(),
        departmentId: formData.departmentId || null,
        description: formData.description.trim(),
        requiredCourseIds: formData.requiredCourseIds,
      });
      toast.success(`Job position "${formData.title.trim()}" created successfully`);
      setCreateModalOpen(false);
      fetchJobs();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create job position';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit
  const handleOpenEdit = (job) => {
    const reqIds = Array.isArray(job.requiredCourseIds)
      ? job.requiredCourseIds.map((c) => (typeof c === 'object' ? c._id : c))
      : [];

    setFormData({
      code: job.code,
      title: job.title,
      departmentId: job.departmentId?._id || job.departmentId || '',
      description: job.description || '',
      requiredCourseIds: reqIds,
      isActive: job.isActive,
    });
    setFormErrors({});
    setEditModalState({ open: true, job });
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await updateJob(editModalState.job._id, {
        code: formData.code.trim().toUpperCase(),
        title: formData.title.trim(),
        departmentId: formData.departmentId || null,
        description: formData.description.trim(),
        requiredCourseIds: formData.requiredCourseIds,
        isActive: formData.isActive,
      });
      toast.success(`Job position updated successfully`);
      setEditModalState({ open: false, job: null });
      fetchJobs();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update job position';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick toggle active
  const handleToggleActive = async (job, nextActive) => {
    try {
      setJobs((prev) =>
        prev.map((j) => (j._id === job._id ? { ...j, isActive: nextActive } : j))
      );
      await updateJob(job._id, { isActive: nextActive });
      toast.success(`Position "${job.title}" is now ${nextActive ? 'active' : 'inactive'}`);
    } catch (err) {
      setJobs((prev) =>
        prev.map((j) => (j._id === job._id ? { ...j, isActive: !nextActive } : j))
      );
      toast.error(err?.response?.data?.message || 'Could not update status');
    }
  };

  // Delete
  const handleDeleteConfirm = async () => {
    if (!deleteModalState.job) return;
    setDeleteModalState((prev) => ({ ...prev, loading: true }));
    try {
      await deleteJob(deleteModalState.job._id);
      toast.success(`Job position "${deleteModalState.job.title}" deleted`);
      setDeleteModalState({ open: false, job: null, loading: false });
      fetchJobs();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete job position';
      toast.error(msg);
      setDeleteModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  const toggleCourseSelection = (courseId) => {
    setFormData((prev) => {
      const exists = prev.requiredCourseIds.includes(courseId);
      return {
        ...prev,
        requiredCourseIds: exists
          ? prev.requiredCourseIds.filter((id) => id !== courseId)
          : [...prev.requiredCourseIds, courseId],
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Job Positions</h1>
          <p className="text-sm text-text-muted mt-1">
            Standardize industrial roles, link required safety & compliance courses, and audit workforce coverage.
          </p>
        </div>
        <Button onClick={handleOpenCreate} icon="Plus" variant="primary">
          Add Position
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon name="Briefcase" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Total Positions</p>
            <p className="text-2xl font-bold text-text">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10 text-success">
            <Icon name="CheckCircle2" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Active In View</p>
            <p className="text-2xl font-bold text-text">{stats.active}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-info/10 text-info">
            <Icon name="Users" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Assigned Personnel</p>
            <p className="text-2xl font-bold text-text">{stats.totalAssignedEmployees}</p>
          </div>
        </Card>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1 max-w-2xl">
          <div className="flex-1">
            <Input
              placeholder="Search by code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon="Search"
              allowClear
              onClear={() => setSearch('')}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {['all', 'active', 'inactive'].map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setActiveFilter(filterKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === filterKey
                  ? 'bg-primary text-primary-fg shadow-xs'
                  : 'bg-bg-subtle text-text-muted hover:text-text hover:bg-bg-muted'
              }`}
            >
              {filterKey === 'all' ? 'All' : filterKey === 'active' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <JobsSkeleton />
      ) : error ? (
        <Card className="p-6 text-center text-error border-error/20 bg-error/5">
          <Icon name="AlertCircle" size={32} className="mx-auto mb-2 text-error" />
          <p className="font-semibold">{error}</p>
          <Button onClick={fetchJobs} variant="outline" size="sm" className="mt-3">
            Retry
          </Button>
        </Card>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="Briefcase"
          title="No job positions found"
          description={search ? 'No positions match your search criteria.' : 'Create position definitions to associate workforce training requirements.'}
          action={
            !search && (
              <Button onClick={handleOpenCreate} icon="Plus" variant="primary">
                Add Position
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-bg shadow-xs">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-bg-subtle">
              <tr>
                <th scope="col" className="px-4 py-3 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Code
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Position Title
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Department
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Required Training
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle whitespace-nowrap">
                  Personnel
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-subtle pr-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => {
                const reqCount = Array.isArray(job.requiredCourseIds) ? job.requiredCourseIds.length : 0;
                const deptName = job.departmentId?.name || 'Unassigned';
                const deptCode = job.departmentId?.code;

                const actionItems = [
                  {
                    id: 'edit',
                    label: 'Edit position',
                    icon: 'Edit3',
                    onSelect: () => handleOpenEdit(job),
                  },
                  {
                    id: 'toggle',
                    label: job.isActive ? 'Deactivate' : 'Activate',
                    icon: job.isActive ? 'XCircle' : 'CheckCircle2',
                    onSelect: () => handleToggleActive(job, !job.isActive),
                  },
                  {
                    id: 'viewEmployees',
                    label: 'View Employees',
                    icon: 'Users',
                    onSelect: () => {
                      window.location.assign(`${ROUTES.adminUsers}?search=${encodeURIComponent(job.title)}`);
                    },
                  },
                  { id: 'sep', separator: true },
                  {
                    id: 'delete',
                    label: 'Delete position',
                    icon: 'Trash2',
                    danger: true,
                    onSelect: () => setDeleteModalState({ open: true, job, loading: false }),
                  },
                ];

                return (
                  <tr key={job._id} className="transition-colors hover:bg-bg-subtle">
                    <td className="px-4 py-3 pl-5 whitespace-nowrap">
                      <Badge variant="neutral" size="sm" className="font-mono tracking-wider font-semibold">
                        {job.code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{job.title}</div>
                      {job.description && (
                        <div className="text-xs text-text-muted line-clamp-1 max-w-[260px]">
                          {job.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {job.departmentId ? (
                        <Badge variant="info" size="sm">
                          {deptCode ? `${deptName} (${deptCode})` : deptName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-subtle italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {reqCount > 0 ? (
                        <Badge variant="primary" size="sm" className="gap-1">
                          <Icon name="GraduationCap" size={13} />
                          <span>{reqCount} mandatory course{reqCount > 1 ? 's' : ''}</span>
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-subtle italic">No required courses</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium text-text">
                        {job.employeeCount || 0} active
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Toggle
                        checked={job.isActive}
                        onChange={(next) => handleToggleActive(job, next)}
                        aria-label={`Toggle ${job.title} active status`}
                      />
                    </td>
                    <td className="px-4 py-3 pr-5 text-right whitespace-nowrap">
                      <Dropdown
                        align="end"
                        trigger={
                          <IconButton variant="ghost" aria-label={`Actions for ${job.title}`}>
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

      {/* Create Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => !submitting && setCreateModalOpen(false)}
        title="Add Job Position"
        description="Create a standardized operational role and select its mandatory training courses."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Position Code" error={formErrors.code} required helperText="e.g. OP-LINE, TECH-01">
              <Input
                value={formData.code}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. TECH-01"
                maxLength={20}
                autoFocus
              />
            </FormField>

            <FormField label="Department" helperText="Assign to operational unit">
              <Select
                value={formData.departmentId}
                onChange={(e) => setFormData((prev) => ({ ...prev, departmentId: e.target.value }))}
              >
                <option value="">-- No Department --</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Position Title" error={formErrors.title} required>
            <Input
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Senior Maintenance Technician"
              maxLength={100}
            />
          </FormField>

          <FormField label="Job Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Responsibilities, safety requirements, and equipment handled."
              rows={2}
            />
          </FormField>

          {/* Mandatory courses selector */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Mandatory Training Courses
            </label>
            <p className="text-xs text-text-muted mb-2">
              Employees assigned to this position will have these courses tracked for compliance.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-3 space-y-2 bg-bg-subtle">
              {courses.length === 0 ? (
                <p className="text-xs text-text-subtle italic">No published courses available.</p>
              ) : (
                courses.map((course) => {
                  const isChecked = formData.requiredCourseIds.includes(course._id);
                  return (
                    <label
                      key={course._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCourseSelection(course._id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="font-medium text-text flex-1">{course.title}</span>
                      {course.category && (
                        <Badge variant="neutral" size="sm">
                          {course.category}
                        </Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setCreateModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Position
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editModalState.open}
        onClose={() => !submitting && setEditModalState({ open: false, job: null })}
        title={`Edit ${editModalState.job?.title || 'Job Position'}`}
        description="Update role details, department assignment, and mandatory curriculum."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Position Code" error={formErrors.code} required>
              <Input
                value={formData.code}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. TECH-01"
                maxLength={20}
              />
            </FormField>

            <FormField label="Department">
              <Select
                value={formData.departmentId}
                onChange={(e) => setFormData((prev) => ({ ...prev, departmentId: e.target.value }))}
              >
                <option value="">-- No Department --</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Position Title" error={formErrors.title} required>
            <Input
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Senior Maintenance Technician"
              maxLength={100}
            />
          </FormField>

          <FormField label="Job Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </FormField>

          {/* Mandatory courses selector */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Mandatory Training Courses
            </label>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-3 space-y-2 bg-bg-subtle">
              {courses.length === 0 ? (
                <p className="text-xs text-text-subtle italic">No published courses available.</p>
              ) : (
                courses.map((course) => {
                  const isChecked = formData.requiredCourseIds.includes(course._id);
                  return (
                    <label
                      key={course._id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCourseSelection(course._id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="font-medium text-text flex-1">{course.title}</span>
                      {course.category && (
                        <Badge variant="neutral" size="sm">
                          {course.category}
                        </Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg-subtle">
            <div>
              <p className="text-sm font-medium text-text">Position Active</p>
              <p className="text-xs text-text-muted">Inactive positions cannot be assigned to new personnel</p>
            </div>
            <Toggle
              checked={formData.isActive}
              onChange={(next) => setFormData((prev) => ({ ...prev, isActive: next }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setEditModalState({ open: false, job: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={deleteModalState.open}
        onClose={() => !deleteModalState.loading && setDeleteModalState({ open: false, job: null, loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Delete Job Position"
        description={
          deleteModalState.job?.employeeCount > 0
            ? `Warning: "${deleteModalState.job?.title}" has ${deleteModalState.job?.employeeCount} active personnel. Deactivate the position or reassign employees before deletion.`
            : `Are you sure you want to delete "${deleteModalState.job?.title}"? This action cannot be undone.`
        }
        confirmText="Delete Position"
        danger
        loading={deleteModalState.loading}
      />
    </div>
  );
}
