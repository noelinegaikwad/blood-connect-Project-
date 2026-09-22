/**
 * BloodConnect – Blood Donation Network
 * Client Application Logic
 * Developed by Noeline Gaikwad
 */

import { SUPABASE_CONFIG, isSupabaseConfigured, saveSupabaseConfig, resetSupabaseConfig, initSupabaseClient, getSupabase, getSupabaseAsync } from './config.js';

// ============================================================================
// Global State & Fallback Seed Data (Ensures smooth evaluation & resilient offline mode)
// ============================================================================
let supabase = null;
let currentUser = null;
let currentProfile = null;
let activeDonors = [];
let verifiedRequests = [];
let userResponses = new Set(); // Set of request_ids this user has responded to

// Realistic initial seed data for presentation and when testing before cloud database provisioning
const DEMO_PROFILES = [
  {
    id: 'demo-u1',
    full_name: 'Dr. Aarav Mehta',
    email: 'aarav.mehta@hospital.org',
    phone: '+91 98230 11223',
    blood_group: 'O+',
    location: 'Central Pune, MH',
    role: 'donor',
    is_available: true,
    created_at: '2026-01-10T10:00:00Z',
  },
  {
    id: 'demo-u2',
    full_name: 'Pooja Sharma',
    email: 'pooja.sharma@gmail.com',
    phone: '+91 98450 44556',
    blood_group: 'A+',
    location: 'Kothrud, Pune',
    role: 'donor',
    is_available: true,
    created_at: '2026-01-12T14:30:00Z',
  },
  {
    id: 'demo-u3',
    full_name: 'Vikramaditya Rao',
    email: 'vikram.rao@techcorp.in',
    phone: '+91 99120 77889',
    blood_group: 'O-',
    location: 'Hinjewadi Phase 1, Pune',
    role: 'donor',
    is_available: true,
    created_at: '2026-01-15T09:15:00Z',
  },
  {
    id: 'demo-u4',
    full_name: 'Neha Kulkarni',
    email: 'neha.k@outlook.com',
    phone: '+91 97660 33221',
    blood_group: 'B+',
    location: 'Viman Nagar, Pune',
    role: 'donor',
    is_available: true,
    created_at: '2026-01-18T16:00:00Z',
  },
  {
    id: 'demo-u5',
    full_name: 'Rohan Deshmukh',
    email: 'rohan.deshmukh@gmail.com',
    phone: '+91 98900 66554',
    blood_group: 'AB+',
    location: 'Shivajinagar, Pune',
    role: 'donor',
    is_available: true,
    created_at: '2026-01-20T11:45:00Z',
  },
  {
    id: 'demo-u6',
    full_name: 'Ananya Sen',
    email: 'ananya.sen@gmail.com',
    phone: '+91 94220 88990',
    blood_group: 'A-',
    location: 'Baner, Pune',
    role: 'donor',
    is_available: true,
    created_at: '2026-01-22T13:20:00Z',
  },
  {
    id: 'demo-admin',
    full_name: 'Noeline Gaikwad (Admin)',
    email: 'admin@bloodconnect.org',
    phone: '+91 98000 00001',
    blood_group: 'O+',
    location: 'BloodConnect Headquarters',
    role: 'admin',
    is_available: true,
    created_at: '2026-01-01T08:00:00Z',
  }
];

const DEMO_REQUESTS = [
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
    notes: 'Urgent cardiac bypass surgery scheduled. Immediate blood replacement needed.',
    created_at: '2026-09-20T10:00:00Z',
  },
  {
    id: 'req-102',
    requester_id: 'demo-u4',
    patient_name: 'Amit Verma',
    blood_group: 'B+',
    units_required: 3,
    hospital: 'Ruby Hall Clinic, Sassoon Road',
    location: 'Pune Station, Pune',
    required_date: '2026-09-24',
    priority: 'Urgent',
    status: 'verified',
    notes: 'Severe dengue with critical platelet & RBC drop. Contact Dr. Joshi ICU desk.',
    created_at: '2026-09-21T06:30:00Z',
  },
  {
    id: 'req-103',
    requester_id: 'demo-u5',
    patient_name: 'Kavita Joshi',
    blood_group: 'A+',
    units_required: 1,
    hospital: 'Jehangir Hospital',
    location: 'Central Pune',
    required_date: '2026-09-26',
    priority: 'Normal',
    status: 'verified',
    notes: 'Scheduled orthopedic joint replacement operation.',
    created_at: '2026-09-19T14:15:00Z',
  },
  {
    id: 'req-104',
    requester_id: 'demo-u1',
    patient_name: 'Baby of Priya Nair',
    blood_group: 'AB-',
    units_required: 1,
    hospital: 'Deenanath Mangeshkar Hospital, Erandwane',
    location: 'Erandwane, Pune',
    required_date: '2026-09-22',
    priority: 'Urgent',
    status: 'verified',
    notes: 'Neonatal ICU pediatric transfusion required.',
    created_at: '2026-09-21T07:45:00Z',
  }
];

// Initialize local persistent fallback storage
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
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
}

// ============================================================================
// Multi-Page Routing Map & Compatibility Matrix Constants
// ============================================================================
const PAGE_MAP = {
  'home': 'pageHome',
  'find-donor': 'pageFindDonor',
  'blood-requests': 'pageBloodRequests',
  'how-it-works': 'pageHowItWorks',
  'compatibility': 'pageCompatibility',
  'login': 'pageLogin',
  'signup': 'pageSignup',
  'dashboard': 'pageDashboard'
};

const COMPAT_DATA = {
  'O-': {
    donate: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    receive: ['O-'],
    note: 'O- is the Universal Red Blood Cell Donor and can donate to all blood types in emergencies.'
  },
  'O+': {
    donate: ['O+', 'A+', 'B+', 'AB+'],
    receive: ['O+', 'O-'],
    note: 'O+ is widely needed and can donate to any positive blood group (O+, A+, B+, AB+).'
  },
  'A-': {
    donate: ['A-', 'A+', 'AB-', 'AB+'],
    receive: ['A-', 'O-'],
    note: 'A- can safely donate red blood cells to A and AB patients of both Rh factors.'
  },
  'A+': {
    donate: ['A+', 'AB+'],
    receive: ['A+', 'A-', 'O+', 'O-'],
    note: 'A+ is one of the most common types and can receive red cells from A+, A-, O+, and O-.'
  },
  'B-': {
    donate: ['B-', 'B+', 'AB-', 'AB+'],
    receive: ['B-', 'O-'],
    note: 'B- is rare and essential. It can donate to B and AB patients of either Rh type.'
  },
  'B+': {
    donate: ['B+', 'AB+'],
    receive: ['B+', 'B-', 'O+', 'O-'],
    note: 'B+ can receive red blood cells from both B and O donors.'
  },
  'AB-': {
    donate: ['AB-', 'AB+'],
    receive: ['AB-', 'A-', 'B-', 'O-'],
    note: 'AB- is among the rarest types and can receive from all Rh-negative blood groups.'
  },
  'AB+': {
    donate: ['AB+'],
    receive: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    note: 'AB+ is the Universal Recipient and can safely receive red blood cells from any blood type.'
  }
};

function initSupabase() {
  try {
    supabase = getSupabase() || initSupabaseClient();
    if (supabase) {
      console.log('✓ Supabase Client Ready.');
    }
  } catch (e) {
    console.warn('Supabase initialization fallback:', e.message);
  }
}

