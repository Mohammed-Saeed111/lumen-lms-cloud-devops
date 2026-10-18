/**
 * Admin user directory — `/admin/users`
 *
 * Layout:
 *   1. Toolbar  → search input (debounced, name + email), role chip filters
 *                 (All / Student / Instructor / Admin), active-state filter,
 *                 placeholder "Export CSV" button.
 *   2. Table    → avatar · name · email · role · active toggle · joined date
 *                 · actions dropdown (View · Change role · Disable/Enable ·
 *                 Delete).
 *   3. Pagination footer → current/total + windowed page numbers.
 *
 * Optimistic UI:
 *  - The active-state toggle flips immediately and rolls back on error so
 *    common moderation actions feel instant.
 *  - Role changes and deletions confirm via `ConfirmModal` (with the user's
 *    name baked into the description) and use the same optimistic-then-
 *    rollback pattern.
 *
 * Self-protection:
 *  - The current admin's row has the active toggle disabled and the action
 *    dropdown grayed out with a tooltip — the server enforces the same
 *    rule, but blocking it client-side avoids the round-trip + flash.
 *
 * Data:
 *  - Single endpoint: `admin.listUsers({ search, role, isActive, page })`.
 *    Search debounces 300ms before firing. Role + active filters reset page
 *    to 1 so the user never lands on an empty page from a filter change.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  ConfirmModal,
  Dropdown,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Modal,
  Pagination,
  RoleBadge,
  Select,
  Skeleton,
  Toggle,
  Tooltip,
  toast,
} from '../../components/ui/index.js';
import { useAuth } from '../../context/useAuth.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  deleteUser,
  listUsers,
  toggleUserActive,
  updateUserRole,
  updateUserWorkforce,
} from '../../services/admin.service.js';
import { ROLES, ROUTES } from '../../utils/constants.js';
import { formatDate } from '../../utils/formatDate.js';
import { cn } from '../../utils/cn.js';

const PAGE_LIMIT = 20;

const STANDARD_DEPARTMENTS = Object.freeze([
  'Assembly & Production',
  'Machining & CNC Operations',
  'Maintenance & Repairs (LOTO)',
  'Quality Control & Inspection',
  'Safety & EHS',
  'Logistics & Warehousing',
  'Packaging & Dispatch',
]);

const ROLE_FILTERS = Object.freeze([
  { id: 'all', label: 'All roles' },
  { id: ROLES.student, label: 'Workers' },
  { id: ROLES.instructor, label: 'Trainers / Supervisors' },
  { id: ROLES.admin, label: 'Factory Admins' },
]);

const ACTIVE_OPTIONS = Object.freeze([
  { value: 'all', label: 'Any status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Disabled' },
]);

const ROLE_OPTIONS = Object.freeze([
  { value: ROLES.student, label: 'Worker' },
  { value: ROLES.instructor, label: 'Trainer / Supervisor' },
  { value: ROLES.admin, label: 'Factory Admin' },
]);

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function RoleFilterChips({ value, onChange }) {
  return (
    <div role="tablist" aria-label="Filter by role" className="flex flex-wrap gap-2">
      {ROLE_FILTERS.map((filter) => {
        const active = value === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-bg text-text-muted hover:border-border-strong hover:text-text',
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-bg shadow-xs p-4">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton variant="circle" className="h-10 w-10" />
            <Skeleton variant="text" className="flex-1" />
            <Skeleton variant="text" className="w-24" />
            <Skeleton variant="text" className="w-16" />
            <Skeleton variant="text" className="w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTable({
  users,
  currentUserId,
  togglingId,
  onToggleActive,
  onChangeRole,
  onEditWorkforce,
  onDelete,
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-bg shadow-xs">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-bg-subtle">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Employee
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle whitespace-nowrap"
            >
              Employee ID
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Department & Role
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle whitespace-nowrap"
            >
              Joined
            </th>
            <th scope="col" className="px-4 py-3 pr-5 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => {
            const isSelf = currentUserId && user._id === currentUserId;
            const isToggling = togglingId === user._id;
            const actionItems = [
              {
                id: 'view',
                label: 'View profile',
                icon: 'ExternalLink',
                onSelect: () => {
                  window.location.assign(ROUTES.profile(user._id));
                },
              },
              {
                id: 'training',
                label: 'View employee record',
                icon: 'GraduationCap',
                onSelect: () => {
                  window.location.assign(ROUTES.adminEmployee(user._id));
                },
              },
              {
                id: 'workforce',
                label: 'Edit workforce profile',
                icon: 'Briefcase',
                onSelect: () => onEditWorkforce(user),
              },
              {
                id: 'role',
                label: 'Change role',
                icon: 'UserCog',
                disabled: isSelf,
                onSelect: () => onChangeRole(user),
              },
              {
                id: 'toggle',
                label: user.isActive ? 'Disable account' : 'Enable account',
                icon: user.isActive ? 'UserX' : 'UserCheck',
                disabled: isSelf,
                onSelect: () => onToggleActive(user, !user.isActive),
              },
              { id: 'sep', separator: true },
              {
                id: 'delete',
                label: 'Delete user',
                icon: 'Trash2',
                danger: true,
                disabled: isSelf,
                onSelect: () => onDelete(user),
              },
            ];

            return (
              <tr
                key={user._id}
                className={cn(
                  'transition-colors hover:bg-bg-subtle',
                  !user.isActive && 'opacity-70',
                )}
              >
                <td className="px-4 py-3 pl-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar size="md" src={user.avatar} name={user.name} />
                    <div className="min-w-0">
                      <Link
                        to={ROUTES.adminEmployee(user._id)}
                        className="block truncate font-medium text-text hover:text-primary max-w-[28ch]"
                      >
                        {user.name}
                        {isSelf && (
                          <Badge variant="info" size="sm" className="ml-2">
                            You
                          </Badge>
                        )}
                      </Link>
                      <p className="text-xs text-text-muted truncate max-w-[36ch]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {user.employeeId ? (
                    <Badge variant="neutral" size="sm" className="font-mono">
                      {user.employeeId}
                    </Badge>
                  ) : (
                    <span className="text-xs text-text-subtle">—</span>
                  )}
                </td>
                <td className="px-4 py-3 min-w-[180px]">
                  <div className="text-xs font-medium text-text">
                    {user.department || <span className="text-text-subtle italic">Unassigned</span>}
                  </div>
                  <div className="text-xs text-text-muted">
                    {user.jobTitle || <span className="text-text-subtle italic">No role title</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3">
                  {isSelf ? (
                    <Tooltip
                      content="You can't act on your own account here"
                      side="top"
                    >
                      <span className="inline-flex">
                        <Toggle
                          checked={user.isActive}
                          disabled
                          aria-label={`${user.name} active`}
                        />
                      </span>
                    </Tooltip>
                  ) : (
                    <Toggle
                      checked={user.isActive}
                      disabled={isToggling}
                      onChange={(next) => onToggleActive(user, next)}
                      aria-label={`Toggle account active for ${user.name}`}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-4 py-3 pr-5">
                  <div className="flex items-center justify-end">
                    {isSelf ? (
                      <Tooltip
                        content="You can't act on your own account here"
                        side="left"
                      >
                        <span>
                          <IconButton
                            variant="ghost"
                            disabled
                            aria-label={`Actions disabled for your own account`}
                          >
                            <Icon name="MoreHorizontal" size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : (
                      <Dropdown
                        align="end"
                        trigger={
                          <IconButton
                            variant="ghost"
                            aria-label={`Actions for ${user.name}`}
                          >
                            <Icon name="MoreHorizontal" size={16} />
                          </IconButton>
                        }
                        items={actionItems}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page shell                                                                */
