/**
 * app.js — Student Management System
 * Handles: API communication, computed values, DOM rendering.
 *
 * Computed values (JavaScript):
 *   - Age (from dateOfBirth)
 *   - Academic Standing (from GPA)
 *   - Degree Progress % (from creditsCompleted / 120)
 *   - Dashboard aggregates (avg GPA, honor roll count, etc.)
 */

'use strict';

// ── Configuration ──────────────────────────────────────────────────────────
// API_BASE is set in js/config.js — update that file for each environment.
const API_BASE = window.API_BASE ?? 'http://localhost:80/api';

// ── DOM references ─────────────────────────────────────────────────────────
const registerForm      = document.getElementById('register-form');
const searchInput       = document.getElementById('search-id-input');
const searchBtn         = document.getElementById('search-btn');
const loadAllBtn        = document.getElementById('load-all-btn');
const studentsTableBody = document.getElementById('students-tbody');
const tableContainer    = document.getElementById('table-container');
const searchResultCard  = document.getElementById('search-result-card');
const formAlert         = document.getElementById('form-alert');
const toastContainer    = document.getElementById('toast-container');

// ── Stat counters ──────────────────────────────────────────────────────────
const statTotal      = document.getElementById('stat-total');
const statAvgGpa     = document.getElementById('stat-avg-gpa');
const statHonorRoll  = document.getElementById('stat-honor-roll');
const statActive     = document.getElementById('stat-active');

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTED VALUE FUNCTIONS  (pure — no side effects)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculates the age of a student based on their date of birth.
 * @param {string} dateOfBirth — ISO date string (YYYY-MM-DD)
 * @returns {number} age in full years
 */
