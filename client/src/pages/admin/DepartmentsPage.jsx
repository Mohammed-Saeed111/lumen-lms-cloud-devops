/**
 * Departments management page — `/admin/departments`
 *
 * Provides full lifecycle management for enterprise departments:
 *   - Search by name or code
 *   - Active / Inactive status filtering
 *   - Live employee counts per department
 *   - Creation, updating, active toggling, and safe deletion
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Dropdown,
  EmptyState,
  FormField,
  Icon,
  IconButton,
  Input,
  Modal,
  Pagination,
  Skeleton,
  Stat,
  Textarea,
  Toggle,
  Tooltip,
  toast,
} from '../../components/ui/index.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from '../../services/workforce.service.js';
import { ROUTES } from '../../utils/constants.js';

const PAGE_LIMIT = 15;

function DepartmentsSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg shadow-xs p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 flex-1 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export default function DepartmentsPage() {
  useDocumentTitle('Departments · Opervanta Admin');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [departments, setDepartments] = useState([]);
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
  const [editModalState, setEditModalState] = useState({ open: false, dept: null });
  const [deleteModalState, setDeleteModalState] = useState({ open: false, dept: null, loading: false });

  // Form states
  const [formData, setFormData] = useState({ code: '', name: '', description: '', isActive: true });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDepartments({
        search: debouncedSearch.trim() || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        page,
        limit: PAGE_LIMIT,
      });
      const data = res?.data ?? {};
      setDepartments(data.items ?? []);
      setPageInfo({
        page: data.page ?? 1,
        limit: data.limit ?? PAGE_LIMIT,
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeFilter, page]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeFilter]);

  // Derived stats
  const stats = useMemo(() => {
    const total = pageInfo.total;
    const active = departments.filter((d) => d.isActive).length;
    const totalAssignedEmployees = departments.reduce((acc, d) => acc + (d.employeeCount || 0), 0);
    return { total, active, totalAssignedEmployees };
  }, [pageInfo.total, departments]);

  // Form validation
  const validateForm = () => {
    const errors = {};
    if (!formData.code.trim()) errors.code = 'Department code is required (e.g. PROD, QA).';
    else if (formData.code.trim().length > 20) errors.code = 'Code cannot exceed 20 characters.';
    if (!formData.name.trim()) errors.name = 'Department name is required.';
    else if (formData.name.trim().length > 100) errors.name = 'Name cannot exceed 100 characters.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Create
  const handleOpenCreate = () => {
    setFormData({ code: '', name: '', description: '', isActive: true });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await createDepartment({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
      toast.success(`Department "${formData.name.trim()}" created successfully`);
      setCreateModalOpen(false);
      fetchDepartments();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create department';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit
  const handleOpenEdit = (dept) => {
    setFormData({
      code: dept.code,
      name: dept.name,
      description: dept.description || '',
      isActive: dept.isActive,
    });
    setFormErrors({});
    setEditModalState({ open: true, dept });
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await updateDepartment(editModalState.dept._id, {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        isActive: formData.isActive,
      });
      toast.success(`Department updated successfully`);
      setEditModalState({ open: false, dept: null });
      fetchDepartments();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update department';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick toggle active
  const handleToggleActive = async (dept, nextActive) => {
    try {
      // Optimistic update
      setDepartments((prev) =>
        prev.map((d) => (d._id === dept._id ? { ...d, isActive: nextActive } : d))
      );
      await updateDepartment(dept._id, { isActive: nextActive });
      toast.success(`Department ${dept.name} is now ${nextActive ? 'active' : 'inactive'}`);
    } catch (err) {
      // Rollback
      setDepartments((prev) =>
        prev.map((d) => (d._id === dept._id ? { ...d, isActive: !nextActive } : d))
      );
      toast.error(err?.response?.data?.message || 'Could not update status');
    }
  };

  // Delete
  const handleDeleteConfirm = async () => {
    if (!deleteModalState.dept) return;
    setDeleteModalState((prev) => ({ ...prev, loading: true }));
    try {
      await deleteDepartment(deleteModalState.dept._id);
      toast.success(`Department "${deleteModalState.dept.name}" deleted`);
      setDeleteModalState({ open: false, dept: null, loading: false });
      fetchDepartments();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete department';
      toast.error(msg);
      setDeleteModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Departments</h1>
          <p className="text-sm text-text-muted mt-1">
            Organize factory operations, production lines, and workforce groups.
          </p>
        </div>
        <Button onClick={handleOpenCreate} icon="Plus" variant="primary">
          Add Department
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon name="Building2" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Total Departments</p>
            <p className="text-2xl font-bold text-text">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10 text-success">
            <Icon name="CheckCircle2" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Active In Page</p>
            <p className="text-2xl font-bold text-text">{stats.active}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-info/10 text-info">
            <Icon name="Users" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Assigned Employees</p>
            <p className="text-2xl font-bold text-text">{stats.totalAssignedEmployees}</p>
          </div>
        </Card>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon="Search"
            allowClear
            onClear={() => setSearch('')}
          />
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
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
        <DepartmentsSkeleton />
      ) : error ? (
        <Card className="p-6 text-center text-error border-error/20 bg-error/5">
          <Icon name="AlertCircle" size={32} className="mx-auto mb-2 text-error" />
          <p className="font-semibold">{error}</p>
          <Button onClick={fetchDepartments} variant="outline" size="sm" className="mt-3">
            Retry
          </Button>
        </Card>
      ) : departments.length === 0 ? (
        <EmptyState
          icon="Building2"
          title="No departments found"
          description={search ? 'No departments match your search criteria.' : 'Create your first department to start structuring your workforce.'}
          action={
            !search && (
              <Button onClick={handleOpenCreate} icon="Plus" variant="primary">
                Add Department
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
                  Department Name
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                  Description
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle whitespace-nowrap">
                  Employees
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
              {departments.map((dept) => {
                const actionItems = [
                  {
                    id: 'edit',
                    label: 'Edit details',
                    icon: 'Edit3',
                    onSelect: () => handleOpenEdit(dept),
                  },
                  {
                    id: 'toggle',
                    label: dept.isActive ? 'Deactivate' : 'Activate',
                    icon: dept.isActive ? 'XCircle' : 'CheckCircle2',
                    onSelect: () => handleToggleActive(dept, !dept.isActive),
                  },
                  {
                    id: 'viewEmployees',
                    label: 'View Employees',
                    icon: 'Users',
                    onSelect: () => {
                      window.location.assign(`${ROUTES.adminUsers}?department=${encodeURIComponent(dept.name)}`);
                    },
                  },
                  { id: 'sep', separator: true },
                  {
                    id: 'delete',
                    label: 'Delete department',
                    icon: 'Trash2',
                    danger: true,
                    onSelect: () => setDeleteModalState({ open: true, dept, loading: false }),
                  },
                ];

                return (
                  <tr key={dept._id} className="transition-colors hover:bg-bg-subtle">
                    <td className="px-4 py-3 pl-5 whitespace-nowrap">
                      <Badge variant="primary" size="sm" className="font-mono tracking-wider">
                        {dept.code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-text">
                      {dept.name}
                    </td>
                    <td className="px-4 py-3 text-text-muted max-w-[280px] truncate">
                      {dept.description || <span className="text-text-subtle italic">No description</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        to={`${ROUTES.adminUsers}?department=${encodeURIComponent(dept.name)}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Icon name="Users" size={14} />
                        <span>{dept.employeeCount || 0} employees</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Toggle
                        checked={dept.isActive}
                        onChange={(next) => handleToggleActive(dept, next)}
                        aria-label={`Toggle ${dept.name} active status`}
                      />
                    </td>
                    <td className="px-4 py-3 pr-5 text-right whitespace-nowrap">
                      <Dropdown
                        align="end"
                        trigger={
                          <IconButton variant="ghost" aria-label={`Actions for ${dept.name}`}>
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
        title="Add Department"
        description="Define a new organizational or operational department for your factory."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <FormField label="Department Code" error={formErrors.code} required helperText="Short uppercase identifier (e.g. PROD, MAINT, LOG, QA)">
            <Input
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. PROD"
              maxLength={20}
              autoFocus
            />
          </FormField>

          <FormField label="Department Name" error={formErrors.name} required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Production Operations"
              maxLength={100}
            />
          </FormField>

          <FormField label="Description" helperText="Operational scope, location, or responsibilities">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Oversees assembly lines 1 through 4 and material handling."
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setCreateModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editModalState.open}
        onClose={() => !submitting && setEditModalState({ open: false, dept: null })}
        title={`Edit ${editModalState.dept?.name || 'Department'}`}
        description="Update department code, title, description, or activation status."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <FormField label="Department Code" error={formErrors.code} required>
            <Input
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. PROD"
              maxLength={20}
            />
          </FormField>

          <FormField label="Department Name" error={formErrors.name} required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Production Operations"
              maxLength={100}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </FormField>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg-subtle">
            <div>
              <p className="text-sm font-medium text-text">Department Active</p>
              <p className="text-xs text-text-muted">Inactive departments cannot have new employees assigned</p>
            </div>
            <Toggle
              checked={formData.isActive}
              onChange={(next) => setFormData((prev) => ({ ...prev, isActive: next }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setEditModalState({ open: false, dept: null })} disabled={submitting}>
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
        onClose={() => !deleteModalState.loading && setDeleteModalState({ open: false, dept: null, loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Delete Department"
        description={
          deleteModalState.dept?.employeeCount > 0
            ? `Warning: "${deleteModalState.dept?.name}" currently has ${deleteModalState.dept?.employeeCount} assigned employee(s). The server requires reassigning or deactivating employees before deletion.`
            : `Are you sure you want to delete the department "${deleteModalState.dept?.name}"? This action cannot be undone.`
        }
        confirmText="Delete Department"
        danger
        loading={deleteModalState.loading}
      />
    </div>
  );
}
