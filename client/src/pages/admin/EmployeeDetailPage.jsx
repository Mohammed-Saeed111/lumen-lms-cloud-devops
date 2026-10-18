/**
 * Employee Detail & Training Dossier — `/admin/employees/:id`
 *
 * Comprehensive employee profile for industrial compliance audits:
 *   - Identity & organizational placement (department, position, employeeId, hire date)
 *   - Training compliance overview & certificate status
 *   - Detailed quiz history and assessment records
 *   - Historical audit log of modifications
 *   - Direct actions: assign training, edit workforce details, update certificate expiry
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Icon,
  IconButton,
  Input,
  Modal,
  ProgressBar,
  RoleBadge,
  Select,
  Skeleton,
  Tabs,
  Toggle,
  Tooltip,
  toast,
} from '../../components/ui/index.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { listCoursesAdmin, updateUserWorkforce } from '../../services/admin.service.js';
import {
  adminAssignTraining,
  getEmployeeDetail,
  listDepartments,
  listJobs,
  setTrainingExpiry,
} from '../../services/workforce.service.js';
import { ROUTES } from '../../utils/constants.js';

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

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);

  // Reference data
  const [departments, setDepartments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [courses, setCourses] = useState([]);

  // Modals
  const [editWorkforceOpen, setEditWorkforceOpen] = useState(false);
  const [workforceForm, setWorkforceForm] = useState({
    department: '',
    jobTitle: '',
    employeeId: '',
    hireDate: '',
  });
  const [workforceSubmitting, setWorkforceSubmitting] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    courseId: '',
    isMandatory: true,
    certificateExpiresAt: '',
  });
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [expiryModal, setExpiryModal] = useState({
    open: false,
    enrollment: null,
    date: '',
    submitting: false,
  });

  useDocumentTitle(
    employeeData?.employee?.name
      ? `${employeeData.employee.name} · Training Record`
      : 'Employee Training Record'
  );

  // Load employee profile
  const fetchEmployee = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEmployeeDetail(id);
      setEmployeeData(res?.data ?? null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load employee details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  // Load reference departments, jobs, courses
  useEffect(() => {
    async function loadRefs() {
      try {
        const [dRes, jRes, cRes] = await Promise.all([
          listDepartments({ limit: 100, isActive: true }),
          listJobs({ limit: 100, isActive: true }),
          listCoursesAdmin({ limit: 100, status: 'published' }),
        ]);
        setDepartments(dRes?.data?.items ?? []);
        setJobs(jRes?.data?.items ?? []);
        setCourses(cRes?.data?.items ?? []);
      } catch (err) {
        console.error('Failed to load references', err);
      }
    }
    loadRefs();
  }, []);

  const employee = employeeData?.employee;
  const enrollments = employeeData?.training?.enrollments ?? [];
  const quizAttempts = employeeData?.training?.quizAttempts ?? [];
  const auditLogs = employeeData?.auditLog ?? [];

  // Summary statistics
  const metrics = useMemo(() => {
    const totalEnrollments = enrollments.length;
    const completed = enrollments.filter((e) => e.completedAt).length;
    const mandatory = enrollments.filter((e) => e.isMandatory).length;
    const mandatoryCompleted = enrollments.filter((e) => e.isMandatory && e.completedAt).length;
    const passCount = quizAttempts.filter((q) => q.isPassed).length;
    const passRate = quizAttempts.length > 0 ? Math.round((passCount / quizAttempts.length) * 100) : 0;

    return { totalEnrollments, completed, mandatory, mandatoryCompleted, passRate, totalAttempts: quizAttempts.length };
  }, [enrollments, quizAttempts]);

  // Open Edit Workforce
  const handleOpenEditWorkforce = () => {
    setWorkforceForm({
      department: employee?.department || '',
      jobTitle: employee?.jobTitle || '',
      employeeId: employee?.employeeId || '',
      hireDate: employee?.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
    });
    setEditWorkforceOpen(true);
  };

  const handleSaveWorkforce = async (e) => {
    e.preventDefault();
    setWorkforceSubmitting(true);
    try {
      await updateUserWorkforce(id, {
        department: workforceForm.department.trim(),
        jobTitle: workforceForm.jobTitle.trim(),
        employeeId: workforceForm.employeeId.trim(),
        hireDate: workforceForm.hireDate ? new Date(workforceForm.hireDate).toISOString() : null,
      });
      toast.success('Workforce profile updated successfully');
      setEditWorkforceOpen(false);
      fetchEmployee();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update workforce profile');
    } finally {
      setWorkforceSubmitting(false);
    }
  };

  // Open Assign Training
  const handleOpenAssign = () => {
    setAssignForm({
      courseId: '',
      isMandatory: true,
      certificateExpiresAt: '',
    });
    setAssignModalOpen(true);
  };

  const handleSaveAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.courseId) {
      toast.error('Please select a course.');
      return;
    }
    setAssignSubmitting(true);
    try {
      await adminAssignTraining({
        userId: id,
        courseId: assignForm.courseId,
        isMandatory: assignForm.isMandatory,
        certificateExpiresAt: assignForm.certificateExpiresAt || undefined,
      });
      toast.success('Training assigned successfully');
      setAssignModalOpen(false);
      fetchEmployee();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to assign training');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Set Expiry
  const handleOpenExpiry = (enrollment) => {
    setExpiryModal({
      open: true,
      enrollment,
      date: enrollment.certificateExpiresAt ? new Date(enrollment.certificateExpiresAt).toISOString().split('T')[0] : '',
      submitting: false,
    });
  };

  const handleSaveExpiry = async (e) => {
    e.preventDefault();
    if (!expiryModal.enrollment) return;
    setExpiryModal((prev) => ({ ...prev, submitting: true }));
    try {
      await setTrainingExpiry(
        expiryModal.enrollment._id,
        expiryModal.date ? new Date(expiryModal.date).toISOString() : null
      );
      toast.success('Certificate expiration updated');
      setExpiryModal({ open: false, enrollment: null, date: '', submitting: false });
      fetchEmployee();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update expiration');
      setExpiryModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <Card className="p-8 text-center text-error border-error/20 bg-error/5 max-w-lg mx-auto">
        <Icon name="AlertCircle" size={40} className="mx-auto mb-3 text-error" />
        <h2 className="text-lg font-bold">Could not load employee dossier</h2>
        <p className="text-sm mt-1">{error || 'Employee not found.'}</p>
        <div className="flex justify-center gap-3 mt-4">
          <Button onClick={() => navigate(ROUTES.adminUsers)} variant="outline">
            Back to Users
          </Button>
          <Button onClick={fetchEmployee} variant="primary">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link to={ROUTES.adminUsers} className="hover:text-text transition-colors">
          Users & Employees
        </Link>
        <Icon name="ChevronRight" size={14} />
        <span className="text-text font-medium">{employee.name}</span>
      </div>

      {/* Header Profile Card */}
      <Card className="p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar size="xl" src={employee.avatar} name={employee.name} />
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-text">{employee.name}</h1>
                <RoleBadge role={employee.role} />
                <Badge variant={employee.isActive ? 'success' : 'neutral'} size="sm">
                  {employee.isActive ? 'Active Employee' : 'Inactive'}
                </Badge>
              </div>

              <p className="text-sm text-text-muted">{employee.email}</p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-text-muted">
                {employee.employeeId && (
                  <div className="flex items-center gap-1">
                    <Icon name="CreditCard" size={14} className="text-primary" />
                    <span className="font-mono font-medium text-text">{employee.employeeId}</span>
                  </div>
                )}
                {employee.department && (
                  <div className="flex items-center gap-1">
                    <Icon name="Building2" size={14} />
                    <span>{employee.department}</span>
                  </div>
                )}
                {employee.jobTitle && (
                  <div className="flex items-center gap-1">
                    <Icon name="Briefcase" size={14} />
                    <span>{employee.jobTitle}</span>
                  </div>
                )}
                {employee.hireDate && (
                  <div className="flex items-center gap-1">
                    <Icon name="Calendar" size={14} />
                    <span>Hired {formatDate(employee.hireDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <Button onClick={handleOpenEditWorkforce} icon="Edit3" variant="outline">
              Edit Workforce
            </Button>
            <Button onClick={handleOpenAssign} icon="Plus" variant="primary">
              Assign Training
            </Button>
          </div>
        </div>
      </Card>

      {/* Key Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon name="BookOpen" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Assigned Courses</p>
            <p className="text-2xl font-bold text-text">{metrics.totalEnrollments}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10 text-success">
            <Icon name="Award" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Completed</p>
            <p className="text-2xl font-bold text-text">
              {metrics.completed} / {metrics.totalEnrollments}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-info/10 text-info">
            <Icon name="ShieldCheck" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Mandatory Compliance</p>
            <p className="text-2xl font-bold text-text">
              {metrics.mandatoryCompleted} / {metrics.mandatory}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10 text-warning">
            <Icon name="CheckSquare" size={24} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-subtle">Assessment Pass Rate</p>
            <p className="text-2xl font-bold text-text">{metrics.passRate}%</p>
          </div>
        </Card>
      </div>

      {/* Main Sections */}
      <div className="space-y-6">
        {/* Section 1: Enrollments & Certifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Icon name="GraduationCap" size={20} className="text-primary" />
              <span>Training Programs & Certifications</span>
            </h2>
            <Button size="sm" variant="ghost" onClick={handleOpenAssign} icon="Plus">
              Enroll in Course
            </Button>
          </div>

          {enrollments.length === 0 ? (
            <Card className="p-8 text-center">
              <EmptyState
                icon="BookOpen"
                title="No training records"
                description="This employee has not been enrolled in any courses yet."
                action={
                  <Button onClick={handleOpenAssign} icon="Plus" variant="primary">
                    Assign Training
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-bg shadow-xs">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-bg-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-3 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Course Title
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Status & Progress
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Certificate Expiry
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Enrolled Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-subtle pr-5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollments.map((enr) => {
                    const course = enr.courseId || {};
                    const isRevoked = enr.status === 'revoked';
                    const isCompleted = !!enr.completedAt;

                    let expiryBadge = null;
                    if (enr.certificateExpiresAt) {
                      const now = new Date();
                      const expDate = new Date(enr.certificateExpiresAt);
                      const isExpired = expDate < now;
                      const isExpiringSoon = !isExpired && expDate - now <= 30 * 24 * 60 * 60 * 1000;

                      if (isExpired) {
                        expiryBadge = (
                          <Badge variant="error" size="sm">
                            Expired ({formatDate(enr.certificateExpiresAt)})
                          </Badge>
                        );
                      } else if (isExpiringSoon) {
                        expiryBadge = (
                          <Badge variant="warning" size="sm">
                            Expiring ({formatDate(enr.certificateExpiresAt)})
                          </Badge>
                        );
                      } else {
                        expiryBadge = (
                          <span className="text-xs text-text-muted">
                            {formatDate(enr.certificateExpiresAt)}
                          </span>
                        );
                      }
                    } else {
                      expiryBadge = <span className="text-xs text-text-subtle italic">No expiry</span>;
                    }

                    return (
                      <tr key={enr._id} className={isRevoked ? 'opacity-60 bg-bg-muted/20' : ''}>
                        <td className="px-4 py-3 pl-5">
                          <div className="font-medium text-text">{course.title || 'Untitled'}</div>
                          <div className="text-xs text-text-subtle">{course.category || 'General'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {enr.isMandatory ? (
                            <Badge variant="primary" size="sm">
                              Mandatory
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Elective
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isRevoked ? (
                            <Badge variant="neutral" size="sm">
                              Revoked
                            </Badge>
                          ) : isCompleted ? (
                            <Badge variant="success" size="sm">
                              Completed {formatDate(enr.completedAt)}
                            </Badge>
                          ) : (
                            <div className="w-28 space-y-1">
                              <div className="flex justify-between text-xs text-text-muted">
                                <span>In Progress</span>
                                <span>{enr.progressPercentage || 0}%</span>
                              </div>
                              <ProgressBar value={enr.progressPercentage || 0} size="sm" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{expiryBadge}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-text-muted">
                          {formatDate(enr.enrolledAt)}
                        </td>
                        <td className="px-4 py-3 pr-5 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenExpiry(enr)}
                            icon="Calendar"
                          >
                            Set Expiry
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Quiz & Assessment Attempts */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-text flex items-center gap-2">
            <Icon name="CheckSquare" size={20} className="text-primary" />
            <span>Quiz & Assessment History ({quizAttempts.length})</span>
          </h2>

          {quizAttempts.length === 0 ? (
            <Card className="p-6 text-center text-sm text-text-muted">
              No quiz attempts logged for this employee.
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-bg shadow-xs">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-bg-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-3 pl-5 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Quiz / Assessment
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Course
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Score
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-subtle">
                      Result
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-subtle pr-5">
                      Date Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quizAttempts.map((attempt) => (
                    <tr key={attempt._id}>
                      <td className="px-4 py-3 pl-5 font-medium text-text">
                        {attempt.quizId?.title || 'Course Quiz'}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {attempt.courseId?.title || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-medium">
                        {attempt.scorePercentage != null ? `${attempt.scorePercentage}%` : `${attempt.score} pts`}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={attempt.isPassed ? 'success' : 'error'} size="sm">
                          {attempt.isPassed ? 'Passed' : 'Failed'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 pr-5 text-right whitespace-nowrap text-xs text-text-muted">
                        {formatDate(attempt.completedAt || attempt.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Audit Trail */}
        {auditLogs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Icon name="History" size={20} className="text-primary" />
              <span>Administrative Audit Trail ({auditLogs.length})</span>
            </h2>

            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log._id}
                  className="p-3 rounded-xl border border-border bg-bg-subtle text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="primary" size="sm" className="font-mono">
                        {log.action}
                      </Badge>
                      <span className="text-text font-medium">
                        By {log.actorId?.name || 'Admin'}
                      </span>
                    </div>
                    {log.note && <p className="text-text-muted">{log.note}</p>}
                  </div>
                  <span className="text-text-subtle whitespace-nowrap">{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Workforce Modal */}
      <Modal
        open={editWorkforceOpen}
        onClose={() => !workforceSubmitting && setEditWorkforceOpen(false)}
        title="Edit Workforce Profile"
        description={`Update factory operational details for ${employee.name}.`}
      >
        <form onSubmit={handleSaveWorkforce} className="space-y-4">
          <FormField label="Employee ID" helperText="Unique factory badge or workforce ID">
            <Input
              value={workforceForm.employeeId}
              onChange={(e) => setWorkforceForm((prev) => ({ ...prev, employeeId: e.target.value }))}
              placeholder="e.g. EMP-1042"
            />
          </FormField>

          <FormField label="Department">
            <Select
              value={workforceForm.department}
              onChange={(e) => setWorkforceForm((prev) => ({ ...prev, department: e.target.value }))}
            >
              <option value="">-- Choose Department --</option>
              {departments.map((d) => (
                <option key={d._id} value={d.name}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Job Position / Title">
            <Select
              value={workforceForm.jobTitle}
              onChange={(e) => setWorkforceForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
            >
              <option value="">-- Choose Job Position --</option>
              {jobs.map((j) => (
                <option key={j._id} value={j.title}>
                  {j.title} ({j.code})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Hire Date">
            <Input
              type="date"
              value={workforceForm.hireDate}
              onChange={(e) => setWorkforceForm((prev) => ({ ...prev, hireDate: e.target.value }))}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setEditWorkforceOpen(false)} disabled={workforceSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={workforceSubmitting}>
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Training Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => !assignSubmitting && setAssignModalOpen(false)}
        title="Assign Training Course"
        description={`Enroll ${employee.name} in a curriculum with optional certification expiry.`}
      >
        <form onSubmit={handleSaveAssign} className="space-y-4">
          <FormField label="Select Course" required>
            <Select
              value={assignForm.courseId}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, courseId: e.target.value }))}
            >
              <option value="">-- Choose Course --</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title} ({c.category || 'General'})
                </option>
              ))}
            </Select>
          </FormField>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg-subtle">
            <div>
              <p className="text-sm font-medium text-text">Mandatory Compliance Training</p>
              <p className="text-xs text-text-muted">Count toward required job qualification</p>
            </div>
            <Toggle
              checked={assignForm.isMandatory}
              onChange={(next) => setAssignForm((prev) => ({ ...prev, isMandatory: next }))}
            />
          </div>

          <FormField
            label="Certificate Expiry Date (Optional)"
            helperText="Set certification renewal requirement"
          >
            <Input
              type="date"
              value={assignForm.certificateExpiresAt}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, certificateExpiresAt: e.target.value }))}
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

      {/* Expiry Modal */}
      <Modal
        open={expiryModal.open}
        onClose={() => !expiryModal.submitting && setExpiryModal({ open: false, enrollment: null, date: '', submitting: false })}
        title="Update Certificate Expiry"
        description="Set or remove the expiration date for this training certificate."
      >
        <form onSubmit={handleSaveExpiry} className="space-y-4">
          <FormField label="Expiration Date" helperText="Leave empty to clear certification expiration">
            <Input
              type="date"
              value={expiryModal.date}
              onChange={(e) => setExpiryModal((prev) => ({ ...prev, date: e.target.value }))}
            />
          </FormField>

          <div className="flex justify-between items-center pt-4 border-t border-border">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setExpiryModal((prev) => ({ ...prev, date: '' }))}
              disabled={expiryModal.submitting}
            >
              Clear Expiry
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setExpiryModal({ open: false, enrollment: null, date: '', submitting: false })}
                disabled={expiryModal.submitting}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={expiryModal.submitting}>
                Save Expiry
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