function computeAge(dateOfBirth) {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Determines the academic standing label based on GPA.
 * @param {number} gpa — between 0.0 and 4.0
 * @returns {{ label: string, cssClass: string }}
 */
function computeAcademicStanding(gpa) {
  if (gpa >= 3.5) return { label: 'Honor Roll', cssClass: 'badge-honor' };
  if (gpa >= 2.0) return { label: 'Good Standing', cssClass: 'badge-good' };
  return { label: 'Probation', cssClass: 'badge-probation' };
}

/**
 * Calculates the percentage of degree completion.
 * Assumes 120 total credits required for graduation.
 * @param {number} creditsCompleted
 * @returns {number} percentage 0–100 (capped at 100)
 */
function computeDegreeProgress(creditsCompleted) {
  const TOTAL_CREDITS = 120;
  return Math.min(Math.round((creditsCompleted / TOTAL_CREDITS) * 100), 100);
}

/**
 * Computes dashboard aggregates from an array of student objects.
 * @param {Array} students
 * @returns {{ total, averageGpa, honorRollCount, activeCount }}
 */
function computeDashboardStats(students) {
  if (!students.length) {
    return { total: 0, averageGpa: '—', honorRollCount: 0, activeCount: 0 };
  }

  const total         = students.length;
  const averageGpa    = (students.reduce((sum, s) => sum + Number(s.gpa), 0) / total).toFixed(2);
  const honorRollCount = students.filter(s => Number(s.gpa) >= 3.5).length;
  const activeCount   = students.filter(s => s.enrollmentStatus === 'Active').length;

  return { total, averageGpa, honorRollCount, activeCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// API LAYER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sends a POST request to register a new student.
 * @param {Object} studentData
 * @returns {Promise<Object>} API response
 */
async function apiCreateStudent(studentData) {
  const response = await fetch(`${API_BASE}/students`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(studentData),
  });
  return response.json();
}

/**
 * Fetches a student by their numeric ID.
 * @param {string} id
 * @returns {Promise<Object>} API response
 */
async function apiFindStudentById(id) {
  const response = await fetch(`${API_BASE}/students/${id}`);
  return response.json();
}

/**
 * Fetches all students.
 * @returns {Promise<Object>} API response
 */
async function apiFetchAllStudents() {
  const response = await fetch(`${API_BASE}/students`);
  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Builds the enrollment status badge HTML.
 * @param {string} status
 * @returns {string} HTML string
 */
function renderStatusBadge(status) {
  const map = {
    Active:    'badge-active',
    Inactive:  'badge-inactive',
    Graduated: 'badge-graduated',
  };
  const cls = map[status] ?? 'badge-good';
  return `<span class="badge ${cls}">${status}</span>`;
}

/**
 * Renders a single student row into the table body.
 * @param {Object} student
 * @returns {string} HTML string for <tr>
 */
function renderStudentRow(student) {
  const age       = computeAge(student.dateOfBirth);
  const standing  = computeAcademicStanding(Number(student.gpa));
  const progress  = computeDegreeProgress(Number(student.creditsCompleted));

  return `
    <tr>
      <td class="td-muted">#${student.id}</td>
      <td><strong>${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</strong></td>
      <td class="td-muted">${escapeHtml(student.email)}</td>
      <td>${escapeHtml(student.major)}</td>
      <td>${age} yrs</td>
      <td>${student.gpa.toFixed(2)}</td>
      <td><span class="badge ${standing.cssClass}">${standing.label}</span></td>
      <td>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span class="progress-label">${progress}%</span>
        </div>
      </td>
      <td>${renderStatusBadge(student.enrollmentStatus)}</td>
    </tr>
  `;
}

/**
 * Populates the students table and updates dashboard stats.
 * @param {Array} students
 */
function renderStudentsTable(students) {
  if (!students.length) {
    studentsTableBody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          <div class="empty-icon">🎓</div>
          <p>No students found. Register the first one!</p>
        </div>
      </td></tr>`;
    return;
  }

  studentsTableBody.innerHTML = students.map(renderStudentRow).join('');
  updateDashboardStats(students);
}

/**
 * Updates the top-level stat cards.
 * @param {Array} students
 */
function updateDashboardStats(students) {
  const stats = computeDashboardStats(students);
  statTotal.textContent     = stats.total;
  statAvgGpa.textContent    = stats.averageGpa;
  statHonorRoll.textContent = stats.honorRollCount;
  statActive.textContent    = stats.activeCount;
}

/**
 * Renders the search result detail card.
 * @param {Object} student
 */
function renderSearchResult(student) {
  const age      = computeAge(student.dateOfBirth);
  const standing = computeAcademicStanding(Number(student.gpa));
  const progress = computeDegreeProgress(Number(student.creditsCompleted));

  document.getElementById('res-name').textContent    = `${student.firstName} ${student.lastName}`;
  document.getElementById('res-email').textContent   = student.email;
  document.getElementById('res-phone').textContent   = student.phone;
  document.getElementById('res-major').textContent   = student.major;
  document.getElementById('res-dob').textContent     = student.dateOfBirth;
  document.getElementById('res-age').textContent     = `${age} years old`;
  document.getElementById('res-gpa').textContent     = Number(student.gpa).toFixed(2);
  document.getElementById('res-standing').textContent = standing.label;
  document.getElementById('res-credits').textContent = `${student.creditsCompleted} / 120`;
  document.getElementById('res-progress').textContent = `${progress}%`;
  document.getElementById('res-status').textContent  = student.enrollmentStatus;
  document.getElementById('res-address').textContent = student.address;

  searchResultCard.classList.add('show');
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️' };

/**
 * Shows a temporary toast message.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration — ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${TOAST_ICONS[type]}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.35s forwards';
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function showFormAlert(message, type = 'error') {
  formAlert.className = `alert alert-${type} show`;
  formAlert.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span><span>${message}</span>`;
}

function hideFormAlert() {
  formAlert.className = 'alert';
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  btn.dataset.original = btn.dataset.original ?? btn.innerHTML;
  btn.innerHTML = loading
    ? `<span class="spinner"></span> Saving…`
    : btn.dataset.original;
}

/** Prevents XSS when inserting user content into innerHTML */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function collectFormData() {
  return {
    firstName:        document.getElementById('firstName').value.trim(),
    lastName:         document.getElementById('lastName').value.trim(),
    email:            document.getElementById('email').value.trim(),
    phone:            document.getElementById('phone').value.trim(),
    dateOfBirth:      document.getElementById('dateOfBirth').value,
    gender:           document.getElementById('gender').value,
    major:            document.getElementById('major').value.trim(),
    gpa:              parseFloat(document.getElementById('gpa').value),
    enrollmentStatus: document.getElementById('enrollmentStatus').value,
    creditsCompleted: parseInt(document.getElementById('creditsCompleted').value, 10),
    address:          document.getElementById('address').value.trim(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideFormAlert();

  const submitBtn = document.getElementById('submit-btn');
  setButtonLoading(submitBtn, true);

  try {
    const studentData = collectFormData();
    const result      = await apiCreateStudent(studentData);

    if (result.success) {
      showToast(`Student "${studentData.firstName} ${studentData.lastName}" registered! `, 'success');
      registerForm.reset();
      await handleLoadAll(); // refresh table
    } else {
      showFormAlert(result.message ?? 'Could not register student.');
    }
  } catch {
    showFormAlert('Connection error — make sure the backend is running on port 8000.');
  } finally {
    setButtonLoading(submitBtn, false);
  }
});

searchBtn.addEventListener('click', async () => {
  const id = searchInput.value.trim();
  if (!id) { showToast('Please enter a student ID.', 'info'); return; }

  searchResultCard.classList.remove('show');
  searchBtn.disabled = true;
  searchBtn.innerHTML = '<span class="spinner"></span>';

  try {
    const result = await apiFindStudentById(id);
    if (result.success) {
      renderSearchResult(result.data);
      showToast('Student found!', 'success');
    } else {
      showToast(result.message ?? 'Student not found.', 'error');
    }
  } catch {
    showToast('Connection error — make sure the backend is running on port 8000.', 'error');
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = '🔍 Search';
  }
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchBtn.click();
});

async function handleLoadAll() {
  loadAllBtn.disabled = true;
  loadAllBtn.innerHTML = '<span class="spinner"></span> Loading…';
  tableContainer.style.display = 'block';

  try {
    const result = await apiFetchAllStudents();
    if (result.success) {
      renderStudentsTable(result.data);
    } else {
      showToast('Could not load students.', 'error');
    }
  } catch {
    showToast('Connection error — make sure the backend is running on port 8000.', 'error');
  } finally {
    loadAllBtn.disabled = false;
    loadAllBtn.innerHTML = '🔄 Refresh';
  }
}

loadAllBtn.addEventListener('click', handleLoadAll);

// Auto-load on page ready
document.addEventListener('DOMContentLoaded', handleLoadAll);