/* -------------------------------------------------------------------------- */

export default function UsersPage() {
  useDocumentTitle('Users · Admin');

  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id ?? currentUser?.id;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [role, setRole] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const [roleModal, setRoleModal] = useState({
    open: false,
    user: null,
    nextRole: ROLES.student,
    loading: false,
  });
  const [workforceModal, setWorkforceModal] = useState({
    open: false,
    user: null,
    department: '',
    jobTitle: '',
    employeeId: '',
    loading: false,
  });
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    user: null,
    loading: false,
  });

  const fetchUsers = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await listUsers({
        search: debouncedSearch.trim() || undefined,
        role: role === 'all' ? undefined : role,
        department: departmentFilter === 'all' ? undefined : departmentFilter,
        isActive: activeFilter === 'all' ? undefined : activeFilter,
        sort: 'newest',
        page,
        limit: PAGE_LIMIT,
      });
      const payload = result?.data ?? {};
      setUsers(payload.items ?? []);
      setPageInfo({
        page: payload.page ?? 1,
        limit: payload.limit ?? PAGE_LIMIT,
        total: payload.total ?? 0,
        totalPages: payload.totalPages ?? 1,
      });
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Could not load users.',
      );
    }
  }, [debouncedSearch, role, departmentFilter, activeFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter changes should reset to page 1 so the user never lands on an
  // empty page after a filter narrows the result set.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, departmentFilter, activeFilter]);

  /* --------------------------- patch helpers ------------------------------ */

  const patchUser = useCallback((id, patch) => {
    setUsers((prev) =>
      prev.map((u) => (u._id === id ? { ...u, ...patch } : u)),
    );
  }, []);

  const removeUser = useCallback((id) => {
    setUsers((prev) => prev.filter((u) => u._id !== id));
    setPageInfo((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
    }));
  }, []);

  /* ------------------------------- actions -------------------------------- */

  const handleToggleActive = useCallback(
    async (user, nextValue) => {
      if (!user || togglingId) return;
      const previous = user.isActive;
      patchUser(user._id, { isActive: nextValue });
      setTogglingId(user._id);
      try {
        await toggleUserActive(user._id, nextValue);
        toast.success(
          nextValue
            ? `Re-enabled ${user.name}.`
            : `Disabled ${user.name}.`,
        );
      } catch (err) {
        patchUser(user._id, { isActive: previous });
        toast.error(
          err?.response?.data?.message ??
            'Could not update account status.',
        );
      } finally {
        setTogglingId(null);
      }
    },
    [patchUser, togglingId],
  );

  const handleOpenRole = useCallback((user) => {
    setRoleModal({
      open: true,
      user,
      nextRole: user.role,
      loading: false,
    });
  }, []);

  const handleOpenWorkforce = useCallback((user) => {
    setWorkforceModal({
      open: true,
      user,
      department: user.department || '',
      jobTitle: user.jobTitle || '',
      employeeId: user.employeeId || '',
      loading: false,
    });
  }, []);

  const handleConfirmRole = useCallback(async () => {
    const { user, nextRole } = roleModal;
    if (!user) return;
    if (user.role === nextRole) {
      setRoleModal((prev) => ({ ...prev, open: false }));
      return;
    }
    setRoleModal((prev) => ({ ...prev, loading: true }));
    try {
      const result = await updateUserRole(user._id, nextRole);
      const updated = result?.user ?? { ...user, role: nextRole };
      patchUser(user._id, updated);
      toast.success(`${user.name} is now a ${nextRole}.`);
      setRoleModal({ open: false, user: null, nextRole: ROLES.student, loading: false });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not change role.',
      );
      setRoleModal((prev) => ({ ...prev, loading: false }));
    }
  }, [patchUser, roleModal]);

  const handleConfirmWorkforce = useCallback(async () => {
    const { user, department, jobTitle, employeeId } = workforceModal;
    if (!user) return;
    setWorkforceModal((prev) => ({ ...prev, loading: true }));
    try {
      const result = await updateUserWorkforce(user._id, {
        department,
        jobTitle,
        employeeId,
      });
      const updated = result?.user ?? {
        ...user,
        department,
        jobTitle,
        employeeId,
      };
      patchUser(user._id, updated);
      toast.success(`Updated workforce profile for ${user.name}.`);
      setWorkforceModal({
        open: false,
        user: null,
        department: '',
        jobTitle: '',
        employeeId: '',
        loading: false,
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not update workforce profile.',
      );
      setWorkforceModal((prev) => ({ ...prev, loading: false }));
    }
  }, [patchUser, workforceModal]);

  const handleConfirmDelete = useCallback(async () => {
    const { user } = deleteModal;
    if (!user) return;
    setDeleteModal((prev) => ({ ...prev, loading: true }));
    try {
      await deleteUser(user._id);
      removeUser(user._id);
      toast.success(`Deleted ${user.name}.`);
      setDeleteModal({ open: false, user: null, loading: false });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ?? 'Could not delete user.',
      );
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  }, [deleteModal, removeUser]);

  const handleExportCsv = useCallback(() => {
    toast('CSV export coming soon — wire up server endpoint in v2.', {
      icon: 'ℹ️',
    });
  }, []);

  /* -------------------------------- render -------------------------------- */

  const isInitialLoading = status === 'loading' && users.length === 0;
  const headerCount = useMemo(() => {
    if (status === 'loading') return null;
    return pageInfo.total;
  }, [pageInfo.total, status]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">
            Workforce Directory
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {headerCount === null
              ? 'Loading directory…'
              : `${headerCount} factory ${headerCount === 1 ? 'employee' : 'employees'} total`}
          </p>
        </div>
        <Button
          variant="outline"
          leftIcon={<Icon name="Download" size={16} />}
          onClick={handleExportCsv}
        >
          Export CSV
        </Button>
      </header>

      {/* Toolbar ------------------------------------------------------------ */}
      <div className="rounded-2xl border border-border bg-bg-subtle p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <Input
              placeholder="Search by name, email, employee ID, or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon={<Icon name="Search" size={16} />}
              trailingIcon={
                search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="text-text-subtle hover:text-text"
                  >
                    <Icon name="X" size={14} />
                  </button>
                ) : null
              }
            />
          </div>
          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filter by department"
            className="w-56"
          >
            <option value="all">All Departments</option>
            {STANDARD_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </Select>
          <Select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            aria-label="Filter by account status"
            className="w-40"
          >
            {ACTIVE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <RoleFilterChips value={role} onChange={setRole} />
      </div>

      {/* Table -------------------------------------------------------------- */}
      {status === 'error' ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
          <div className="flex items-start gap-3">
            <Icon name="AlertTriangle" size={18} className="mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">We couldn&apos;t load the directory.</p>
              <p className="mt-1 text-text-muted">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              leftIcon={<Icon name="RefreshCcw" size={14} />}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : isInitialLoading ? (
        <UsersTableSkeleton />
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg shadow-xs">
          <EmptyState
            icon="UsersRound"
            title="No users match these filters"
            description="Try clearing the search or switching the role filter."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setRole('all');
                  setActiveFilter('all');
                }}
              >
                Reset filters
              </Button>
            }
          />
        </div>
      ) : (
        <UsersTable
          users={users}
          currentUserId={currentUserId}
          togglingId={togglingId}
          onToggleActive={handleToggleActive}
          onChangeRole={handleOpenRole}
          onEditWorkforce={handleOpenWorkforce}
          onDelete={(user) =>
            setDeleteModal({ open: true, user, loading: false })
          }
        />
      )}

      {/* Pagination -------------------------------------------------------- */}
      {pageInfo.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            Page {pageInfo.page} of {pageInfo.totalPages}
          </p>
          <Pagination
            page={pageInfo.page}
            pageCount={pageInfo.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Workforce profile modal ------------------------------------------ */}
      <Modal
        open={workforceModal.open}
        onClose={
          workforceModal.loading
            ? () => {}
            : () => setWorkforceModal((prev) => ({ ...prev, open: false }))
        }
        title={
          workforceModal.user
            ? `Workforce Profile — ${workforceModal.user.name}`
            : 'Workforce Profile'
        }
        description="Assign the factory department, job role, and employee ID for this worker."
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={workforceModal.loading}
              onClick={() =>
                setWorkforceModal((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmWorkforce}
              loading={workforceModal.loading}
            >
              Save Profile
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="workforce-emp-id" className="block text-xs font-semibold text-text mb-1">
              Employee ID
            </label>
            <Input
              id="workforce-emp-id"
              placeholder="e.g. EMP-1042"
              value={workforceModal.employeeId}
              onChange={(e) =>
                setWorkforceModal((prev) => ({
                  ...prev,
                  employeeId: e.target.value,
                }))
              }
            />
            <p className="mt-1 text-xs text-text-subtle">
              Factory identification or badge number.
            </p>
          </div>

          <div>
            <label htmlFor="workforce-dept-select" className="block text-xs font-semibold text-text mb-1">
              Factory Department
            </label>
            <Select
              id="workforce-dept-select"
              value={
                STANDARD_DEPARTMENTS.includes(workforceModal.department)
                  ? workforceModal.department
                  : workforceModal.department
                    ? 'custom'
                    : ''
              }
              onChange={(e) => {
                const val = e.target.value;
                setWorkforceModal((prev) => ({
                  ...prev,
                  department: val === 'custom' ? prev.department : val,
                }));
              }}
            >
              <option value="">Select a department…</option>
              {STANDARD_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
              <option value="custom">Other / Custom Department</option>
            </Select>
            {(!STANDARD_DEPARTMENTS.includes(workforceModal.department) &&
              workforceModal.department !== '') ||
            workforceModal.department === 'custom' ? (
              <Input
                aria-label="Custom department name"
                className="mt-2"
                placeholder="Enter custom department name…"
                value={
                  workforceModal.department === 'custom'
                    ? ''
                    : workforceModal.department
                }
                onChange={(e) =>
                  setWorkforceModal((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
              />
            ) : null}
          </div>

          <div>
            <label htmlFor="workforce-job-title" className="block text-xs font-semibold text-text mb-1">
              Job Title / Operational Role
            </label>
            <Input
              id="workforce-job-title"
              placeholder="e.g. Line Operator, CNC Machinist, Quality Inspector"
              value={workforceModal.jobTitle}
              onChange={(e) =>
                setWorkforceModal((prev) => ({
                  ...prev,
                  jobTitle: e.target.value,
                }))
              }
            />
            <p className="mt-1 text-xs text-text-subtle">
              Operational role determines mandatory competencies and training.
            </p>
          </div>
        </div>
      </Modal>

      {/* Change role modal ------------------------------------------------- */}
      <Modal
        open={roleModal.open}
        onClose={
          roleModal.loading
            ? () => {}
            : () => setRoleModal((prev) => ({ ...prev, open: false }))
        }
        title={roleModal.user ? `Change role for ${roleModal.user.name}` : 'Change role'}
        description="Roles control which areas of the app this user can access."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={roleModal.loading}
              onClick={() =>
                setRoleModal((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRole}
              loading={roleModal.loading}
              disabled={roleModal.user?.role === roleModal.nextRole}
            >
              Save role
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            value={roleModal.nextRole}
            onChange={(e) =>
              setRoleModal((prev) => ({ ...prev, nextRole: e.target.value }))
            }
            aria-label="Choose new role"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {roleModal.user?.role === ROLES.admin &&
            roleModal.nextRole !== ROLES.admin && (
              <p className="text-xs text-warning">
                Demoting an admin removes their access to the moderation
                console. The platform refuses to demote the last remaining
                admin.
              </p>
            )}
        </div>
      </Modal>

      {/* Delete user modal ------------------------------------------------- */}
      <ConfirmModal
        open={deleteModal.open}
        loading={deleteModal.loading}
        onClose={() =>
          deleteModal.loading
            ? null
            : setDeleteModal({ open: false, user: null, loading: false })
        }
        onConfirm={handleConfirmDelete}
        title={
          deleteModal.user
            ? `Delete ${deleteModal.user.name}?`
            : 'Delete user?'
        }
        description={
          deleteModal.user
            ? `This permanently deletes ${deleteModal.user.name} (${deleteModal.user.email}), their enrollments, quiz attempts, and any courses they own. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete user"
        danger
      />
    </div>
  );
}