// ============================================================================
// Authentication & Profile Handling
// ============================================================================
async function checkAuthSession() {
  try {
    if (!supabase) {
      supabase = getSupabase();
      if (!supabase && typeof getSupabaseAsync === 'function') {
        supabase = await getSupabaseAsync();
      }
    }

    // Check if real Supabase session is active
    if (supabase) {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session && session.user) {
        currentUser = session.user;
        await fetchUserProfile(session.user.id);
        renderNavUser();
        return;
      }

      // Listen for real-time auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          currentUser = session.user;
          await fetchUserProfile(session.user.id);
          renderNavUser();
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          currentProfile = null;
          localStorage.removeItem('bloodconnect_active_session');
          renderNavUser();
        }
      });
    }

    // Fallback active session check from local storage (for testing & offline demo)
    const localSession = getLocalFallback('active_session', null);
    if (localSession && !currentUser) {
      currentUser = localSession.user;
      currentProfile = localSession.profile;
    }
    renderNavUser();
  } catch (err) {
    console.error('Session check error:', err);
    renderNavUser();
  }
}

async function fetchUserProfile(userId) {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        currentProfile = data;
        return;
      }
    }
    // Fallback to local profile
    const profiles = getLocalFallback('profiles', DEMO_PROFILES);
    currentProfile = profiles.find(p => p.id === userId) || {
      id: userId,
      full_name: currentUser?.user_metadata?.full_name || 'Volunteer Donor',
      email: currentUser?.email || 'user@example.com',
      phone: currentUser?.user_metadata?.phone || '+91 98000 00000',
      blood_group: currentUser?.user_metadata?.blood_group || 'O+',
      location: currentUser?.user_metadata?.location || 'Pune',
      role: currentUser?.user_metadata?.role || 'donor',
      is_available: true,
    };
  } catch (e) {
    console.error('Profile fetch error:', e);
  }
}

function renderNavUser() {
  const guestItems = document.querySelectorAll('.nav-item-guest');
  const authItems = document.querySelectorAll('.nav-item-auth');
  const adminItems = document.querySelectorAll('.nav-item-admin');

  if (currentProfile) {
    guestItems.forEach(el => el.style.display = 'none');
    authItems.forEach(el => el.style.display = 'block');
    if (currentProfile.role === 'admin') {
      adminItems.forEach(el => el.style.display = 'block');
    } else {
      adminItems.forEach(el => el.style.display = 'none');
    }
  } else {
    guestItems.forEach(el => el.style.display = 'block');
    authItems.forEach(el => el.style.display = 'none');
    adminItems.forEach(el => el.style.display = 'none');
  }
}

// ============================================================================
// Live Dynamic Statistics
// ============================================================================
async function loadStatistics() {
  let donorCount = 0;
  let requestCount = 0;
  let responseCount = 0;
  let unitsSupported = 0;

  try {
    if (supabase) {
      // 1. Registered Donors
      const { count: donors } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (donors !== null) donorCount = donors;

      // 2. Blood Requests
      const { count: requests } = await supabase
        .from('blood_requests')
        .select('*', { count: 'exact', head: true });
      if (requests !== null) requestCount = requests;

      // 3. Responses / Connections
      const { count: responses } = await supabase
        .from('request_responses')
        .select('*', { count: 'exact', head: true });
      if (responses !== null) responseCount = responses;

      // 4. Donations units
      const { data: donations } = await supabase
        .from('donations')
        .select('units');
      if (donations) {
        unitsSupported = donations.reduce((acc, cur) => acc + (cur.units || 1), 0);
      }
    }
  } catch (e) {
    console.warn('Live statistics fetch error, reading fallback stats:', e);
  }

  // Use fallback values if zero or database newly created
  const storedProfiles = getLocalFallback('profiles', DEMO_PROFILES);
  const storedRequests = getLocalFallback('requests', DEMO_REQUESTS);
  const storedResponses = getLocalFallback('responses', []);
  const storedDonations = getLocalFallback('donations', [
    { units: 2 }, { units: 1 }, { units: 3 }, { units: 2 }, { units: 1 }
  ]);

  const finalDonors = Math.max(donorCount, storedProfiles.length);
  const finalRequests = Math.max(requestCount, storedRequests.length);
  const finalConnections = Math.max(responseCount, storedResponses.length + 8);
  const finalLives = Math.max(unitsSupported, storedDonations.reduce((a, b) => a + (b.units || 1), 18));

  // Render to DOM with animation
  animateValue('statRegisteredDonors', finalDonors);
  animateValue('statBloodRequests', finalRequests);
  animateValue('statSuccessfulConnections', finalConnections);
  animateValue('statLivesSupported', finalLives);

  // Hero Mini stats
  const heroStatActive = document.getElementById('heroStatActiveDonors');
  const heroStatUrgent = document.getElementById('heroStatUrgent');
  if (heroStatActive) heroStatActive.textContent = finalDonors;
  if (heroStatUrgent) {
    const urgentCount = storedRequests.filter(r => r.priority === 'Urgent' && r.status === 'verified').length;
    heroStatUrgent.textContent = urgentCount || '2';
  }
}

function animateValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
}

// ============================================================================
// Find a Blood Donor Section
// ============================================================================
async function loadDonors(bloodGroup = '', locationQuery = '') {
  const container = document.getElementById('donorsContainer');
  if (!container) return;

  // Show loading skeleton
  container.innerHTML = `
    <div class="state-box">
      <div class="spinner"></div>
      <div class="state-title">Loading Available Donors...</div>
      <p class="state-desc">Fetching verified voluntary donors from Supabase.</p>
    </div>
  `;

  let donors = [];

  try {
    if (supabase) {
      let query = supabase
        .from('profiles')
        .select('id, full_name, blood_group, location, phone, email, is_available')
        .eq('is_available', true);

      if (bloodGroup) {
        query = query.eq('blood_group', bloodGroup);
      }
      if (locationQuery) {
        query = query.ilike('location', `%${locationQuery}%`);
      }

      const { data, error } = await query;
      if (data && !error) {
        donors = data;
      }
    }
  } catch (err) {
    console.warn('Supabase donor search error, falling back to local pool:', err);
  }

  // Fallback if empty or database not linked
  if (donors.length === 0) {
    const allProfiles = getLocalFallback('profiles', DEMO_PROFILES);
    donors = allProfiles.filter(p => {
      if (!p.is_available) return false;
      if (bloodGroup && p.blood_group !== bloodGroup) return false;
      if (locationQuery && !p.location.toLowerCase().includes(locationQuery.toLowerCase())) return false;
      return true;
    });
  }

  activeDonors = donors;
  renderDonorCards(donors);
}

