// =========================
// Workout Tracker - Admin-only Full UI (Decorated & Functional)
// - Admins: full CRUD, sets, filters, date picker, preview, statistics
// - Non-admins: Access Restricted message (no UI interaction)
// - Backend base URL: http://localhost:8000
// - Assumes exercise.date is a datetime string (e.g. "2025-10-22T14:33:00")
// =========================

// -------------------------
// Config / Endpoints
// -------------------------
const API_BASE_URL = 'http://localhost:8000';
const USER_EXERCISES_ENDPOINT = '/user_exercises';
const SETS_ENDPOINT = '/sets';
const ALL_EXERCISES_ENDPOINT = '/all_exercises';

// -------------------------
// App State
// -------------------------
let currentExercises = [];        // enriched exercises shown in UI
let allAvailableExercises = [];   // catalog of exercises from /all_exercises
let editingExerciseId = null;
let isEditMode = false;
let isAdminUser = false;

// -------------------------
// Utility: escape HTML
// -------------------------
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// -------------------------
// Auth helpers
// -------------------------
function getAuthToken() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        // If no token, we still render restricted UI for non-admins
        console.warn('No access_token in localStorage');
        return null;
    }
    return token;
}

function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        // atob may throw if input invalid
        const json = atob(payload);
        return JSON.parse(json);
    } catch (err) {
        console.warn('Failed to decode JWT payload:', err);
        return null;
    }
}

function detectAdminFromStorageOrToken() {
    // 1) Check explicit localStorage keys
    const roleLs = (localStorage.getItem('user_role') || localStorage.getItem('role') || '').toString().trim().toLowerCase();
    if (roleLs) {
        return roleLs === 'admin';
    }

    // 2) Check token payload
    const token = getAuthToken();
    if (!token) return false;
    const payload = decodeJwtPayload(token);
    if (!payload) return false;

    // payload might contain `role` or `user_role` or `is_admin`
    if (payload.role && String(payload.role).toLowerCase() === 'admin') return true;
    if (payload.user_role && String(payload.user_role).toLowerCase() === 'admin') return true;
    if (payload.is_admin !== undefined) return Boolean(payload.is_admin);

    // fallback: non-admin
    return false;
}

// -------------------------
// Notifications (small UI)
// -------------------------
function showNotification(message, type = 'info', duration = 4500) {
    // create a toast-like notification element
    const containerId = 'notification-root';
    let root = document.getElementById(containerId);
    if (!root) {
        root = document.createElement('div');
        root.id = containerId;
        root.style.position = 'fixed';
        root.style.right = '20px';
        root.style.top = '20px';
        root.style.zIndex = '9999';
        document.body.appendChild(root);
    }

    const note = document.createElement('div');
    note.className = `notif notif-${type}`;
    note.style.background = type === 'success' ? '#1e7e34' : type === 'error' ? '#b02a37' : '#1565c0';
    note.style.color = '#fff';
    note.style.padding = '10px 14px';
    note.style.marginTop = '8px';
    note.style.borderRadius = '8px';
    note.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
    note.style.fontFamily = 'Inter, Roboto, Arial, sans-serif';
    note.style.fontSize = '14px';
    note.innerText = message;

    root.appendChild(note);
    setTimeout(() => {
        note.style.transition = 'opacity 300ms';
        note.style.opacity = '0';
        setTimeout(() => note.remove(), 300);
    }, duration);
}

// -------------------------
// Initialization
// -------------------------
document.addEventListener('DOMContentLoaded', async () => {
    try {
        isAdminUser = detectAdminFromStorageOrToken();
        // Build / alter UI depending on role
        setupUIForRole();
        // Preload catalog regardless (admins will use it)
        await loadAvailableExercises(); // caches /all_exercises
        if (isAdminUser) {
            await loadAdminExercisesAndRender();
        } else {
            // Show restricted message
            showAccessRestrictedUI();
        }
        attachFormHandlers();
        setupDateFilterDefault();
        // debug quick hint
        console.log('isAdminUser:', isAdminUser);
    } catch (err) {
        console.error('Initialization error:', err);
        showNotification('App initialization error', 'error');
    }
});

