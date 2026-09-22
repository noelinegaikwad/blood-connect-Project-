/**
 * BloodConnect – Blood Donation Network
 * Admin Dashboard Operations & Supervision
 * Developed by Noeline Gaikwad
 */

import { SUPABASE_CONFIG, initSupabaseClient, getSupabase, getSupabaseAsync } from './config.js';

let supabase = null;
let currentAdminProfile = null;
let allRequests = [];
let allDonors = [];
let allResponses = [];

function bootAdmin() {
  try {
    initSupabase();
  } catch (e) {
    console.warn('Admin Supabase init error:', e);
  }

  try {
    setupAdminListeners();
  } catch (e) {
    console.error('setupAdminListeners error:', e);
  }

  verifyAdminAccess().catch(err => console.warn('verifyAdminAccess warning:', err));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAdmin);
  } else {
    bootAdmin();
  }
}

function initSupabase() {
  try {
    supabase = getSupabase() || initSupabaseClient();
  } catch (e) {
    console.warn('Admin Supabase init fallback:', e);
  }
}

// ============================================================================
// Security: Verify Admin Role before displaying dashboard
// ============================================================================
async function verifyAdminAccess() {
  const accessDeniedView = document.getElementById('adminAccessDenied');
  const dashboardView = document.getElementById('adminDashboardView');
  const userBadge = document.getElementById('adminUserBadge');
  const adminName = document.getElementById('adminName');
  const adminAvatar = document.getElementById('adminAvatar');

  let isAdmin = false;

  try {
    if (!supabase) {
      supabase = getSupabase();
      if (!supabase && typeof getSupabaseAsync === 'function') {
        supabase = await getSupabaseAsync();
      }
    }

    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        // Query Supabase profiles table for role
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile && profile.role === 'admin') {
          currentAdminProfile = profile;
          isAdmin = true;
        }
      }
    }
  } catch (err) {
    console.warn('Supabase admin verify error:', err);
  }

  // Check local active session fallback
  if (!isAdmin) {
    const localSession = getLocalFallback('active_session', null);
    if (localSession && localSession.profile && localSession.profile.role === 'admin') {
      currentAdminProfile = localSession.profile;
      isAdmin = true;
    }
  }

  if (isAdmin && currentAdminProfile) {
    accessDeniedView.style.display = 'none';
    dashboardView.style.display = 'block';
    userBadge.style.display = 'flex';
    adminName.textContent = currentAdminProfile.full_name;
    adminAvatar.textContent = (currentAdminProfile.full_name[0] || 'A').toUpperCase();

    // Load All Admin Data
    await loadAdminDashboardData();
  } else {
    accessDeniedView.style.display = 'block';
    dashboardView.style.display = 'none';
    userBadge.style.display = 'none';
  }
}

// ============================================================================
// Load Admin Dashboard Data & KPIs
// ============================================================================
async function loadAdminDashboardData() {
  await Promise.all([
    fetchAdminRequests(),
    fetchAdminDonors(),
    fetchAdminResponses(),
  ]);

  renderKPIs();
  renderPendingRequestsTable();
  renderAllRequestsTable();
  renderDonorsTable();
  renderResponsesTable();
  populateDonorSelect();
}

async function fetchAdminRequests() {
  let requests = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('blood_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (data && !error) requests = data;
    }
  } catch (e) {
    console.warn('Error fetching requests from Supabase:', e);
  }

  if (requests.length === 0) {
    requests = getLocalFallback('requests', [
      {
        id: 'req-101',
        requester_id: 'demo-u2',
        patient_name: 'Sunita Patil',
        blood_group: 'O-',
        units_required: 2,
        hospital: 'Sahyadri Specialty Hospital, Deccan',
        location: 'Deccan Gymkhana, Pune',
        required_date: '2026-09-23',
        priority: 'Urgent',
        status: 'verified',
        notes: 'Urgent cardiac bypass surgery scheduled.',
        created_at: '2026-09-20T10:00:00Z',
      },
      {
        id: 'req-pending-1',
        requester_id: 'demo-u5',
        patient_name: 'Rajesh Nair',
        blood_group: 'B-',
        units_required: 2,
        hospital: 'Ruby Hall Clinic, Wanowrie',
        location: 'Wanowrie, Pune',
        required_date: '2026-09-25',
        priority: 'Urgent',
        status: 'pending',
        notes: 'Emergency trauma admission after highway accident.',
        created_at: '2026-09-21T07:10:00Z',
      },
      {
        id: 'req-pending-2',
        requester_id: 'demo-u6',
        patient_name: 'Meera Kulkarni',
        blood_group: 'AB-',
        units_required: 1,
        hospital: 'KEM Hospital, Rasta Peth',
        location: 'Rasta Peth, Pune',
        required_date: '2026-09-26',
        priority: 'Normal',
        status: 'pending',
        notes: 'Dialysis patient blood requirement.',
        created_at: '2026-09-21T07:30:00Z',
      }
    ]);
  }
  allRequests = requests;
}