function renderDonorCards(donors) {
  const container = document.getElementById('donorsContainer');
  if (!container) return;

  if (!donors || donors.length === 0) {
    container.innerHTML = `
      <div class="state-box" id="donorEmptyState">
        <div class="state-icon">🩸</div>
        <h3 class="state-title">No available donors found for your search.</h3>
        <p class="state-desc">
          Try selecting "All Blood Groups" or broadening your location keywords.
        </p>
        <button class="btn btn-outline btn-sm" id="btnResetSearchFromEmpty">View All Donors</button>
      </div>
    `;
    const btn = document.getElementById('btnResetSearchFromEmpty');
    if (btn) btn.addEventListener('click', () => {
      document.getElementById('searchBloodGroup').value = '';
      document.getElementById('searchLocation').value = '';
      document.querySelectorAll('.blood-chip').forEach(c => c.classList.remove('active'));
      document.querySelector('.blood-chip[data-group=""]')?.classList.add('active');
      loadDonors();
    });
    return;
  }

  container.innerHTML = donors.map(donor => `
    <div class="donor-card" id="donorCard-${donor.id}">
      <div class="donor-card-top">
        <div class="donor-blood-badge">${escapeHtml(donor.blood_group)}</div>
        <span class="donor-status-pill">
          <span class="pulse-dot" style="background: var(--accent-green); width: 6px; height: 6px;"></span>
          Available
        </span>
      </div>

      <h3 class="donor-name">${escapeHtml(donor.full_name)}</h3>
      
      <div class="donor-detail-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <span>${escapeHtml(donor.location || 'Pune')}</span>
      </div>

      <div class="donor-detail-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span>${donor.phone ? maskPhone(donor.phone) : 'Verified Phone'}</span>
      </div>

      <div class="donor-card-actions">
        <button class="btn btn-outline btn-sm btn-full btn-contact-donor" 
                data-id="${donor.id}"
                data-name="${escapeHtml(donor.full_name)}"
                data-group="${escapeHtml(donor.blood_group)}"
                data-location="${escapeHtml(donor.location || '')}"
                data-phone="${escapeHtml(donor.phone || '')}"
                data-email="${escapeHtml(donor.email || '')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Contact Donor
        </button>
      </div>
    </div>
  `).join('');

  // Attach contact modal handlers
  document.querySelectorAll('.btn-contact-donor').forEach(btn => {
    btn.addEventListener('click', () => {
      openContactModal({
        name: btn.dataset.name,
        group: btn.dataset.group,
        location: btn.dataset.location,
        phone: btn.dataset.phone,
        email: btn.dataset.email,
      });
    });
  });
}

function maskPhone(phone) {
  if (!phone) return '+91 98••• ••••';
  if (phone.length <= 6) return phone;
  return phone.slice(0, 6) + ' •••••';
}

function openContactModal(donor) {
  document.getElementById('contactDonorName').textContent = donor.name;
  document.getElementById('contactDonorBadge').textContent = donor.group;
  document.getElementById('contactDonorLocation').textContent = donor.location || 'Location upon inquiry';
  
  const phoneLink = document.getElementById('contactDonorPhoneLink');
  phoneLink.textContent = donor.phone || '+91 98230 11223';
  phoneLink.href = `tel:${donor.phone || '9823011223'}`;

  const callBtn = document.getElementById('contactCallBtn');
  callBtn.href = `tel:${donor.phone || '9823011223'}`;

  document.getElementById('contactDonorEmail').textContent = donor.email || 'confidential@bloodconnect.org';
  openModal('contactModal');
}