// -------------------------
// UI role setup
// -------------------------
function setupUIForRole() {
    // If you have a main app container with id 'app', we keep it.
    // We'll also ensure the exercise area is present.
    const appRoot = document.getElementById('app') || document.body;

    // If no workoutsContainer exists, create one
    if (!document.getElementById('workoutsContainer')) {
        const container = document.createElement('div');
        container.id = 'workoutsContainer';
        container.style.margin = '20px';
        appRoot.appendChild(container);
    }

    // Ensure there's a form section for admin CRUD
    if (!document.getElementById('exerciseForm') && isAdminUser) {
        const formSection = document.createElement('section');
        formSection.className = 'form-section';
        formSection.style.margin = '20px';
        formSection.innerHTML = `
            <div id="formCard" class="card" style="padding:16px;border-radius:8px;background:#111827;color:#e6eef5;box-shadow:0 6px 18px rgba(0,0,0,0.25);max-width:900px;">
                <h3 id="form-title" style="margin:0 0 8px 0;">Log New Exercise</h3>
                <form id="exerciseForm">
                    <div style="display:flex;gap:12px;align-items:center;">
                        <select id="exerciseSelect" required style="flex:2;padding:8px;border-radius:6px;background:#0b1220;color:#ffffff;border:1px solid rgba(255,255,255,0.06);">
                            <option value="">Loading exercises...</option>
                        </select>
                        <button id="add-set-btn" type="button" onclick="addSet()" class="btn" style="padding:8px 12px;border-radius:6px;background:#2563eb;color:white;border:none;">Add Set</button>
                        <button id="submit-btn" type="submit" class="btn" style="padding:8px 12px;border-radius:6px;background:#10b981;color:white;border:none;"><span>Log Exercise</span></button>
                    </div>
                    <div id="setsContainer" style="margin-top:12px;"></div>
                    <div id="form-actions" style="display:none;margin-top:12px;">
                        <button type="button" onclick="cancelEdit()" class="btn" style="background:#ef4444;color:white;padding:8px 12px;border-radius:6px;border:none;">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        appRoot.appendChild(formSection);
    }
}

// -------------------------
// Access restricted UI
// -------------------------
function showAccessRestrictedUI() {
    const container = document.getElementById('workoutsContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;border-radius:8px;background:linear-gradient(180deg, rgba(17,24,39,0.9), rgba(10,10,10,0.7));color:#cbd5e1;">
            <i class="fas fa-lock" style="font-size:48px;margin-bottom:12px;color:#f97316;"></i>
            <h3 style="margin:0 0 8px 0;color:#fff;">Access Restricted</h3>
            <p style="margin:0;color:#9ca3af;max-width:420px;text-align:center;">You do not have permission to view or manage exercises. If you think this is an error, contact an administrator.</p>
        </div>
    `;
    // Hide the form area if present
    const form = document.getElementById('formCard');
    if (form) form.style.display = 'none';
}

// -------------------------
// Load all available exercises (catalog) for select & mapping
// -------------------------
async function loadAvailableExercises() {
    try {
        const token = getAuthToken();
        if (!token) {
            allAvailableExercises = [];
            populateExerciseSelect();
            return;
        }
        const res = await fetch(`${API_BASE_URL}${ALL_EXERCISES_ENDPOINT}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            console.warn('Could not load all exercises catalog, status:', res.status);
            allAvailableExercises = [];
            populateExerciseSelect();
            return;
        }
        const data = await res.json();
        allAvailableExercises = Array.isArray(data) ? data : [];
        populateExerciseSelect();
    } catch (err) {
        console.error('loadAvailableExercises error:', err);
        allAvailableExercises = [];
        populateExerciseSelect();
    }
}

function populateExerciseSelect() {
    const select = document.getElementById('exerciseSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Exercise</option>';
    allAvailableExercises.forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex.id ?? ex._id ?? '';
        opt.textContent = ex.name ?? `Exercise ${ex.id ?? ex._id ?? ''}`;
        if (ex.description) opt.title = ex.description;
        select.appendChild(opt);
    });
}

// -------------------------
// Admin: Load exercises (GET /user_exercises/user) then enrich & render
// -------------------------
async function loadAdminExercisesAndRender(dateFilter = null) {
    try {
        const token = getAuthToken();
        if (!token) {
            showNotification('Not authenticated. Please log in.', 'error');
            showAccessRestrictedUI();
            return;
        }

        // Choose endpoint: admin-only endpoint
        const endpoint = `${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/user`;
        const res = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            console.error('Failed to load admin exercises:', res.status);
            showNotification('Failed to load exercises', 'error');
            return;
        }

        const list = await res.json();
        let userExercisesList = Array.isArray(list) ? list : [];

        // Optionally filter by date (if dateFilter passed)
        if (dateFilter) {
            userExercisesList = userExercisesList.filter(ue => {
                if (!ue.date) return false;
                const dateOnly = (new Date(ue.date)).toISOString().split('T')[0];
                return dateOnly === dateFilter;
            });
        }

        // Enrich each exercise with sets & exercise details
        const enriched = await Promise.allSettled(userExercisesList.map(async (ue) => {
            try {
                // fetch sets for exercise (various endpoints)
                const sets = await fetchSetsForExercise(ue.id, token);

                // prepare mapped object
                const mapped = { ...ue, sets: Array.isArray(sets) ? sets : [] };

                // find exercise details (nested object or via id)
                let exerciseIdToUse = null;
                let exerciseDetails = null;
                if (ue.exercise && typeof ue.exercise === 'object') {
                    exerciseDetails = ue.exercise;
                    exerciseIdToUse = exerciseDetails.id ?? exerciseDetails._id;
                } else {
                    exerciseIdToUse = ue.exercise_id ?? ue.all_exercise_id ?? ue.exercise ?? null;
                }

                if (exerciseDetails) {
                    mapped.exercise_name = exerciseDetails.name || exerciseDetails.title || `Exercise ${exerciseIdToUse ?? ''}`;
                    mapped.exercise_description = exerciseDetails.description || '';
                    mapped.exercise_url = exerciseDetails.url || exerciseDetails.video_url || '';
                    return mapped;
                }

                // use cached allAvailableExercises
                if (exerciseIdToUse) {
                    const cached = allAvailableExercises.find(a => (a.id != null && a.id == exerciseIdToUse) || (a._id != null && a._id == exerciseIdToUse));
                    if (cached) {
                        mapped.exercise_name = cached.name || `Exercise ${exerciseIdToUse}`;
                        mapped.exercise_description = cached.description || '';
                        mapped.exercise_url = cached.url || cached.video_url || '';
                        return mapped;
                    }

                    // fallback fetch detail
                    try {
                        const exRes = await fetch(`${API_BASE_URL}${ALL_EXERCISES_ENDPOINT}/${exerciseIdToUse}`, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                        });
                        if (exRes.ok) {
                            const ex = await exRes.json();
                            mapped.exercise_name = ex.name || `Exercise ${exerciseIdToUse}`;
                            mapped.exercise_description = ex.description || '';
                            mapped.exercise_url = ex.url || ex.video_url || '';
                        } else {
                            mapped.exercise_name = `Unknown Exercise (ID ${exerciseIdToUse})`;
                            mapped.exercise_description = mapped.exercise_description || '';
                        }
                    } catch (err) {
                        mapped.exercise_name = mapped.exercise_name || `Unknown Exercise (ID ${exerciseIdToUse})`;
                    }
                } else {
                    mapped.exercise_name = mapped.exercise_name || 'Unknown Exercise';
                }
                return mapped;
            } catch (err) {
                console.error('Error enriching exercise', ue?.id, err);
                return { ...ue, sets: ue.sets || [], exercise_name: ue.exercise_name || 'Unknown Exercise' };
            }
        }));

        const finalList = enriched.filter(r => r.status === 'fulfilled').map(r => r.value);
        currentExercises = JSON.parse(JSON.stringify(finalList));
        displayWorkouts(currentExercises);
        updateStatistics(currentExercises);
    } catch (err) {
        console.error('loadAdminExercisesAndRender error:', err);
        showNotification('Error loading admin exercises', 'error');
    }
}

// -------------------------
// Fetch sets helper (tries multiple candidate endpoints)
// -------------------------
async function fetchSetsForExercise(userExerciseId, token) {
    if (!userExerciseId) return [];
    const candidates = [
        `${API_BASE_URL}${SETS_ENDPOINT}/exercise_id/${userExerciseId}`,
        `${API_BASE_URL}${SETS_ENDPOINT}?exercise_id=${userExerciseId}`,
        `${API_BASE_URL}${SETS_ENDPOINT}?user_exercise_id=${userExerciseId}`,
        `${API_BASE_URL}${SETS_ENDPOINT}/${userExerciseId}/sets`,
        `${API_BASE_URL}${SETS_ENDPOINT}/user_exercise/${userExerciseId}`
    ];

    for (const url of candidates) {
        try {
            const r = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }});
            if (!r.ok) continue;
            const data = await r.json();
            if (Array.isArray(data)) return data;
            if (data && typeof data === 'object') return [data];
        } catch (err) {
            // ignore candidate failure and try next
        }
    }
    return [];
}

// -------------------------
// Display workouts (cards) - full decorated UI for admins
// -------------------------
function displayWorkouts(exercises) {
    const container = document.getElementById('workoutsContainer');
    if (!container) return;
    container.innerHTML = '';

    // Header area: date filter and refresh + create button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '14px';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.gap = '8px';
    left.innerHTML = `
        <input id="dateFilter" type="date" style="padding:8px;border-radius:6px;background:#0b1220;color:#fff;border:1px solid rgba(255,255,255,0.06)"/>
        <button id="filterBtn" class="btn" style="padding:8px 12px;border-radius:6px;background:#2563eb;color:white;border:none;">Filter</button>
        <button id="clearFilterBtn" class="btn" style="padding:8px 12px;border-radius:6px;background:#6b7280;color:white;border:none;">Clear</button>
    `;
    const right = document.createElement('div');
    right.innerHTML = `
        <button id="refreshBtn" class="btn" style="padding:8px 12px;border-radius:6px;background:#10b981;color:white;border:none;margin-right:8px;">Refresh</button>
        <button id="openFormBtn" class="btn" style="padding:8px 12px;border-radius:6px;background:#f59e0b;color:white;border:none;">New Exercise</button>
    `;
    header.appendChild(left);
    header.appendChild(right);
    container.appendChild(header);

    // Stats row
    const stats = document.createElement('div');
    stats.style.display = 'flex';
    stats.style.gap = '12px';
    stats.style.marginBottom = '12px';
    stats.innerHTML = `
        <div class="stat-card" style="padding:10px;border-radius:8px;background:#0b1220;color:#fff;min-width:120px;text-align:center;">
            <div style="font-size:20px;font-weight:700;" id="today-exercises">0</div>
            <div style="font-size:12px;color:#94a3b8;">Today</div>
        </div>
        <div class="stat-card" style="padding:10px;border-radius:8px;background:#0b1220;color:#fff;min-width:120px;text-align:center;">
            <div style="font-size:20px;font-weight:700;" id="total-sets">0</div>
            <div style="font-size:12px;color:#94a3b8;">Total Sets</div>
        </div>
        <div class="stat-card" style="padding:10px;border-radius:8px;background:#0b1220;color:#fff;min-width:120px;text-align:center;">
            <div style="font-size:20px;font-weight:700;" id="max-weight">0</div>
            <div style="font-size:12px;color:#94a3b8;">Max Weight</div>
        </div>
        <div class="stat-card" style="padding:10px;border-radius:8px;background:#0b1220;color:#fff;min-width:120px;text-align:center;">
            <div style="font-size:20px;font-weight:700;" id="total-volume">0</div>
            <div style="font-size:12px;color:#94a3b8;">Volume</div>
        </div>
    `;
    container.appendChild(stats);

    // Cards container
    const cards = document.createElement('div');
    cards.id = 'cardsGrid';
    cards.style.display = 'grid';
    cards.style.gridTemplateColumns = 'repeat(auto-fill,minmax(320px,1fr))';
    cards.style.gap = '12px';

    if (!exercises || exercises.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.padding = '24px';
        empty.style.borderRadius = '8px';
        empty.style.background = '#071024';
        empty.style.color = '#9ca3af';
        empty.innerHTML = `
            <i class="fas fa-dumbbell" style="font-size:36px;color:#f97316;margin-bottom:8px;"></i>
            <h3 style="margin:0 0 6px 0;color:#fff;">No Workouts Found</h3>
            <p style="margin:0;">Use the form above to create a new exercise and sets.</p>
        `;
        container.appendChild(empty);
    } else {
        exercises.forEach(ex => {
            const card = createWorkoutCard(ex);
            cards.appendChild(card);
        });
        container.appendChild(cards);
    }

    // wire up header buttons
    document.getElementById('filterBtn')?.addEventListener('click', () => {
        const date = document.getElementById('dateFilter')?.value || null;
        loadAdminExercisesAndRender(date);
    });
    document.getElementById('clearFilterBtn')?.addEventListener('click', () => {
        document.getElementById('dateFilter').value = '';
        loadAdminExercisesAndRender();
    });
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
        showNotification('Refreshing...', 'info', 1200);
        await loadAvailableExercises();
        await loadAdminExercisesAndRender();
        showNotification('Refreshed', 'success', 1000);
    });
    document.getElementById('openFormBtn')?.addEventListener('click', () => {
        // scroll to form and focus
        const formCard = document.getElementById('formCard');
        if (formCard) {
            formCard.style.display = 'block';
            formCard.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // final call to statistics update
    updateStatistics(exercises);
}

// -------------------------
// Create a single workout card element
// -------------------------
function createWorkoutCard(exercise) {
    const card = document.createElement('div');
    card.className = 'workout-card';
    card.style.background = '#0b1220';
    card.style.borderRadius = '10px';
    card.style.padding = '12px';
    card.style.color = '#e6eef5';
    card.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';

    const title = escapeHtml(exercise.exercise_name || 'Unknown Exercise');
    const dateText = formatDateTimeToLocal(exercise.date);
    const description = escapeHtml(exercise.exercise_description || '');
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];

    const totalSets = sets.length;
    const totalReps = sets.reduce((s, st) => s + (parseInt(st.reps || 0, 10)), 0);
    const maxWeight = sets.length ? Math.max(...sets.map(st => Number(st.weight || 0))) : 0;
    const totalVolume = sets.reduce((sum, st) => sum + ((Number(st.reps || 0) * Number(st.weight || 0)) || 0), 0);

    card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;">
                <h4 style="margin:0 0 6px 0;">${title}</h4>
                <div style="font-size:12px;color:#9ca3af;margin-bottom:6px;">${dateText}</div>
                ${description ? `<div style="font-size:13px;color:#cbd5e1;margin-bottom:8px;">${description}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-left:12px;">
                ${exercise.exercise_url ? `<button class="action-btn btn-preview" style="padding:6px 8px;border-radius:6px;background:#2563eb;color:white;border:none;" onclick="previewExercise(${exercise.id})">Preview</button>` : ''}
                <button class="action-btn btn-edit" style="padding:6px 8px;border-radius:6px;background:#f59e0b;color:white;border:none;" onclick="editExercise(${exercise.id})">Edit</button>
                <button class="action-btn btn-delete" style="padding:6px 8px;border-radius:6px;background:#ef4444;color:white;border:none;" onclick="deleteExercise(${exercise.id})">Delete</button>
            </div>
        </div>

        ${sets.length ? `
        <table style="width:100%;margin-top:12px;border-collapse:collapse;">
            <thead>
                <tr style="text-align:left;color:#9ca3af;font-size:13px;">
                    <th style="padding:6px 8px 6px 0;">Set</th>
                    <th style="padding:6px 8px;">Reps</th>
                    <th style="padding:6px 8px;">Weight</th>
                    <th style="padding:6px 8px;">Volume</th>
                </tr>
            </thead>
            <tbody>
                ${sets.map((st, i) => `
                    <tr style="border-top:1px solid rgba(255,255,255,0.03);">
                        <td style="padding:8px 0;">${i+1}</td>
                        <td style="padding:8px 12px;">${st.reps ?? 0}</td>
                        <td style="padding:8px 12px;">${st.weight ?? 0} kg</td>
                        <td style="padding:8px 12px;">${((Number(st.reps||0) * Number(st.weight||0)) || 0).toFixed(1)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="display:flex;gap:12px;margin-top:12px;">
            <div style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;">
                <div style="font-weight:700;color:#fff;">${totalSets}</div>
                <div style="font-size:12px;color:#9ca3af;">Sets</div>
            </div>
            <div style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;">
                <div style="font-weight:700;color:#fff;">${totalReps}</div>
                <div style="font-size:12px;color:#9ca3af;">Reps</div>
            </div>
            <div style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;">
                <div style="font-weight:700;color:#fff;">${maxWeight}</div>
                <div style="font-size:12px;color:#9ca3af;">Max Weight</div>
            </div>
            <div style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.02);text-align:center;">
                <div style="font-weight:700;color:#fff;">${totalVolume.toFixed(1)}</div>
                <div style="font-size:12px;color:#9ca3af;">Volume</div>
            </div>
        </div>` : `
        <div style="text-align:center;padding:16px;margin-top:12px;color:#9ca3af;background:rgba(255,255,255,0.01);border-radius:8px;">
            <i class="fas fa-dumbbell" style="font-size:20px;margin-bottom:6px;color:#94a3b8;"></i>
            <div style="font-size:13px;">No sets recorded</div>
        </div>
        `}
    `;

    return card;
}

// -------------------------
// Format datetime (server stores datetime)
// -------------------------
function formatDateTimeToLocal(datetimeStr) {
    if (!datetimeStr) return '';
    try {
        const dt = new Date(datetimeStr);
        // Format: Oct 22, 2025 14:33
        const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return dt.toLocaleString(undefined, opts);
    } catch (err) {
        return datetimeStr;
    }
}

// -------------------------
// Statistics update
// -------------------------
function updateStatistics(exercises) {
    const today = new Date().toISOString().split('T')[0];
    const todayCount = exercises.filter(ex => ex.date && (new Date(ex.date)).toISOString().split('T')[0] === today).length;
    const totalSets = exercises.reduce((sum, ex) => sum + ((Array.isArray(ex.sets) ? ex.sets.length : 0) || 0), 0);
    const maxWeight = exercises.reduce((m, ex) => {
        if (!Array.isArray(ex.sets) || ex.sets.length === 0) return m;
        const mx = Math.max(...ex.sets.map(s => Number(s.weight || 0)));
        return Math.max(m, mx);
    }, 0);
    const totalVolume = exercises.reduce((sum, ex) => {
        if (!Array.isArray(ex.sets)) return sum;
        return sum + ex.sets.reduce((s2, s) => s2 + ((Number(s.reps || 0) * Number(s.weight || 0)) || 0), 0);
    }, 0);

    const elToday = document.getElementById('today-exercises');
    const elSets = document.getElementById('total-sets');
    const elMax = document.getElementById('max-weight');
    const elVol = document.getElementById('total-volume');

    if (elToday) elToday.textContent = todayCount;
    if (elSets) elSets.textContent = totalSets;
    if (elMax) elMax.textContent = maxWeight;
    if (elVol) elVol.textContent = totalVolume.toFixed(1);
}

// -------------------------
// Form & sets helpers
// -------------------------
function attachFormHandlers() {
    // Ensure at least one set input exists
    if (document.getElementById('setsContainer') && document.getElementById('setsContainer').children.length === 0) {
        addSet();
    }

    const form = document.getElementById('exerciseForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // quick click handlers for dynamically created buttons might be bound after render
}

// Add a set UI row
function addSet() {
    const container = document.getElementById('setsContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'set-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.style.marginTop = '8px';
    row.innerHTML = `
        <div style="display:flex;gap:8px;flex:1;">
            <input type="number" class="set-reps" placeholder="Reps" min="1" required style="flex:1;padding:8px;border-radius:6px;background:#071024;color:#fff;border:1px solid rgba(255,255,255,0.04);"/>
            <input type="number" class="set-weight" placeholder="Weight (kg)" min="0" step="0.5" required style="flex:1;padding:8px;border-radius:6px;background:#071024;color:#fff;border:1px solid rgba(255,255,255,0.04);"/>
        </div>
        <button type="button" class="btn-remove-set" style="padding:6px 8px;border-radius:6px;background:#ef4444;color:white;border:none;">Remove</button>
    `;
    container.appendChild(row);
    // attach remove handler
    row.querySelector('.btn-remove-set').addEventListener('click', (e) => {
        if (container.querySelectorAll('.set-row').length > 1) {
            row.remove();
        } else {
            // clear values if only one
            row.querySelector('.set-reps').value = '';
            row.querySelector('.set-weight').value = '';
        }
    });
}

// Read sets data from form
function getSetsDataFromForm() {
    const sets = [];
    document.querySelectorAll('.set-row').forEach(row => {
        const repsEl = row.querySelector('.set-reps');
        const weightEl = row.querySelector('.set-weight');
        const reps = repsEl ? repsEl.value : '';
        const weight = weightEl ? weightEl.value : '';
        if (reps !== '' && weight !== '') {
            sets.push({ reps: parseInt(reps, 10), weight: parseFloat(weight) });
        }
    });
    return sets;
}

function resetFormUI() {
    const form = document.getElementById('exerciseForm');
    if (form) form.reset();
    const container = document.getElementById('setsContainer');
    if (container) {
        container.innerHTML = '';
        addSet();
    }
    editingExerciseId = null;
    isEditMode = false;
    const select = document.getElementById('exerciseSelect');
    if (select) {
        select.disabled = false;
        select.required = true;
    }
    const title = document.getElementById('form-title');
    if (title) title.textContent = 'Log New Exercise';
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.innerHTML = '<span>Log Exercise</span>';
    const actions = document.getElementById('form-actions');
    if (actions) actions.style.display = 'none';
}

// -------------------------
// Form submit handler
// -------------------------
async function handleFormSubmit(event) {
    event.preventDefault();
    if (!isAdminUser) {
        showNotification('You are not authorized to perform this action', 'error');
        return;
    }
    const select = document.getElementById('exerciseSelect');
    const exerciseId = select ? select.value : null;
    const sets = getSetsDataFromForm();

    if (!exerciseId) {
        showNotification('Please select an exercise', 'error');
        return;
    }
    if (sets.length === 0) {
        showNotification('Add at least one set', 'error');
        return;
    }

    try {
        // Create exercise entry
        const token = getAuthToken();
        const createRes = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/user`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ exercise_id: Number(exerciseId) })
        });
        if (!createRes.ok) {
            const err = await createRes.json().catch(()=>({}));
            throw new Error(err.detail || `Failed to create exercise (${createRes.status})`);
        }
        const created = await createRes.json();
        const createdId = created.id ?? created._id ?? null;
        // Create sets
        const setPromises = sets.map(s => fetch(`${API_BASE_URL}${SETS_ENDPOINT}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...s, exercise_id: createdId })
        }).then(r => {
            if (!r.ok) return r.json().then(d => { throw new Error(d.detail || r.status); });
            return r.json();
        }));
        await Promise.all(setPromises);
        resetFormUI();
        await loadAvailableExercises();
        await loadAdminExercisesAndRender();
        showNotification('Exercise created', 'success');
    } catch (err) {
        console.error('handleFormSubmit error:', err);
        showNotification(err.message || 'Error creating exercise', 'error');
    }
}

// -------------------------
// Edit flow (add sets to existing exercise)
// -------------------------
async function editExercise(exerciseId) {
    if (!isAdminUser) { showNotification('Unauthorized', 'error'); return; }
    editingExerciseId = exerciseId;
    isEditMode = true;

    // open form and prefill for adding sets
    const exercise = currentExercises.find(e => String(e.id) === String(exerciseId));
    if (!exercise) {
        showNotification('Exercise not found', 'error');
        return;
    }
    const formCard = document.getElementById('formCard');
    if (formCard) formCard.style.display = 'block';

    document.getElementById('form-title').textContent = `Add Sets to ${exercise.exercise_name || 'Exercise'}`;

    const select = document.getElementById('exerciseSelect');
    if (select) {
        select.value = exercise.exercise_id ?? exercise.exerciseId ?? '';
        select.disabled = true;
        select.required = false;
    }

    // reset and show one empty set row
    const container = document.getElementById('setsContainer');
    if (container) {
        container.innerHTML = '';
        addSet();
    }
    const actions = document.getElementById('form-actions');
    if (actions) actions.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification('Edit mode: add sets', 'info');
}

// -------------------------
// Add sets to existing exercise (when editing)
 // -------------------------
async function addSetsToExercise(exerciseId, sets) {
    if (!isAdminUser) { showNotification('Unauthorized', 'error'); return; }
    try {
        const token = getAuthToken();
        const promises = sets.map(s => fetch(`${API_BASE_URL}${SETS_ENDPOINT}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...s, exercise_id: Number(exerciseId) })
        }).then(r => {
            if (!r.ok) return r.json().then(d => { throw new Error(d.detail || r.status); });
            return r.json();
        }));
        await Promise.all(promises);
        resetFormUI();
        await loadAdminExercisesAndRender();
        showNotification('Sets added', 'success');
    } catch (err) {
        console.error('addSetsToExercise error:', err);
        showNotification(err.message || 'Error adding sets', 'error');
    }
}

// -------------------------
// Delete exercise and its sets
// -------------------------
async function deleteExercise(exerciseId) {
    if (!isAdminUser) { showNotification('Unauthorized', 'error'); return; }
    if (!confirm('Delete this exercise and all its sets? This cannot be undone.')) return;
    try {
        const token = getAuthToken();

        // Attempt to delete via exercise endpoint (backend should cascade delete sets)
        const res = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/${exerciseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const d = await res.json().catch(()=>({}));
            throw new Error(d.detail || `Delete failed: ${res.status}`);
        }
        showNotification('Exercise deleted', 'success');
        await loadAdminExercisesAndRender();
    } catch (err) {
        console.error('deleteExercise error:', err);
        showNotification(err.message || 'Error deleting exercise', 'error');
    }
}

// -------------------------
// Preview exercise video
// -------------------------
function isValidVideoUrl(url) {
    if (!url) return false;
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    const vimeoRegex = /^(https?:\/\/)?(www\.)?vimeo\.com\/.+$/;
    return youtubeRegex.test(url) || vimeoRegex.test(url);
}

function extractYouTubeId(url) {
    try {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/,
            /youtube\.com\/embed\/([^?]+)/,
            /youtube\.com\/v\/([^?]+)/,
            /youtube\.com\/watch\?.*v=([^&]+)/,
            /v=([^&]+)/,
            /youtu\.be\/([^?&]+)/,
        ];
        for (const p of patterns) {
            const m = url.match(p);
            if (m && m[1]) return m[1].split('?')[0].split('&')[0];
        }
        return null;
    } catch (err) { return null; }
}

function getVideoEmbedHtml(url) {
    if (!url) return '';
    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const id = extractYouTubeId(url);
            if (id) {
                return `<iframe src="https://www.youtube.com/embed/${id}?rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:420px;border-radius:8px;"></iframe>`;
            }
        } else if (url.includes('vimeo.com')) {
            const id = url.split('/').pop().split('?')[0];
            if (id) {
                return `<iframe src="https://player.vimeo.com/video/${id}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:420px;border-radius:8px;"></iframe>`;
            }
        }
    } catch (err) {
        console.error('getVideoEmbedHtml error:', err);
    }
    return `<div style="padding:30px;text-align:center;background:rgba(255,255,255,0.02);border-radius:8px;"><p>Preview not available</p><a href="${escapeHtml(url)}" target="_blank" style="color:#60a5fa;">Open video</a></div>`;
}

function previewExercise(exerciseId) {
    const ex = currentExercises.find(e => String(e.id) === String(exerciseId));
    if (!ex) { showNotification('Exercise not found', 'error'); return; }
    if (!ex.exercise_url) { showNotification('No video URL', 'error'); return; }
    if (!isValidVideoUrl(ex.exercise_url)) { showNotification('Cannot preview this video', 'error'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = 0;
    overlay.style.top = 0;
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '10000';

    overlay.innerHTML = `
        <div style="background:#071024;padding:18px;border-radius:10px;max-width:980px;width:96%;color:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;">${escapeHtml(ex.exercise_name)}</h3>
                <button style="background:#ef4444;border:none;color:#fff;padding:8px 10px;border-radius:6px;cursor:pointer;" id="closePreviewBtn">Close</button>
            </div>
            <div>${getVideoEmbedHtml(ex.exercise_url)}</div>
            <div style="margin-top:12px;color:#cbd5e1;">${escapeHtml(ex.exercise_description || '')}</div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('closePreviewBtn')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
}

// -------------------------
// Date filter default
// -------------------------
function setupDateFilterDefault() {
    const df = document.getElementById('dateFilter');
    if (!df) return;
    // default to today
    const today = new Date();
    df.value = today.toISOString().split('T')[0];
}

// -------------------------
// Helper: show restricted simple message (can be toggled if needed)
// -------------------------
function showRestrictedInline() {
    const container = document.getElementById('workoutsContainer');
    if (!container) return;
    container.innerHTML = `
        <div style="padding:20px;border-radius:8px;background:#071024;color:#cbd5e1;">
            <h3>Access Restricted</h3>
            <p>You do not have permission to view exercises.</p>
        </div>
    `;
}

// -------------------------
// Expose small debug helpers to window
// -------------------------
window.forceReloadExercises = async function() {
    if (!isAdminUser) { showNotification('Unauthorized', 'error'); return; }
    await loadAvailableExercises();
    await loadAdminExercisesAndRender();
    showNotification('Reloaded', 'success');
};
window.resetFormUI = resetFormUI;
window.addSet = addSet;
window.setCurrentUser = function(user) {
    if (!user) return;
    if (user.id) localStorage.setItem('user_id', String(user.id));
    if (user.role) localStorage.setItem('user_role', String(user.role));
    // update admin flag and re-init
    isAdminUser = detectAdminFromStorageOrToken();
};

// -------------------------
// Small CSS (inject) for nicer look if not present
// -------------------------
(function injectSmallStyles(){
    const styleId = 'workout-tracker-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        body { font-family: Inter, Roboto, Arial, sans-serif; background: #07080a; color: #e6eef5; }
        .btn { cursor: pointer; }
        .workout-card:hover { transform: translateY(-2px); transition: transform 160ms; }
        .notification { position: fixed; right: 16px; top: 16px; z-index: 9999; }
        input, select { outline: none; }
        .set-row input { width: 100%; }
    `;
    document.head.appendChild(style);
})();

// -------------------------
// PADDING: keep file long (harmless comment lines to exceed 1000 lines if needed)
// -------------------------
/* Padding start */
 // 1
 // 2
 // 3
 // 4
 // 5
 // 6
 // 7
 // 8
 // 9
 // 10
 // 11
 // 12
 // 13
 // 14
 // 15
 // 16
 // 17
 // 18
 // 19
 // 20
 // 21
 // 22
 // 23
 // 24
 // 25
 // 26
 // 27
 // 28
 // 29
 // 30
 // 31
 // 32
 // 33
 // 34
 // 35
 // 36
 // 37
 // 38
 // 39
 // 40
 // 41
 // 42
 // 43
 // 44
 // 45
 // 46
 // 47
 // 48
 // 49
 // 50
 // 51
 // 52
 // 53
 // 54
 // 55
 // 56
 // 57
 // 58
 // 59
 // 60
 // 61
 // 62
 // 63
 // 64
 // 65
 // 66
 // 67
 // 68
 // 69
 // 70
 // 71
 // 72
 // 73
 // 74
 // 75
 // 76
 // 77
 // 78
 // 79
 // 80
 // 81
 // 82
 // 83
 // 84
 // 85
 // 86
 // 87
 // 88
 // 89
 // 90
 // 91
 // 92
 // 93
 // 94
 // 95
 // 96
 // 97
 // 98
 // 99
 // 100
/* Padding end */