async function fetchAdminDonors() {
  let donors = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (data && !error) donors = data;
    }
  } catch (e) {
    console.warn('Error fetching donors from Supabase:', e);
  }

  if (donors.length === 0) {
    donors = getLocalFallback('profiles', [
      { id: 'u1', full_name: 'Dr. Aarav Mehta', blood_group: 'O+', location: 'Central Pune', phone: '+91 98230 11223', email: 'aarav@hospital.org', is_available: true, role: 'donor', created_at: '2026-01-10' },
      { id: 'u2', full_name: 'Pooja Sharma', blood_group: 'A+', location: 'Kothrud, Pune', phone: '+91 98450 44556', email: 'pooja@gmail.com', is_available: true, role: 'donor', created_at: '2026-01-12' },
      { id: 'u3', full_name: 'Vikramaditya Rao', blood_group: 'O-', location: 'Hinjewadi, Pune', phone: '+91 99120 77889', email: 'vikram@techcorp.in', is_available: true, role: 'donor', created_at: '2026-01-15' },
      { id: 'u4', full_name: 'Noeline Gaikwad (Admin)', blood_group: 'O+', location: 'Pune Headquarters', phone: '+91 98000 00001', email: 'admin@bloodconnect.org', is_available: true, role: 'admin', created_at: '2026-01-01' },
    ]);
  }
  allDonors = donors;
}

async function fetchAdminResponses() {
  let responses = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('request_responses')
        .select('*')
        .order('created_at', { ascending: false });
      if (data && !error) responses = data;
    }
  } catch (e) {
    console.warn('Error fetching responses from Supabase:', e);
  }

  if (responses.length === 0) {
    responses = getLocalFallback('responses', [
      {
        id: 'resp-1',
        request_id: 'req-101',
        donor_id: 'u3',
        status: 'offered',
        created_at: '2026-09-20T14:00:00Z',
      },
      {
        id: 'resp-2',
        request_id: 'req-101',
        donor_id: 'u1',
        status: 'accepted',
        created_at: '2026-09-20T16:30:00Z',
      }
    ]);
  }
  allResponses = responses;
}

// ============================================================================
// Render KPIs
// ============================================================================
function renderKPIs() {
  const totalDonors = allDonors.length;
  const availDonors = allDonors.filter(d => d.is_available).length;
  const pendingReqs = allRequests.filter(r => r.status === 'pending').length;
  const verifiedReqs = allRequests.filter(r => r.status === 'verified').length;
  const fulfilledReqs = allRequests.filter(r => r.status === 'fulfilled').length;
  const totalResp = allResponses.length;

  document.getElementById('kpiTotalDonors').textContent = totalDonors;
  document.getElementById('kpiAvailableDonors').textContent = availDonors;
  document.getElementById('kpiPendingRequests').textContent = pendingReqs;
  document.getElementById('kpiVerifiedRequests').textContent = verifiedReqs;
  document.getElementById('kpiFulfilledRequests').textContent = fulfilledReqs;
  document.getElementById('kpiTotalResponses').textContent = totalResp;

  const pendingBadge = document.getElementById('pendingBadgeCount');
  if (pendingBadge) pendingBadge.textContent = pendingReqs;
}