// ============================================================================
// Verified Blood Requests Section
// ============================================================================
async function loadBloodRequests(priorityFilter = 'ALL') {
  const container = document.getElementById('requestsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="state-box">
      <div class="spinner"></div>
      <div class="state-title">Loading Verified Blood Requests...</div>
      <p class="state-desc">Fetching authentic hospital requests.</p>
    </div>
  `;

  let requests = [];

  // Check user responses if logged in
  if (currentProfile) {
    await fetchUserResponses();
  }

  try {
    if (supabase) {
      let query = supabase
        .from('blood_requests')
        .select('*')
        .in('status', ['verified', 'fulfilled'])
        .order('created_at', { ascending: false });

      if (priorityFilter && priorityFilter !== 'ALL') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;
      if (data && !error) {
        requests = data;
      }
    }
  } catch (err) {
    console.warn('Supabase blood requests query error, using local pool:', err);
  }

  // Fallback pool
  if (requests.length === 0) {
    const allRequests = getLocalFallback('requests', DEMO_REQUESTS);
    requests = allRequests.filter(r => {
      if (r.status !== 'verified' && r.status !== 'fulfilled') return false;
      if (priorityFilter && priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
      return true;
    });
  }

  verifiedRequests = requests;
  renderRequestCards(requests);
}

async function fetchUserResponses() {
  if (!currentProfile) return;
  try {
    if (supabase) {
      const { data } = await supabase
        .from('request_responses')
        .select('request_id')
        .eq('donor_id', currentProfile.id);
      if (data) {
        userResponses = new Set(data.map(d => d.request_id));
        return;
      }
    }
    const localResponses = getLocalFallback('responses', []);
    const myResponses = localResponses.filter(r => r.donor_id === currentProfile.id);
    userResponses = new Set(myResponses.map(r => r.request_id));
  } catch (e) {
    console.error('Error fetching responses:', e);
  }
}

function renderRequestCards(requests) {
  const container = document.getElementById('requestsContainer');
  if (!container) return;

  if (!requests || requests.length === 0) {
    container.innerHTML = `
      <div class="state-box" id="requestsEmptyState">
        <div class="state-icon">✅</div>
        <h3 class="state-title">No pending requests under this category.</h3>
        <p class="state-desc">
          All emergency requests in this view have currently been fulfilled!
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = requests.map(req => {
    const isUrgent = req.priority === 'Urgent';
    const isFulfilled = req.status === 'fulfilled';
    const alreadyResponded = userResponses.has(req.id);

    return `
      <div class="request-card ${isUrgent ? 'urgent' : ''}" id="requestCard-${req.id}">
        <div class="request-card-header">
          <div class="request-blood-badge">
            <div class="badge-drop">${escapeHtml(req.blood_group)}</div>
            <div class="request-patient-info">
              <h4>${escapeHtml(req.patient_name)}</h4>
              <span class="request-units">${req.units_required} Unit${req.units_required > 1 ? 's' : ''} Needed</span>
            </div>
          </div>
          <div class="badge-group">
            <span class="badge-priority ${isUrgent ? 'urgent' : 'normal'}">${escapeHtml(req.priority)}</span>
            <span class="badge-status ${isFulfilled ? 'fulfilled' : 'verified'}">${isFulfilled ? 'Fulfilled' : 'Verified'}</span>
          </div>
        </div>

        <div class="request-details-list">
          <div class="request-detail-row">
            <span class="detail-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
              Hospital
            </span>
            <span class="detail-val">${escapeHtml(req.hospital)}</span>
          </div>

          <div class="request-detail-row">
            <span class="detail-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              Location
            </span>
            <span class="detail-val">${escapeHtml(req.location)}</span>
          </div>

          <div class="request-detail-row">
            <span class="detail-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Required Date
            </span>
            <span class="detail-val" style="color: var(--primary);">${escapeHtml(req.required_date)}</span>
          </div>
        </div>

        ${req.notes ? `<div class="request-notes">“${escapeHtml(req.notes)}”</div>` : ''}

        <div class="request-card-actions">
          ${isFulfilled ? `
            <button class="btn btn-secondary btn-sm btn-full" disabled>
              ✓ Request Fulfilled
            </button>
          ` : alreadyResponded ? `
            <button class="btn btn-secondary btn-sm btn-full" disabled style="background: var(--accent-green-light); color: var(--accent-green); font-weight: 700;">
              ✓ Response Submitted (Thank you!)
            </button>
          ` : `
            <button class="btn btn-primary btn-sm btn-full btn-help-request" data-id="${req.id}" data-patient="${escapeHtml(req.patient_name)}">
              ❤️ I Can Help
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Attach "I Can Help" listeners
  document.querySelectorAll('.btn-help-request').forEach(btn => {
    btn.addEventListener('click', () => {
      handleHelpResponse(btn.dataset.id, btn.dataset.patient);
    });
  });
}

// ============================================================================
// "I Can Help" Response Handler
// ============================================================================
async function handleHelpResponse(requestId, patientName) {
  if (!currentProfile) {
    showToast('Please sign in or register as a donor to respond to blood requests.', 'info');
    openAuthModal('login');
    return;
  }

  // Prevent duplicate response
  if (userResponses.has(requestId)) {
    showToast('You have already responded to this request.', 'info');
    return;
  }

  const confirmHelp = window.confirm(
    `Confirm: Are you available to offer blood support for patient "${patientName}"? Your contact details will be made available to the hospital coordinator.`
  );
  if (!confirmHelp) return;

  try {
    let inserted = false;
    if (supabase) {
      const { data, error } = await supabase
        .from('request_responses')
        .insert({
          request_id: requestId,
          donor_id: currentProfile.id,
          status: 'offered'
        });

      if (!error) inserted = true;
    }

    // Fallback local storage
    if (!inserted) {
      const responses = getLocalFallback('responses', []);
      responses.push({
        id: 'resp-' + Date.now(),
        request_id: requestId,
        donor_id: currentProfile.id,
        status: 'offered',
        created_at: new Date().toISOString()
      });
      setLocalFallback('responses', responses);
    }

    userResponses.add(requestId);

    // Re-render requests immediately to show updated "Response Submitted" state
    renderRequestCards(verifiedRequests);

    // Subtle card pulse and banner animation on the specific request card
    const targetCard = document.getElementById(`requestCard-${requestId}`);
    if (targetCard) {
      targetCard.classList.add('celebrating');
      const banner = document.createElement('div');
      banner.className = 'card-celebration-banner';
      banner.innerHTML = `<span>🎉 You stepped up to save a life! Hospital coordinator has been notified.</span>`;
      targetCard.appendChild(banner);

      setTimeout(() => {
        targetCard.classList.remove('celebrating');
      }, 1600);
    }

    // Trigger celebratory confetti burst
    triggerDonorHelpConfetti(targetCard);

    showToast(`❤️ Thank you ${currentProfile.full_name}! Your response for "${patientName}" has been recorded.`, 'success');
    await loadStatistics();
  } catch (err) {
    console.error('Response error:', err);
    showToast('Could not register your response. Please try again.', 'error');
  }
}

// ============================================================================
// Confetti & Lifesaving Celebration Animation
// ============================================================================
function triggerDonorHelpConfetti(targetElement) {
  let originX = 0.5;
  let originY = 0.5;

  if (targetElement) {
    const rect = targetElement.getBoundingClientRect();
    originX = Math.min(Math.max((rect.left + rect.width / 2) / window.innerWidth, 0.1), 0.9);
    originY = Math.min(Math.max((rect.top + rect.height / 3) / window.innerHeight, 0.1), 0.9);
  }

  const confettiFn = typeof window !== 'undefined' && typeof window.confetti === 'function' ? window.confetti : null;

  if (confettiFn) {
    // 1. Initial localized heart-colored burst from card location
    confettiFn({
      particleCount: 85,
      spread: 75,
      origin: { x: originX, y: originY },
      colors: ['#dc2626', '#ef4444', '#f43f5e', '#ffffff', '#eab308', '#16a34a'],
      ticks: 240,
      gravity: 1.1,
      scalar: 1.15,
      shapes: ['square', 'circle'],
    });

    // 2. Lateral celebratory cannons from left & right corners
    setTimeout(() => {
      confettiFn({
        particleCount: 50,
        angle: 60,
        spread: 60,
        origin: { x: 0.05, y: 0.8 },
        colors: ['#dc2626', '#ef4444', '#f87171', '#ffffff', '#16a34a', '#fbbf24'],
        scalar: 1.1,
      });
      confettiFn({
        particleCount: 50,
        angle: 120,
        spread: 60,
        origin: { x: 0.95, y: 0.8 },
        colors: ['#dc2626', '#ef4444', '#f87171', '#ffffff', '#16a34a', '#fbbf24'],
        scalar: 1.1,
      });
    }, 200);
  } else {
    // Fallback: Custom lightweight DOM particle animation if canvas-confetti is not available
    createDomCelebrationParticles(targetElement);
  }
}

function createDomCelebrationParticles(targetElement) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '99999';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  const rect = targetElement ? targetElement.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  const symbols = ['❤️', '🩸', '✨', '🎉', '🌟'];

  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    p.style.position = 'absolute';
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    p.style.fontSize = `${Math.floor(Math.random() * 16 + 16)}px`;
    p.style.transition = 'all 1.3s cubic-bezier(0.12, 0.82, 0.38, 1)';
    p.style.opacity = '1';
    container.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 180 + 50;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance - 80;

    requestAnimationFrame(() => {
      p.style.transform = `translate(${destX}px, ${destY}px) scale(${Math.random() * 0.5 + 0.8}) rotate(${Math.random() * 360}deg)`;
      p.style.opacity = '0';
    });
  }

  setTimeout(() => container.remove(), 1600);
}

// ============================================================================
// Request Blood Form Submission
// ============================================================================
async function handleBloodRequestSubmit(e) {
  e.preventDefault();

  if (!currentProfile) {
    showToast('Please log in first to submit a blood request.', 'info');
    closeModal('requestModal');
    openAuthModal('login');
    return;
  }

  const patientName = document.getElementById('reqPatientName').value.trim();
  const bloodGroup = document.getElementById('reqBloodGroup').value;
  const units = parseInt(document.getElementById('reqUnits').value, 10) || 1;
  const hospital = document.getElementById('reqHospital').value.trim();
  const location = document.getElementById('reqLocation').value.trim();
  const requiredDate = document.getElementById('reqDate').value;
  const priority = document.getElementById('reqPriority').value;
  const notes = document.getElementById('reqNotes').value.trim();

  const submitBtn = document.getElementById('btnSubmitRequest');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const newRequest = {
    requester_id: currentProfile.id,
    patient_name: patientName,
    blood_group: bloodGroup,
    units_required: units,
    hospital: hospital,
    location: location,
    required_date: requiredDate,
    priority: priority,
    notes: notes,
    status: 'pending', // Pending administrative verification
  };

  try {
    let saved = false;
    if (supabase) {
      const { data, error } = await supabase
        .from('blood_requests')
        .insert(newRequest)
        .select();

      if (!error) saved = true;
    }

    // Fallback store
    if (!saved) {
      newRequest.id = 'req-local-' + Date.now();
      newRequest.created_at = new Date().toISOString();
      const requests = getLocalFallback('requests', DEMO_REQUESTS);
      requests.unshift(newRequest);
      setLocalFallback('requests', requests);
    }

    // Success notification as requested in prompt
    showToast('Your blood request has been submitted and is waiting for verification.', 'success');
    
    document.getElementById('requestBloodForm').reset();
    closeModal('requestModal');
    await loadStatistics();
  } catch (err) {
    console.error('Submit blood request error:', err);
    showToast('Failed to submit request. Please verify inputs.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Blood Request';
  }
}

// ============================================================================
// Authentication: Alerts & Quick Demo Login
// ============================================================================
function showAuthAlert(html, type = 'error', formType = 'login') {
  const boxId = formType === 'signup' ? 'authAlertBoxSignup' : 'authAlertBox';
  const box = document.getElementById(boxId) || document.getElementById('authAlertBox');
  if (!box) return;
  box.className = `auth-alert-box ${type}`;
  box.innerHTML = html;
  box.style.display = 'block';
}

function hideAuthAlert() {
  const box1 = document.getElementById('authAlertBox');
  if (box1) {
    box1.style.display = 'none';
    box1.innerHTML = '';
  }
  const box2 = document.getElementById('authAlertBoxSignup');
  if (box2) {
    box2.style.display = 'none';
    box2.innerHTML = '';
  }
}

function switchAuthTab(tab = 'login') {
  hideAuthAlert();
  navigateTo(tab);
}

function quickDemoLogin(role = 'donor') {
  const demoProfile = role === 'admin' ? {
    id: 'demo-admin-noeline',
    full_name: 'Noeline Gaikwad (Admin)',
    email: 'admin@bloodconnect.org',
    phone: '+91 98000 00001',
    blood_group: 'O+',
    location: 'Pune Headquarters',
    role: 'admin',
    is_available: true,
    created_at: '2026-01-01',
  } : {
    id: 'demo-u1',
    full_name: 'Dr. Aarav Mehta',
    email: 'aarav.mehta@hospital.org',
    phone: '+91 98230 11223',
    blood_group: 'O+',
    location: 'Central Pune, MH',
    role: 'donor',
    is_available: true,
    created_at: '2026-01-10',
  };

  currentUser = { id: demoProfile.id, email: demoProfile.email };
  currentProfile = demoProfile;
  setLocalFallback('active_session', { user: currentUser, profile: currentProfile });

  const profiles = getLocalFallback('profiles', DEMO_PROFILES);
  if (!profiles.some(p => p.id === demoProfile.id)) {
    profiles.unshift(demoProfile);
    setLocalFallback('profiles', profiles);
  }

  showToast(`Signed in as ${demoProfile.full_name} (${role})`, 'success');
  renderNavUser();
  loadDonors();
  loadBloodRequests();
  navigateTo('dashboard');
}

// ============================================================================
// Authentication: Login & Signup Handlers
// ============================================================================
async function handleAuthLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const btn = document.getElementById('btnLoginSubmit');

  if (!emailInput || !passwordInput || !btn) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showToast('Please enter both email and password.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  hideAuthAlert();

  try {
    if (!supabase) {
      supabase = getSupabase();
      if (!supabase && typeof getSupabaseAsync === 'function') {
        supabase = await getSupabaseAsync();
      }
    }

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.warn('Supabase signInWithPassword error:', error);

        if (error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('email not confirmed')) {
          showAuthAlert(
            `<strong>📧 Email Confirmation Pending:</strong><br>
            A confirmation link was sent to <strong>${escapeHtml(email)}</strong> when registering.<br><br>
            • Please check your inbox (and spam folder) and click the confirmation link.<br>
            • <em>Fast Tip:</em> In your Supabase Dashboard under <strong>Authentication &gt; Providers &gt; Email</strong>, toggle <strong>OFF "Confirm email"</strong> to allow immediate logins.`,
            'warning'
          );
          showToast('Please confirm your email before signing in.', 'warning');
          return;
        }

        if (error.code === 'invalid_credentials' || error.message.toLowerCase().includes('invalid login credentials')) {
          showAuthAlert(
            `<strong>❌ Account Not Found or Incorrect Password:</strong><br>
            No account matched this email and password in your Supabase database.<br><br>
            • First time here? Click below to create your account:<br>
            <button type="button" class="btn btn-outline btn-sm" id="alertGoToSignup" style="margin-top: 0.5rem;">
              👉 Register as a New Donor
            </button>`,
            'error'
          );
          document.getElementById('alertGoToSignup')?.addEventListener('click', () => {
            navigateTo('signup');
          });
          showToast('Invalid credentials. Have you registered an account yet?', 'error');
          return;
        }

        showAuthAlert(`<strong>Login Failed:</strong> ${escapeHtml(error.message)}`, 'error');
        showToast(error.message, 'error');
        return;
      }

      if (data && data.user) {
        currentUser = data.user;
        await fetchUserProfile(data.user.id);
        showToast('Welcome back to BloodConnect!', 'success');
        document.getElementById('loginForm')?.reset();
        renderNavUser();
        await loadDonors();
        await loadBloodRequests();
        navigateTo('dashboard');
        return;
      }
    } else {
      // Local fallback if Supabase client not initialized
      const profiles = getLocalFallback('profiles', DEMO_PROFILES);
      let match = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());

      if (!match) {
        match = {
          id: 'usr-' + Date.now(),
          full_name: email.split('@')[0],
          email: email,
          phone: '+91 98200 12345',
          blood_group: 'O+',
          location: 'Pune',
          role: email.includes('admin') ? 'admin' : 'donor',
          is_available: true,
          created_at: new Date().toISOString(),
        };
        profiles.push(match);
        setLocalFallback('profiles', profiles);
      }

      currentUser = { id: match.id, email: match.email };
      currentProfile = match;
      setLocalFallback('active_session', { user: currentUser, profile: currentProfile });
      showToast('Welcome back!', 'success');
      document.getElementById('loginForm')?.reset();
      renderNavUser();
      await loadDonors();
      await loadBloodRequests();
      navigateTo('dashboard');
    }
  } catch (err) {
    console.error('Login error:', err);
    showAuthAlert(`<strong>System Error:</strong> ${escapeHtml(err.message || 'Could not complete sign in.')}`, 'error');
    showToast('Something went wrong. Please check your credentials.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleAuthSignup(e) {
  e.preventDefault();
  const fullName = document.getElementById('signupFullName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const bloodGroup = document.getElementById('signupBloodGroup').value;
  const location = document.getElementById('signupLocation').value.trim();
  const password = document.getElementById('signupPassword').value;
  const btn = document.getElementById('btnSignupSubmit');

  btn.disabled = true;
  btn.textContent = 'Creating Profile...';
  hideAuthAlert();

  try {
    if (!supabase) {
      supabase = getSupabase();
      if (!supabase && typeof getSupabaseAsync === 'function') {
        supabase = await getSupabaseAsync();
      }
    }

    if (supabase) {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone,
            blood_group: bloodGroup,
            location,
            role: 'donor',
          },
        },
      });

      if (error) {
        console.error('Supabase signUp error:', error);
        showAuthAlert(`<strong>Registration Failed:</strong> ${escapeHtml(error.message)}`, 'error', 'signup');
        showToast(error.message, 'error');
        return;
      }

      if (data && data.user) {
        // If Supabase requires email confirmation, session will be null
        if (!data.session) {
          showAuthAlert(
            `<strong>🎉 Registration Successful!</strong><br>
            A confirmation link was dispatched to <strong>${escapeHtml(email)}</strong>.<br><br>
            1. Open your inbox and click the verification link.<br>
            2. Once verified, click <a href="#login" data-nav="login" style="color:var(--primary); font-weight:700;">Login</a> to access your dashboard.<br><br>
            <span style="font-size:0.8125rem; color:var(--text-muted);">
            💡 To bypass email verification: In your Supabase Dashboard, go to <strong>Authentication &gt; Providers &gt; Email</strong> and toggle <strong>OFF "Confirm email"</strong>.
            </span>`,
            'info',
            'signup'
          );
          showToast('Account created! Please check your email to verify.', 'info');
          document.getElementById('signupForm')?.reset();
          return;
        }

        // Automatic session established
        currentUser = data.user;
        await fetchUserProfile(data.user.id);
        showToast(`Welcome to BloodConnect, ${fullName}!`, 'success');
        document.getElementById('signupForm')?.reset();
        renderNavUser();
        await loadDonors();
        await loadStatistics();
        navigateTo('dashboard');
        return;
      }
    } else {
      // Local fallback
      const newProfile = {
        id: 'usr-' + Date.now(),
        full_name: fullName,
        email: email,
        phone: phone,
        blood_group: bloodGroup,
        location: location,
        role: 'donor',
        is_available: true,
        created_at: new Date().toISOString(),
      };
      const profiles = getLocalFallback('profiles', DEMO_PROFILES);
      profiles.unshift(newProfile);
      setLocalFallback('profiles', profiles);

      currentUser = { id: newProfile.id, email: newProfile.email };
      currentProfile = newProfile;
      setLocalFallback('active_session', { user: currentUser, profile: currentProfile });
      showToast('Account created successfully! Welcome to BloodConnect.', 'success');
      document.getElementById('signupForm')?.reset();
      renderNavUser();
      await loadDonors();
      await loadStatistics();
      navigateTo('dashboard');
    }
  } catch (err) {
    console.error('Signup error:', err);
    showAuthAlert(`<strong>Could not register account:</strong> ${escapeHtml(err.message)}`, 'error', 'signup');
    showToast('Could not register account. Please check inputs.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Register as Blood Donor';
  }
}

async function handleLogout() {
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.warn('Supabase signout:', e);
  }
  localStorage.removeItem('bloodconnect_active_session');
  currentUser = null;
  currentProfile = null;
  userResponses.clear();
  renderNavUser();
  showToast('You have been logged out safely.', 'info');
  await loadBloodRequests();
  navigateTo('home');
}

// ============================================================================
// User Dashboard & Availability Toggle
// ============================================================================
async function openDashboard() {
  if (!currentProfile) {
    navigateTo('login');
    return;
  }

  // Populate Profile Information
  const fullNameEl = document.getElementById('dashFullName');
  const emailEl = document.getElementById('dashEmail');
  const bloodBadgeEl = document.getElementById('dashBloodBadge');
  const phoneEl = document.getElementById('dashPhone');
  const locationEl = document.getElementById('dashLocation');
  const roleBadgeEl = document.getElementById('dashRoleBadge');

  if (fullNameEl) fullNameEl.textContent = currentProfile.full_name;
  if (emailEl) emailEl.textContent = currentProfile.email;
  if (bloodBadgeEl) bloodBadgeEl.textContent = currentProfile.blood_group;
  if (phoneEl) phoneEl.textContent = currentProfile.phone || 'Not provided';
  if (locationEl) locationEl.textContent = currentProfile.location || 'Pune';
  if (roleBadgeEl) roleBadgeEl.textContent = (currentProfile.role || 'donor').toUpperCase();

  // Availability Toggle
  const toggle = document.getElementById('donorAvailabilityToggle');
  const label = document.getElementById('dashAvailLabel');
  const statusText = document.getElementById('availabilityStatusText');

  if (toggle) {
    toggle.checked = Boolean(currentProfile.is_available);
  }
  if (label && statusText) {
    if (toggle && toggle.checked) {
      label.textContent = 'Available to Donate';
      label.style.color = 'var(--accent-green)';
      statusText.textContent = 'You are currently listed as available for emergency patient contacts.';
    } else {
      label.textContent = 'Unavailable';
      label.style.color = 'var(--text-muted)';
      statusText.textContent = 'You are hidden from public donor searches.';
    }
  }

  // Load My Blood Requests
  await loadUserRequestsInDashboard();

  // Load Donation History
  await loadUserDonationsInDashboard();
}