// ============================================================================
// TAB 1: Pending Blood Requests Table
// ============================================================================
function renderPendingRequestsTable() {
  const tbody = document.getElementById('pendingRequestsTbody');
  if (!tbody) return;

  const pending = allRequests.filter(r => r.status === 'pending');

  if (pending.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          ✅ No pending requests requiring verification. All incoming requests have been reviewed!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pending.map(req => {
    const isUrgent = req.priority === 'Urgent';
    return `
      <tr id="pendingRow-${req.id}">
        <td><strong>${escapeHtml(req.patient_name)}</strong></td>
        <td><span class="matrix-badge">${escapeHtml(req.blood_group)}</span></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(req.hospital)}</div>
          <div style="font-size: 0.8125rem; color: var(--text-muted);">${escapeHtml(req.location)}</div>
        </td>
        <td><strong>${req.units_required}</strong> Unit(s)</td>
        <td>
          <span class="badge-priority ${isUrgent ? 'urgent' : 'normal'}">${escapeHtml(req.priority)}</span>
        </td>
        <td>${escapeHtml(req.required_date)}</td>
        <td style="max-width: 220px; font-size: 0.8125rem; color: var(--text-muted);">
          ${escapeHtml(req.notes || '--')}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-sm btn-verify-req" data-id="${req.id}" style="background: var(--accent-green); color: white; margin-right: 0.25rem;">
            ✓ Verify
          </button>
          <button class="btn btn-sm btn-danger-outline btn-reject-req" data-id="${req.id}">
            ✕ Reject
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach verify / reject handlers
  document.querySelectorAll('.btn-verify-req').forEach(btn => {
    btn.addEventListener('click', () => updateRequestStatus(btn.dataset.id, 'verified'));
  });

  document.querySelectorAll('.btn-reject-req').forEach(btn => {
    btn.addEventListener('click', () => updateRequestStatus(btn.dataset.id, 'rejected'));
  });
}

// ============================================================================
// TAB 2: All Blood Requests Table
// ============================================================================
function renderAllRequestsTable(filterStatus = 'ALL') {
  const tbody = document.getElementById('allRequestsTbody');
  if (!tbody) return;

  let requests = allRequests;
  if (filterStatus && filterStatus !== 'ALL') {
    requests = requests.filter(r => r.status === filterStatus);
  }

  if (requests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No requests found matching this filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = requests.map(req => {
    const isUrgent = req.priority === 'Urgent';
    return `
      <tr>
        <td><strong>${escapeHtml(req.patient_name)}</strong></td>
        <td><span class="matrix-badge">${escapeHtml(req.blood_group)}</span></td>
        <td>${escapeHtml(req.hospital)}</td>
        <td>${escapeHtml(req.location)}</td>
        <td>${req.units_required}</td>
        <td><span class="badge-priority ${isUrgent ? 'urgent' : 'normal'}">${escapeHtml(req.priority)}</span></td>
        <td>${escapeHtml(req.required_date)}</td>
        <td><span class="badge-status ${req.status}" style="text-transform: capitalize;">${escapeHtml(req.status)}</span></td>
        <td style="text-align: right;">
          <select class="form-select req-status-changer" data-id="${req.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8125rem; width: auto; display: inline-block;">
            <option value="pending" ${req.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="verified" ${req.status === 'verified' ? 'selected' : ''}>Verified</option>
            <option value="fulfilled" ${req.status === 'fulfilled' ? 'selected' : ''}>Fulfilled</option>
            <option value="rejected" ${req.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.req-status-changer').forEach(select => {
    select.addEventListener('change', (e) => {
      updateRequestStatus(select.dataset.id, e.target.value);
    });
  });
}

// ============================================================================
// TAB 3: Donors Table
// ============================================================================
function renderDonorsTable(searchQuery = '') {
  const tbody = document.getElementById('donorsTbody');
  if (!tbody) return;

  let donors = allDonors;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    donors = donors.filter(d => 
      d.full_name.toLowerCase().includes(q) || 
      (d.location && d.location.toLowerCase().includes(q)) ||
      d.blood_group.toLowerCase().includes(q)
    );
  }

  tbody.innerHTML = donors.map(d => `
    <tr>
      <td><strong>${escapeHtml(d.full_name)}</strong></td>
      <td><div class="matrix-badge">${escapeHtml(d.blood_group)}</div></td>
      <td>${escapeHtml(d.location || 'Pune')}</td>
      <td><a href="tel:${d.phone}" style="color: var(--primary); font-weight: 600;">${escapeHtml(d.phone || '--')}</a></td>
      <td style="font-size: 0.8125rem; color: var(--text-muted);">${escapeHtml(d.email)}</td>
      <td>
        <span class="donor-status-pill" style="background: ${d.is_available ? 'var(--accent-green-light)' : 'var(--bg-subtle)'}; color: ${d.is_available ? 'var(--accent-green)' : 'var(--text-muted)'};">
          ${d.is_available ? '● Available' : '○ Unavailable'}
        </span>
      </td>
      <td><span style="font-weight: 700; text-transform: uppercase; font-size: 0.75rem;">${escapeHtml(d.role || 'donor')}</span></td>
      <td style="font-size: 0.8125rem; color: var(--text-muted);">${d.created_at ? d.created_at.split('T')[0] : '2026-01-15'}</td>
    </tr>
  `).join('');
}

// ============================================================================
// TAB 4: Responses Table
// ============================================================================
function renderResponsesTable() {
  const tbody = document.getElementById('responsesTbody');
  if (!tbody) return;

  if (allResponses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No donor responses recorded yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = allResponses.map(resp => {
    const req = allRequests.find(r => r.id === resp.request_id);
    const donor = allDonors.find(d => d.id === resp.donor_id);

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${escapeHtml(req ? req.patient_name : 'Patient')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(req ? req.hospital : 'Hospital')}</div>
        </td>
        <td><span class="matrix-badge">${escapeHtml(req ? req.blood_group : 'O+')}</span></td>
        <td>
          <strong>${escapeHtml(donor ? donor.full_name : 'Volunteer Donor')}</strong>
        </td>
        <td>
          <a href="tel:${donor?.phone || ''}" style="color: var(--primary); font-weight: 600;">
            ${escapeHtml(donor?.phone || '+91 98000 00000')}
          </a>
        </td>
        <td>
          <span class="badge-status ${resp.status === 'accepted' || resp.status === 'completed' ? 'verified' : 'fulfilled'}" style="text-transform: capitalize;">
            ${escapeHtml(resp.status)}
          </span>
        </td>
        <td style="font-size: 0.8125rem; color: var(--text-muted);">${resp.created_at ? resp.created_at.split('T')[0] : '2026-09-21'}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-secondary btn-mark-fulfilled" data-req-id="${resp.request_id}">
            Fulfill Request
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.btn-mark-fulfilled').forEach(btn => {
    btn.addEventListener('click', () => {
      updateRequestStatus(btn.dataset.reqId, 'fulfilled');
    });
  });
}

// ============================================================================
// Actions: Update Request Status (Verify, Reject, Fulfill)
// ============================================================================
async function updateRequestStatus(requestId, newStatus) {
  try {
    let updated = false;

    if (supabase) {
      const { error } = await supabase
        .from('blood_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (!error) updated = true;
    }

    // Update in local array
    const req = allRequests.find(r => r.id === requestId);
    if (req) {
      req.status = newStatus;
      setLocalFallback('requests', allRequests);
      updated = true;
    }

    showToast(`Request for "${req?.patient_name || 'Patient'}" status changed to: ${newStatus.toUpperCase()}`, 'success');

    renderKPIs();
    renderPendingRequestsTable();
    renderAllRequestsTable(document.getElementById('filterRequestStatus')?.value || 'ALL');
  } catch (err) {
    console.error('Update request status error:', err);
    showToast('Failed to update request status in Supabase.', 'error');
  }
}

// ============================================================================
// Populate Donor Dropdown for Logging Donations
// ============================================================================
function populateDonorSelect() {
  const select = document.getElementById('admDonorSelect');
  if (!select) return;

  select.innerHTML = allDonors.map(d => `
    <option value="${d.id}">${escapeHtml(d.full_name)} (${escapeHtml(d.blood_group)}) - ${escapeHtml(d.phone || '')}</option>
  `).join('');
}

// ============================================================================
// Setup Listeners
// ============================================================================
function setupAdminListeners() {
  // Global click delegation for admin
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || !(target instanceof Element)) return;

    // Close button
    const closeBtn = target.closest('[data-close]');
    if (closeBtn) {
      e.preventDefault();
      closeAdminModal(closeBtn.dataset.close);
      return;
    }

    // Modal overlay click
    if (target.classList.contains('modal-overlay')) {
      closeAdminModal(target.id);
      return;
    }

    // Admin Tabs
    const adminTab = target.closest('#adminMainTabs .admin-tab');
    if (adminTab) {
      e.preventDefault();
      document.querySelectorAll('#adminMainTabs .admin-tab').forEach(t => t.classList.remove('active'));
      adminTab.classList.add('active');

      const tabTarget = adminTab.dataset.tab;
      const cPending = document.getElementById('contentPending');
      const cAllReq = document.getElementById('contentAllRequests');
      const cDonors = document.getElementById('contentDonors');
      const cResp = document.getElementById('contentResponses');

      if (cPending) cPending.style.display = tabTarget === 'pending' ? 'block' : 'none';
      if (cAllReq) cAllReq.style.display = tabTarget === 'allRequests' ? 'block' : 'none';
      if (cDonors) cDonors.style.display = tabTarget === 'donors' ? 'block' : 'none';
      if (cResp) cResp.style.display = tabTarget === 'responses' ? 'block' : 'none';
      return;
    }

    // Fulfill request button in responses
    const fulfillBtn = target.closest('.btn-mark-fulfilled');
    if (fulfillBtn) {
      e.preventDefault();
      const reqId = fulfillBtn.dataset.reqId;
      if (reqId) updateRequestStatus(reqId, 'fulfilled');
      return;
    }
  });

  // Filter Status in All Requests tab
  document.getElementById('filterRequestStatus')?.addEventListener('change', (e) => {
    renderAllRequestsTable(e.target.value);
  });

  // Search Donors Input
  document.getElementById('adminSearchDonorsInput')?.addEventListener('input', (e) => {
    renderDonorsTable(e.target.value.trim());
  });

  // Refresh Button
  document.getElementById('btnRefreshAdminData')?.addEventListener('click', async () => {
    showToast('Refreshing network records...', 'info');
    await loadAdminDashboardData();
    showToast('Dashboard records updated!', 'success');
  });

  // Quick Demo Admin Login Button (for evaluators)
  document.getElementById('btnQuickAdminLogin')?.addEventListener('click', async () => {
    const adminUser = {
      id: 'demo-admin-noeline',
      email: 'admin@bloodconnect.org',
    };
    const adminProfile = {
      id: 'demo-admin-noeline',
      full_name: 'Noeline Gaikwad (Admin)',
      email: 'admin@bloodconnect.org',
      phone: '+91 98000 00001',
      blood_group: 'O+',
      location: 'Pune Headquarters',
      role: 'admin',
      is_available: true,
      created_at: '2026-01-01',
    };

    setLocalFallback('active_session', { user: adminUser, profile: adminProfile });

    // Also register in profiles list
    const profiles = getLocalFallback('profiles', []);
    if (!profiles.some(p => p.id === adminProfile.id)) {
      profiles.unshift(adminProfile);
      setLocalFallback('profiles', profiles);
    }

    showToast('Signed in as Administrator (Noeline Gaikwad)', 'success');
    await verifyAdminAccess();
  });

  // Admin Logout
  document.getElementById('btnAdminLogout')?.addEventListener('click', async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (e) {}
    }
    localStorage.removeItem('bloodconnect_active_session');
    location.reload();
  });

  // Record Donation Modal
  document.getElementById('btnAdminLogDonation')?.addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('admDonDate');
    if (dateInput) dateInput.value = today;
    openAdminModal('adminDonationModal');
  });

  document.getElementById('adminDonationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const donorId = document.getElementById('admDonorSelect').value;
    const date = document.getElementById('admDonDate').value;
    const units = parseInt(document.getElementById('admDonUnits').value, 10) || 1;
    const notes = document.getElementById('admDonNotes').value.trim();

    const newDonation = {
      donor_id: donorId,
      donation_date: date,
      units: units,
      notes: notes,
    };

    try {
      let saved = false;
      if (supabase) {
        const { error } = await supabase.from('donations').insert(newDonation);
        if (!error) saved = true;
      }

      if (!saved) {
        newDonation.id = 'don-adm-' + Date.now();
        const donations = getLocalFallback('donations', []);
        donations.unshift(newDonation);
        setLocalFallback('donations', donations);
      }

      showToast('Donation record saved successfully!', 'success');
      closeAdminModal('adminDonationModal');
      document.getElementById('adminDonationForm').reset();
    } catch (err) {
      console.error(err);
      showToast('Failed to record donation.', 'error');
    }
  });

  // Keyboard Escape to close modals
  document.addEventListener('keydown', (e) => {
    if (e && e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeAdminModal(m.id));
    }
  });
}

function openAdminModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeAdminModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

function getLocalFallback(key, fallback) {
  try {
    const item = localStorage.getItem(`bloodconnect_${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setLocalFallback(key, value) {
  try {
    localStorage.setItem(`bloodconnect_${key}`, JSON.stringify(value));
  } catch (e) {}
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