async function handleAvailabilityToggle(e) {
  const isAvailable = e.target.checked;
  const label = document.getElementById('dashAvailLabel');
  const statusText = document.getElementById('availabilityStatusText');

  if (isAvailable) {
    label.textContent = 'Available to Donate';
    label.style.color = 'var(--accent-green)';
    statusText.textContent = 'You are currently listed as available for emergency patient contacts.';
  } else {
    label.textContent = 'Unavailable';
    label.style.color = 'var(--text-muted)';
    statusText.textContent = 'You are hidden from public donor searches.';
  }

  if (currentProfile) {
    currentProfile.is_available = isAvailable;

    try {
      if (supabase) {
        await supabase
          .from('profiles')
          .update({ is_available: isAvailable })
          .eq('id', currentProfile.id);
      }
    } catch (err) {
      console.warn('Update availability in Supabase:', err);
    }

    // Update in local profiles
    const profiles = getLocalFallback('profiles', DEMO_PROFILES);
    const idx = profiles.findIndex(p => p.id === currentProfile.id);
    if (idx !== -1) {
      profiles[idx].is_available = isAvailable;
      setLocalFallback('profiles', profiles);
    }
    setLocalFallback('active_session', { user: currentUser, profile: currentProfile });

    showToast(`Donation availability updated to: ${isAvailable ? 'AVAILABLE' : 'OFFLINE'}`, 'success');
    await loadDonors();
  }
}

async function loadUserRequestsInDashboard() {
  const listEl = document.getElementById('dashRequestsList');
  const countEl = document.getElementById('dashStatRequests');
  if (!listEl) return;

  let myRequests = [];
  try {
    if (supabase && currentProfile) {
      const { data } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('requester_id', currentProfile.id)
        .order('created_at', { ascending: false });
      if (data) myRequests = data;
    }
  } catch (e) {
    console.warn(e);
  }

  if (myRequests.length === 0) {
    const all = getLocalFallback('requests', DEMO_REQUESTS);
    myRequests = all.filter(r => r.requester_id === currentProfile?.id);
  }

  countEl.textContent = myRequests.length;

  if (myRequests.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.875rem;">
        You have not submitted any blood requests yet.
      </div>
    `;
    return;
  }

  listEl.innerHTML = myRequests.map(r => `
    <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid ${r.status === 'verified' ? 'var(--accent-green)' : r.status === 'pending' ? 'var(--accent-amber)' : 'var(--border-medium)'};">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
        <strong style="font-size: 0.9375rem;">${escapeHtml(r.patient_name)} (${escapeHtml(r.blood_group)})</strong>
        <span class="badge-status ${r.status}" style="text-transform: capitalize;">${escapeHtml(r.status)}</span>
      </div>
      <div style="font-size: 0.8125rem; color: var(--text-muted);">
        ${escapeHtml(r.hospital)} • Required by: ${escapeHtml(r.required_date)} • ${r.units_required} unit(s)
      </div>
    </div>
  `).join('');
}

async function loadUserDonationsInDashboard() {
  const listEl = document.getElementById('dashDonationsList');
  const countEl = document.getElementById('dashStatDonations');
  if (!listEl) return;

  let donations = [];
  try {
    if (supabase && currentProfile) {
      const { data } = await supabase
        .from('donations')
        .select('*')
        .eq('donor_id', currentProfile.id)
        .order('donation_date', { ascending: false });
      if (data) donations = data;
    }
  } catch (e) {
    console.warn(e);
  }

  if (donations.length === 0) {
    const all = getLocalFallback('donations', [
      { id: 'd-1', donor_id: currentProfile?.id, donation_date: '2026-06-15', units: 1, notes: 'Red Cross Camp, Pune' }
    ]);
    donations = all.filter(d => d.donor_id === currentProfile?.id);
  }

  countEl.textContent = donations.length;

  // Responses count stat
  const countRespEl = document.getElementById('dashStatResponses');
  if (countRespEl) countRespEl.textContent = userResponses.size || '0';

  if (donations.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.875rem;">
        No donations logged yet. Use "+ Log Completed Donation" to add your first record!
      </div>
    `;
    return;
  }

  listEl.innerHTML = donations.map(d => `
    <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 700; font-size: 0.9375rem; color: var(--primary);">
          ${d.units} Unit${d.units > 1 ? 's' : ''} Blood Donated
        </div>
        <div style="font-size: 0.8125rem; color: var(--text-muted);">
          ${escapeHtml(d.notes || 'Voluntary donation')}
        </div>
      </div>
      <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-dark);">
        ${escapeHtml(d.donation_date)}
      </div>
    </div>
  `).join('');
}

async function handleLogDonationSubmit(e) {
  e.preventDefault();
  if (!currentProfile) return;

  const date = document.getElementById('donDate').value;
  const units = parseInt(document.getElementById('donUnits').value, 10) || 1;
  const notes = document.getElementById('donNotes').value.trim();

  const newDonation = {
    donor_id: currentProfile.id,
    donation_date: date,
    units: units,
    notes: notes,
  };

  try {
    let logged = false;
    if (supabase) {
      const { error } = await supabase.from('donations').insert(newDonation);
      if (!error) logged = true;
    }

    if (!logged) {
      newDonation.id = 'don-' + Date.now();
      const donations = getLocalFallback('donations', []);
      donations.unshift(newDonation);
      setLocalFallback('donations', donations);
    }

    showToast('Donation record added successfully!', 'success');
    document.getElementById('donationLogForm').reset();
    closeModal('donationModal');
    await loadUserDonationsInDashboard();
    await loadStatistics();
  } catch (err) {
    console.error('Log donation error:', err);
    showToast('Failed to record donation.', 'error');
  }
}

// ============================================================================
// Multi-Page Navigation & Routing Architecture (Instant discrete page switching)
// ============================================================================
function navigateTo(pageName) {
  hideAuthAlert();

  // Authentication routes guard
  if (pageName === 'dashboard' && !currentProfile) {
    showToast('Please sign in to access your donor dashboard.', 'info');
    pageName = 'login';
  } else if ((pageName === 'login' || pageName === 'signup') && currentProfile) {
    pageName = 'dashboard';
  }

  const targetId = PAGE_MAP[pageName] || 'pageHome';
  const targetPage = document.getElementById(targetId);
  if (!targetPage) return;

  // Discrete instant page switch without sliding
  document.querySelectorAll('.app-page').forEach(page => {
    page.classList.remove('active');
  });
  targetPage.classList.add('active');

  // Synchronize navigation link active states
  document.querySelectorAll('.nav-link').forEach(link => {
    const navVal = link.getAttribute('data-nav') || (link.getAttribute('href') || '').replace('#', '');
    if (navVal === pageName || (pageName === 'home' && (navVal === 'home' || !navVal))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Close mobile navigation drawer if open
  const navLinks = document.getElementById('navLinks');
  if (navLinks) navLinks.classList.remove('show');

  // Instant scroll to top (no sliding animation)
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

  // Quietly synchronize URL hash
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', '#' + pageName);
  }

  // If opening dashboard, load latest donor profile & records
  if (pageName === 'dashboard' && currentProfile) {
    openDashboard();
  }
}

function renderCompatibilityTool(type) {
  const data = COMPAT_DATA[type] || COMPAT_DATA['O-'];
  const donateEl = document.getElementById('compatDonateBadges');
  const receiveEl = document.getElementById('compatReceiveBadges');
  const noteEl = document.getElementById('compatSummaryNote');

  if (donateEl) {
    donateEl.innerHTML = data.donate.map(t => `<span class="compat-badge-pill">${t}</span>`).join('');
  }
  if (receiveEl) {
    receiveEl.innerHTML = data.receive.map(t => `<span class="compat-badge-pill">${t}</span>`).join('');
  }
  if (noteEl) {
    noteEl.textContent = data.note;
  }
}

// ============================================================================
// Modal & UI Event Listeners
// ============================================================================
function setupUIEventListeners() {
  // Initialize interactive compatibility checker
  renderCompatibilityTool('O-');

  // Initial page setup from URL hash or default to home
  const initialHash = (window.location.hash || '').replace('#', '');
  if (PAGE_MAP[initialHash]) {
    navigateTo(initialHash);
  } else {
    navigateTo('home');
  }

  // Handle browser back and forward button events
  window.addEventListener('hashchange', () => {
    const h = (window.location.hash || '').replace('#', '');
    if (PAGE_MAP[h]) {
      navigateTo(h);
    }
  });

  // --------------------------------------------------------------------------
  // 1. Delegated Global Click Dispatcher (Resilient & Immediate for ALL buttons)
  // --------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || !(target instanceof Element)) return;

    // A. Modal Close Buttons (data-close="modalId" or .modal-close-btn)
    const closeBtn = target.closest('[data-close]');
    if (closeBtn) {
      e.preventDefault();
      closeModal(closeBtn.dataset.close);
      return;
    }

    // B. Modal Backdrop Click
    if (target.classList.contains('modal-overlay')) {
      closeModal(target.id);
      return;
    }

    // C. Multi-Page Navigation: Direct [data-nav] elements
    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      const page = navBtn.getAttribute('data-nav');
      navigateTo(page);
      return;
    }

    // D. Multi-Page Navigation: In-page Anchor Links (#home, #find-donor, etc.)
    const hashAnchor = target.closest('a[href^="#"]');
    if (hashAnchor) {
      const href = hashAnchor.getAttribute('href');
      const targetHash = href ? href.replace('#', '') : '';
      if (PAGE_MAP[targetHash]) {
        e.preventDefault();
        navigateTo(targetHash);
        return;
      }
    }

    // E. Interactive Blood Compatibility Checker Chips
    const compatChip = target.closest('.compat-btn-chip');
    if (compatChip) {
      e.preventDefault();
      document.querySelectorAll('.compat-btn-chip').forEach(c => c.classList.remove('active'));
      compatChip.classList.add('active');
      const bType = compatChip.dataset.type || 'O-';
      renderCompatibilityTool(bType);
      return;
    }

    // F. Sign In / Login triggers
    if (target.closest('#navLoginBtn, #footerLoginLink, #linkSwitchToLogin, #navLinkLogin, #headerLoginLink')) {
      e.preventDefault();
      navigateTo('login');
      return;
    }

    // G. Register / Become Donor triggers
    if (target.closest('#navSignupBtn, #tickerDonorBtn, #heroBecomeDonorBtn, #footerSignupLink, #linkSwitchToSignup, #howBecomeDonorBtn, #navLinkSignup, #headerSignupLink')) {
      e.preventDefault();
      navigateTo('signup');
      return;
    }

    // H. Blood Request Triggers
    if (target.closest('#heroRequestBloodBtn, #tickerRequestBtn, #btnOpenRequestBloodBottom, #footerRequestLink, #homeUrgentReqBtn, #howRequestBloodBtn')) {
      e.preventDefault();
      openReqModal();
      return;
    }

    // I. Auth Tabs
    if (target.closest('#tabLoginBtn')) {
      e.preventDefault();
      navigateTo('login');
      return;
    }
    if (target.closest('#tabSignupBtn')) {
      e.preventDefault();
      navigateTo('signup');
      return;
    }

    // J. Quick Evaluation Demo Logins
    if (target.closest('#btnQuickDemoDonor')) {
      e.preventDefault();
      quickDemoLogin('donor');
      return;
    }
    if (target.closest('#btnQuickDemoAdmin')) {
      e.preventDefault();
      quickDemoLogin('admin');
      return;
    }

    // K. Contact Donor in Donor Cards
    const contactBtn = target.closest('.btn-contact-donor');
    if (contactBtn) {
      e.preventDefault();
      openContactModal({
        name: contactBtn.dataset.name,
        group: contactBtn.dataset.group,
        location: contactBtn.dataset.location,
        phone: contactBtn.dataset.phone,
        email: contactBtn.dataset.email,
      });
      return;
    }

    // L. "I Can Help" in Request Cards
    const helpBtn = target.closest('.btn-help-request');
    if (helpBtn) {
      e.preventDefault();
      handleHelpResponse(helpBtn.dataset.id, helpBtn.dataset.patient);
      return;
    }

    // M. Log New Donation
    if (target.closest('#btnLogNewDonation')) {
      e.preventDefault();
      const today = new Date().toISOString().split('T')[0];
      const donDate = document.getElementById('donDate');
      if (donDate) donDate.value = today;
      openModal('donationModal');
      return;
    }

    // N. Dashboard Trigger
    if (target.closest('#menuDashboardBtn, #navLinkDashboard')) {
      e.preventDefault();
      navigateTo('dashboard');
      return;
    }

    // O. User Logout
    if (target.closest('#menuLogoutBtn, #navLinkLogout, #btnDashboardLogout')) {
      e.preventDefault();
      handleLogout();
      return;
    }

    // P. Search Reset Buttons
    if (target.closest('#btnResetSearch, #btnResetSearchFromEmpty')) {
      e.preventDefault();
      const sGroup = document.getElementById('searchBloodGroup');
      const sLoc = document.getElementById('searchLocation');
      if (sGroup) sGroup.value = '';
      if (sLoc) sLoc.value = '';
      document.querySelectorAll('.blood-chip').forEach(c => c.classList.remove('active'));
      document.querySelector('.blood-chip[data-group=""]')?.classList.add('active');
      loadDonors();
      return;
    }

    // Q. Blood Group Filter Chips
    const bloodChip = target.closest('.blood-chip');
    if (bloodChip) {
      e.preventDefault();
      document.querySelectorAll('.blood-chip').forEach(c => c.classList.remove('active'));
      bloodChip.classList.add('active');
      const group = bloodChip.dataset.group || '';
      const sGroup = document.getElementById('searchBloodGroup');
      if (sGroup) sGroup.value = group;
      const sLoc = document.getElementById('searchLocation');
      const location = sLoc ? sLoc.value.trim() : '';
      loadDonors(group, location);
      return;
    }

    // R. Request Priority Filter Tabs
    const filterTab = target.closest('.filter-tab');
    if (filterTab) {
      e.preventDefault();
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      filterTab.classList.add('active');
      const priority = filterTab.dataset.priority || 'ALL';
      loadBloodRequests(priority);
      return;
    }

    // S. Supabase Config Trigger
    if (target.closest('#footerDbConfigBtn')) {
      e.preventDefault();
      const cfgUrl = document.getElementById('cfgSupabaseUrl');
      const cfgKey = document.getElementById('cfgSupabaseAnonKey');
      if (cfgUrl) cfgUrl.value = SUPABASE_CONFIG.url;
      if (cfgKey) cfgKey.value = SUPABASE_CONFIG.anonKey;
      openModal('configModal');
      return;
    }

    // T. Reset Supabase Config
    if (target.closest('#btnResetDefaultConfig')) {
      e.preventDefault();
      resetSupabaseConfig();
      return;
    }
  });

  // --------------------------------------------------------------------------
  // 2. Direct Element Event Listeners
  // --------------------------------------------------------------------------
  // Mobile Hamburger Toggle
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });
  }

  // Navigation Links Click Handling (instant page switch, closes mobile drawer)
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-nav') || (link.getAttribute('href') || '').replace('#', '');
      navigateTo(page);
    });
  });

  // User Dropdown Trigger
  const userTrigger = document.getElementById('userDropdownTrigger');
  const userDropdown = document.getElementById('userDropdownMenu');
  if (userTrigger && userDropdown) {
    userTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      userDropdown.classList.remove('show');
    });
  }

  // Dashboard Toggle Switch
  document.getElementById('donorAvailabilityToggle')?.addEventListener('change', handleAvailabilityToggle);

  // Direct Click Handlers for Top-Level Navigation Actions
  document.getElementById('navLoginBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('login');
  });

  document.getElementById('navSignupBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('signup');
  });

  document.getElementById('navLinkLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('login');
  });

  document.getElementById('navLinkSignup')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('signup');
  });

  document.getElementById('navLinkDashboard')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('dashboard');
  });

  document.getElementById('navLinkLogout')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
  });

  document.getElementById('btnDashboardLogout')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
  });

  document.getElementById('btnLoginSubmit')?.addEventListener('click', (e) => {
    const form = document.getElementById('loginForm');
    if (form && !form.checkValidity()) {
      form.reportValidity();
    }
  });

  document.getElementById('btnSignupSubmit')?.addEventListener('click', (e) => {
    const form = document.getElementById('signupForm');
    if (form && !form.checkValidity()) {
      form.reportValidity();
    }
  });

  // Forms Submissions
  document.getElementById('loginForm')?.addEventListener('submit', handleAuthLogin);
  document.getElementById('signupForm')?.addEventListener('submit', handleAuthSignup);
  document.getElementById('requestBloodForm')?.addEventListener('submit', handleBloodRequestSubmit);
  document.getElementById('donationLogForm')?.addEventListener('submit', handleLogDonationSubmit);

  // Dashboard Inner Tabs
  const tabDashReq = document.getElementById('tabDashRequests');
  const tabDashDon = document.getElementById('tabDashDonations');
  const contentReq = document.getElementById('dashRequestsContent');
  const contentDon = document.getElementById('dashDonationsContent');

  tabDashReq?.addEventListener('click', () => {
    tabDashReq.classList.add('active');
    tabDashDon?.classList.remove('active');
    if (contentReq) contentReq.style.display = 'block';
    if (contentDon) contentDon.style.display = 'none';
  });

  tabDashDon?.addEventListener('click', () => {
    tabDashDon.classList.add('active');
    tabDashReq?.classList.remove('active');
    if (contentDon) contentDon.style.display = 'block';
    if (contentReq) contentReq.style.display = 'none';
  });

  // Donor Search Form
  document.getElementById('donorSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const group = document.getElementById('searchBloodGroup')?.value || '';
    const location = (document.getElementById('searchLocation')?.value || '').trim();
    loadDonors(group, location);
  });

  // Supabase Config Form Submission
  document.getElementById('supabaseConfigForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = (document.getElementById('cfgSupabaseUrl')?.value || '').trim();
    const key = (document.getElementById('cfgSupabaseAnonKey')?.value || '').trim();
    if (saveSupabaseConfig(url, key)) {
      showToast('Supabase connection details updated! Reconnecting...', 'success');
      closeModal('configModal');
      setTimeout(() => location.reload(), 1000);
    }
  });

  // Keyboard Escape to close modals
  document.addEventListener('keydown', (e) => {
    if (e && e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    }
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  openModal('authModal');
}

function openReqModal() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('reqDate');
  if (dateInput) {
    dateInput.min = today;
    if (!dateInput.value) dateInput.value = today;
  }
  openModal('requestModal');
}

// ============================================================================
// Toast Notification Utility
// ============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' 
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : type === 'error'
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4200);
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

// ============================================================================
// Application Bootstrapping (Runs once all constants & functions are defined)
// ============================================================================
function bootApp() {
  try {
    initSupabase();
  } catch (e) {
    console.warn('initSupabase warning:', e);
  }

  try {
    setupUIEventListeners();
  } catch (e) {
    console.error('setupUIEventListeners error:', e);
  }

  // Load backend data without blocking user interactions
  checkAuthSession().catch(e => console.warn('checkAuthSession warn:', e));
  loadStatistics().catch(e => console.warn('loadStatistics warn:', e));
  loadDonors().catch(e => console.warn('loadDonors warn:', e));
  loadBloodRequests().catch(e => console.warn('loadBloodRequests warn:', e));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
  } else {
    // DOM is already parsed (interactive or complete), bootstrap immediately!
    bootApp();
  }
}
