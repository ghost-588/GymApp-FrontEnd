// =========================
// Workout Tracker - Your Theme with Admin Logic
// - Your exact CSS theme
// - Admin/non-admin logic
// - Backend base URL: http://localhost:8000
// =========================

// -------------------------
// Config / Endpoints
// -------------------------
const API_BASE_URL = 'https://gym-app-lime-nine.vercel.app';
const USER_EXERCISES_ENDPOINT = '/user_exercises';
const SETS_ENDPOINT = '/sets';
const ALL_EXERCISES_ENDPOINT = '/all_exercises';

// -------------------------
// App State
// -------------------------
let currentExercises = [];
let allAvailableExercises = [];
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
// Auth helpers (Admin/Non-admin logic)
// -------------------------
function getAuthToken() {
    const token = localStorage.getItem('access_token');
    if (!token) {
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

    return false;
}

// -------------------------
// Notifications (Your theme)
// -------------------------
function showNotification(message, type = 'info', duration = 5000) {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// -------------------------
// Initialization
// -------------------------
document.addEventListener('DOMContentLoaded', async () => {
    try {
        isAdminUser = detectAdminFromStorageOrToken();
        setupUIForRole();
        await loadAvailableExercises();
        
        if (isAdminUser) {
            await loadAdminExercisesAndRender();
        } else {
            await loadUserExercises();
        }
        
        setupEventListeners();
        setupDateFilter();
        showNotification('Workout tracker loaded successfully!', 'success', 3000);
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('App initialization error', 'error');
    }
});

// -------------------------
// UI Setup with Your Theme
// -------------------------
function setupUIForRole() {
    const appRoot = document.getElementById('app') || document.body;
    
    // Clear existing content
    appRoot.innerHTML = '';

    // Create main container
    const container = document.createElement('div');
    container.className = 'container';
    container.innerHTML = `
        <header class="header">
            <div class="header-content">
                <div class="brand">
                    <i class="fas fa-dumbbell"></i>
                    <h1>ELITEFIT ADMIN Workout Tracker <span>${isAdminUser ? '' : 'User'}</span></h1>
                </div>
                <div class="header-controls">
                    <input type="date" class="date-input" id="dateFilter">
                    <button class="control-btn" id="filterBtn">
                        <i class="fas fa-filter"></i> Filter
                    </button>
                    <button class="control-btn btn-clear" id="clearFilterBtn">
                        <i class="fas fa-times"></i> Clear
                    </button>
                    <button class="control-btn" id="refreshBtn">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                    ${isAdminUser ? `
                    <button class="control-btn" id="openFormBtn">
                        <i class="fas fa-plus"></i> New Exercise
                    </button>` : ''}
                </div>
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="today-exercises">0</div>
                <div class="stat-label">Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-sets">0</div>
                <div class="stat-label">Total Sets</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="max-weight">0</div>
                <div class="stat-label">Max Weight</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="total-volume">0</div>
                <div class="stat-label">Volume</div>
            </div>
        </div>

        <main class="main-content">
            ${isAdminUser ? `
            <section class="form-section" id="formSection">
                <div class="section-header">
                    <h2 id="form-title">Log New Exercise</h2>
                    <div class="form-actions" id="form-actions" style="display: none;">
                        <button class="cancel-btn" onclick="cancelEdit()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
                <form class="exercise-form" id="exerciseForm">
                    <div class="form-group">
                        <div class="input-with-icon">
                            <i class="fas fa-dumbbell"></i>
                            <select id="exerciseSelect" required>
                                <option value="">Select Exercise</option>
                            </select>
                        </div>
                    </div>

                    <div class="sets-section">
                        <div class="sets-header">
                            <h3>Exercise Sets</h3>
                            <div class="sets-controls">
                                <button type="button" class="control-btn" onclick="addSet()">
                                    <i class="fas fa-plus"></i> Add Set
                                </button>
                            </div>
                        </div>
                        <div class="sets-container" id="setsContainer"></div>
                    </div>

                    <button type="submit" class="submit-btn" id="submit-btn">
                        <i class="fas fa-save"></i>
                        <span>Log Exercise</span>
                    </button>
                </form>
            </section>` : ''}

            <section class="workouts-section">
                <div class="section-header">
                    <h2>Your Workouts</h2>
                    <div class="date-filter">
                        <input type="date" class="date-input" id="workoutDateFilter">
                    </div>
                </div>
                <div class="workouts-container" id="workoutsContainer"></div>
            </section>
        </main>
    `;

    appRoot.appendChild(container);
    
    // Initialize sets container for admin
    if (isAdminUser && document.getElementById('setsContainer')) {
        addSet();
    }
}

// -------------------------
// Access Restricted UI
// -------------------------
function showAccessRestrictedUI() {
    const container = document.getElementById('workoutsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-lock"></i>
            <h3>Access Restricted</h3>
            <p>You do not have permission to view or manage exercises. If you think this is an error, contact an administrator.</p>
        </div>
    `;
}

// -------------------------
// Load available exercises (catalog)
// -------------------------
async function loadAvailableExercises() {
    try {
        const token = getAuthToken();
        if (!token) {
            allAvailableExercises = [];
            populateExerciseSelect();
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}${ALL_EXERCISES_ENDPOINT}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            console.warn('Could not load all exercises list, status:', response.status);
            allAvailableExercises = [];
            populateExerciseSelect();
            return;
        }

        const exercises = await response.json();
        allAvailableExercises = Array.isArray(exercises) ? exercises : [];
        populateExerciseSelect();
    } catch (error) {
        console.error('Error loading exercises:', error);
        showNotification('Error loading available exercises', 'error');
        allAvailableExercises = [];
        populateExerciseSelect();
    }
}

function populateExerciseSelect() {
    const select = document.getElementById('exerciseSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Exercise</option>';
    allAvailableExercises.forEach(exercise => {
        const option = document.createElement('option');
        option.value = exercise.id ?? exercise._id ?? '';
        option.textContent = exercise.name ?? `Exercise ${exercise.id ?? exercise._id ?? ''}`;
        if (exercise.description) option.title = exercise.description;
        select.appendChild(option);
    });
}

// -------------------------
// Load exercises based on user role
// -------------------------
async function loadAdminExercisesAndRender(date = null) {
    try {
        const token = getAuthToken();
        if (!token) {
            showNotification('Not authenticated. Please log in.', 'error');
            showAccessRestrictedUI();
            return;
        }

        // Admin uses /user_exercises/user endpoint
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

        // Filter by date if provided
        if (date) {
            userExercisesList = userExercisesList.filter(ue => {
                if (!ue.date) return false;
                const dateOnly = (new Date(ue.date)).toISOString().split('T')[0];
                return dateOnly === date;
            });
        }

        // Enrich exercises with sets and details
        const enriched = await Promise.allSettled(
            userExercisesList.map(ue => enrichExerciseWithSetsAndDetails(ue, token))
        );

        const finalList = enriched.filter(r => r.status === 'fulfilled').map(r => r.value);
        currentExercises = JSON.parse(JSON.stringify(finalList));
        displayWorkouts(currentExercises);
        updateStatistics(currentExercises);
    } catch (err) {
        console.error('loadAdminExercisesAndRender error:', err);
        showNotification('Error loading admin exercises', 'error');
    }
}

async function loadUserExercises(date = null) {
    try {
        const token = getAuthToken();
        if (!token) {
            showNotification('Not authenticated. Please log in.', 'error');
            return;
        }

        // Non-admin uses /user_exercises/user/current endpoint
        const endpoint = `${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/user/current`;
        const res = await fetch(endpoint, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            console.error('Failed to load user exercises:', res.status);
            showNotification('Failed to load exercises', 'error');
            return;
        }

        const list = await res.json();
        let userExercisesList = Array.isArray(list) ? list : [];

        // Filter by date if provided
        if (date) {
            userExercisesList = userExercisesList.filter(ue => {
                if (!ue.date) return false;
                const dateOnly = (new Date(ue.date)).toISOString().split('T')[0];
                return dateOnly === date;
            });
        }

        // Enrich exercises with sets and details
        const enriched = await Promise.allSettled(
            userExercisesList.map(ue => enrichExerciseWithSetsAndDetails(ue, token))
        );

        const finalList = enriched.filter(r => r.status === 'fulfilled').map(r => r.value);
        currentExercises = JSON.parse(JSON.stringify(finalList));
        displayWorkouts(currentExercises);
        updateStatistics(currentExercises);
    } catch (err) {
        console.error('loadUserExercises error:', err);
        showNotification('Error loading exercises', 'error');
    }
}

// -------------------------
// Exercise enrichment helper
// -------------------------
async function enrichExerciseWithSetsAndDetails(ue, token) {
    try {
        // Fetch sets for this exercise
        const sets = await fetchSetsForExercise(ue.id, token);
        const mapped = { ...ue, sets: Array.isArray(sets) ? sets : [] };

        // Find exercise details
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

        // Use cached exercises
        if (exerciseIdToUse) {
            const cached = allAvailableExercises.find(a => 
                (a.id != null && a.id == exerciseIdToUse) || 
                (a._id != null && a._id == exerciseIdToUse)
            );
            
            if (cached) {
                mapped.exercise_name = cached.name || `Exercise ${exerciseIdToUse}`;
                mapped.exercise_description = cached.description || '';
                mapped.exercise_url = cached.url || cached.video_url || '';
                return mapped;
            }

            // Fallback: fetch exercise details
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
}

// -------------------------
// Fetch sets helper
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
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) return data;
                if (data && typeof data === 'object') return [data];
            }
        } catch (error) {
            // Continue to next candidate
        }
    }
    
    return [];
}

// -------------------------
// Display workouts (Your theme)
// -------------------------
function displayWorkouts(exercises) {
    const container = document.getElementById('workoutsContainer');
    if (!container) return;
    
    if (!exercises || exercises.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-dumbbell"></i>
                <h3>No Workouts Found</h3>
                <p>${isAdminUser ? 'Use the form above to create a new exercise and sets.' : 'No exercises found for the selected date.'}</p>
            </div>
        `;
        return;
    }

    let workoutsHTML = '';
    exercises.forEach(exercise => {
        const sets = Array.isArray(exercise.sets) ? JSON.parse(JSON.stringify(exercise.sets)) : [];
        const totalSets = sets.length;
        const totalReps = sets.reduce((sum, set) => sum + (set.reps || 0), 0);
        const maxWeight = sets.length > 0 ? Math.max(...sets.map(set => set.weight || 0)) : 0;
        const totalVolume = sets.reduce((sum, set) => sum + ((set.reps || 0) * (set.weight || 0)), 0);

        const exerciseName = exercise.exercise_name || 'Unknown Exercise';
        const exerciseDescription = exercise.exercise_description || '';
        const exerciseUrl = exercise.exercise_url || '';
        const exerciseDate = exercise.date ? new Date(exercise.date).toLocaleDateString() : 'Unknown date';

        workoutsHTML += `
            <div class="workout-card">
                <div class="workout-header">
                    <div class="workout-info">
                        <h3>${escapeHtml(exerciseName)}</h3>
                        <div class="workout-date">${exerciseDate}</div>
                        ${exerciseDescription ? `<div class="workout-description">${escapeHtml(exerciseDescription)}</div>` : ''}
                    </div>
                    <div class="workout-actions">
                        ${exerciseUrl ? `
                        <button class="action-btn btn-preview" onclick="previewExercise(${exercise.id})" title="Preview exercise">
                            <i class="fas fa-play"></i> Preview
                        </button>` : ''}
                        ${isAdminUser ? `
                        <button class="action-btn btn-edit" onclick="editExercise(${exercise.id})" title="Edit exercise">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteExercise(${exercise.id})" title="Delete exercise">
                            <i class="fas fa-trash"></i> Delete
                        </button>` : ''}
                    </div>
                </div>

                ${sets.length > 0 ? `
                <table class="sets-table">
                    <thead>
                        <tr>
                            <th>Set</th>
                            <th>Reps</th>
                            <th>Weight</th>
                            <th>Volume</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sets.map((set, index) => `
                            <tr>
                                <td class="set-number">${index + 1}</td>
                                <td>${set.reps ?? 0}</td>
                                <td>${(set.weight ?? 0)} kg</td>
                                <td>${((set.reps ?? 0) * (set.weight ?? 0)).toFixed(1)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px;">
                    <div style="text-align: center;">
                        <div style="color: #8b0000; font-weight: bold; font-size: 1.2rem;">${totalSets}</div>
                        <div style="color: #666; font-size: 0.8rem;">Sets</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #8b0000; font-weight: bold; font-size: 1.2rem;">${totalReps}</div>
                        <div style="color: #666; font-size: 0.8rem;">Reps</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #8b0000; font-weight: bold; font-size: 1.2rem;">${maxWeight}</div>
                        <div style="color: #666; font-size: 0.8rem;">Max Weight</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #8b0000; font-weight: bold; font-size: 1.2rem;">${totalVolume.toFixed(1)}</div>
                        <div style="color: #666; font-size: 0.8rem;">Volume</div>
                    </div>
                </div>
                ` : `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <i class="fas fa-dumbbell" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>No sets recorded for this exercise</p>
                </div>
                `}
            </div>
        `;
    });

    container.innerHTML = workoutsHTML;
}

// -------------------------
// Event Listeners
// -------------------------
function setupEventListeners() {
    const form = document.getElementById('exerciseForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    document.getElementById('filterBtn')?.addEventListener('click', () => {
        const date = document.getElementById('dateFilter')?.value || null;
        if (isAdminUser) {
            loadAdminExercisesAndRender(date);
        } else {
            loadUserExercises(date);
        }
    });

    document.getElementById('clearFilterBtn')?.addEventListener('click', () => {
        document.getElementById('dateFilter').value = '';
        if (isAdminUser) {
            loadAdminExercisesAndRender();
        } else {
            loadUserExercises();
        }
    });

    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
        showNotification('Refreshing...', 'info', 1200);
        await loadAvailableExercises();
        if (isAdminUser) {
            await loadAdminExercisesAndRender();
        } else {
            await loadUserExercises();
        }
        showNotification('Refreshed', 'success', 1000);
    });

    document.getElementById('openFormBtn')?.addEventListener('click', () => {
        const formSection = document.getElementById('formSection');
        if (formSection) {
            formSection.scrollIntoView({ behavior: 'smooth' });
        }
    });

    document.addEventListener('click', function(event) {
        if (event.target.classList && event.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeModal();
    });
}

// -------------------------
// Form Handlers (Admin only)
// -------------------------
function addSet() {
    const container = document.getElementById('setsContainer');
    if (!container) return;
    
    const setRow = document.createElement('div');
    setRow.className = 'set-row';
    setRow.innerHTML = `
        <div class="set-inputs">
            <div class="input-with-icon">
                <i class="fas fa-repeat"></i>
                <input type="number" class="set-reps" placeholder="Reps" min="1" required>
            </div>
            <div class="input-with-icon">
                <i class="fas fa-weight-hanging"></i>
                <input type="number" class="set-weight" placeholder="Weight (kg)" min="0" step="0.5" required>
            </div>
            <button type="button" class="btn-remove-set" onclick="removeSet(this)">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(setRow);
    updateRemoveButtons();
}

function removeSet(button) {
    const container = document.getElementById('setsContainer');
    if (!container) return;
    
    if (container.children.length > 1) {
        button.closest('.set-row').remove();
        updateRemoveButtons();
    }
}

function updateRemoveButtons() {
    const container = document.getElementById('setsContainer');
    if (!container) return;
    
    const removeButtons = container.querySelectorAll('.btn-remove-set');
    removeButtons.forEach(btn => {
        btn.disabled = container.children.length === 1;
    });
}

function getSetsData() {
    const sets = [];
    document.querySelectorAll('.set-row').forEach(row => {
        const repsEl = row.querySelector('.set-reps');
        const weightEl = row.querySelector('.set-weight');
        const reps = repsEl ? repsEl.value : '';
        const weight = weightEl ? weightEl.value : '';
        
        if (reps !== '' && weight !== '') {
            sets.push({
                reps: parseInt(reps, 10),
                weight: parseFloat(weight)
            });
        }
    });
    return sets;
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!isAdminUser) {
        showNotification('You are not authorized to perform this action', 'error');
        return;
    }

    const exerciseSelect = document.getElementById('exerciseSelect');
    const sets = getSetsData();

    if (!isEditMode && (!exerciseSelect || !exerciseSelect.value)) {
        showNotification('Please select an exercise', 'error');
        return;
    }

    if (sets.length === 0) {
        showNotification('Please add at least one set', 'error');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn ? submitBtn.innerHTML : null;
    
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        submitBtn.disabled = true;
    }

    try {
        if (isEditMode && editingExerciseId) {
            await addSetsToExercise(editingExerciseId, sets);
        } else {
            await createNewExerciseWithSets(parseInt(exerciseSelect.value, 10), sets);
        }
    } catch (error) {
        console.error('Error processing exercise:', error);
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

async function createNewExerciseWithSets(exerciseId, sets) {
    try {
        const token = getAuthToken();
        const exerciseResponse = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}`, {
            method: 'POST',
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ exercise_id: exerciseId })
        });

        if (!exerciseResponse.ok) {
            const errorData = await exerciseResponse.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create exercise: ${exerciseResponse.status}`);
        }

        const createdExercise = await exerciseResponse.json();
        const createdId = createdExercise.id ?? createdExercise._id ?? null;

        if (sets.length > 0) {
            const setPromises = sets.map(async (set) => {
                const payload = {
                    ...set,
                    exercise_id: createdId
                };
                
                const setRes = await fetch(`${API_BASE_URL}${SETS_ENDPOINT}`, {
                    method: 'POST',
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!setRes.ok) {
                    const errorData = await setRes.json().catch(() => ({}));
                    throw new Error(errorData.detail || `Failed to create set: ${setRes.status}`);
                }

                return await setRes.json();
            });

            await Promise.all(setPromises);
        }

        resetForm();
        await loadAdminExercisesAndRender();
        showNotification(`Exercise created successfully with ${sets.length} sets!`, 'success');
    } catch (error) {
        console.error('Error creating exercise with sets:', error);
        throw error;
    }
}

// -------------------------
// Edit Flow (Admin only)
// -------------------------
async function editExercise(exerciseId) {
    if (!isAdminUser) {
        showNotification('Unauthorized', 'error');
        return;
    }

    try {
        const exercise = currentExercises.find(ex => ex.id === exerciseId || ex.id == exerciseId);
        if (!exercise) {
            showNotification('Exercise not found', 'error');
            return;
        }

        editingExerciseId = exerciseId;
        isEditMode = true;

        const exerciseName = exercise.exercise_name || 'Exercise';

        const select = document.getElementById('exerciseSelect');
        if (select) {
            select.value = exercise.exercise_id ?? exercise.exerciseId ?? '';
            select.disabled = true;
            select.required = false;
        }

        const container = document.getElementById('setsContainer');
        if (container) {
            container.innerHTML = '';
            addSet();
        }

        updateRemoveButtons();

        const title = document.getElementById('form-title');
        if (title) title.textContent = `Add Sets to ${exerciseName}`;
        
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.innerHTML = '<span>Add Sets</span><i class="fas fa-plus"></i>';
        
        const actions = document.getElementById('form-actions');
        if (actions) actions.style.display = 'flex';

        document.getElementById('formSection')?.scrollIntoView({ behavior: 'smooth' });
        showNotification(`Adding new sets to ${exerciseName}`, 'info');
    } catch (error) {
        console.error('Error setting up edit mode:', error);
        showNotification('Error loading exercise for editing', 'error');
    }
}

async function addSetsToExercise(exerciseId, newSets) {
    try {
        const token = getAuthToken();
        
        if (newSets.length > 0) {
            const setPromises = newSets.map(async (set) => {
                const payload = { ...set, exercise_id: exerciseId };
                const setResponse = await fetch(`${API_BASE_URL}${SETS_ENDPOINT}`, {
                    method: 'POST',
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!setResponse.ok) {
                    const errorData = await setResponse.json().catch(() => ({}));
                    throw new Error(errorData.detail || `Failed to create set: ${setResponse.status}`);
                }

                return await setResponse.json();
            });

            await Promise.all(setPromises);
        }

        resetForm();
        await loadAdminExercisesAndRender();
        showNotification(`Added ${newSets.length} new sets to exercise!`, 'success');
    } catch (error) {
        console.error('Error adding sets to exercise:', error);
        throw error;
    }
}

// -------------------------
// Delete Exercise (Admin only)
// -------------------------
async function deleteExercise(exerciseId) {
    if (!isAdminUser) {
        showNotification('Unauthorized', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this exercise and all its sets? This action cannot be undone.')) return;

    try {
        const token = getAuthToken();
        const exercise = currentExercises.find(ex => ex.id === exerciseId || ex.id == exerciseId);
        
        // Delete associated sets first
        if (exercise && Array.isArray(exercise.sets)) {
            const deleteSetPromises = exercise.sets.map(set => {
                const setId = set.id ?? set._id;
                const url = setId ? `${API_BASE_URL}${SETS_ENDPOINT}/${setId}` : `${API_BASE_URL}${SETS_ENDPOINT}/${set.id}`;
                return fetch(url, { 
                    method: 'DELETE', 
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } 
                });
            });
            await Promise.allSettled(deleteSetPromises);
        }

        // Delete the exercise
        const response = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/${exerciseId}`, {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
        }

        await loadAdminExercisesAndRender();
        showNotification('Exercise deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting exercise:', error);
        showNotification(`Error deleting exercise: ${error.message}`, 'error');
    }
}

// -------------------------
// Utility Functions
// -------------------------
function resetForm() {
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
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i><span>Log Exercise</span>';
    
    const actions = document.getElementById('form-actions');
    if (actions) actions.style.display = 'none';
}

function setupDateFilter() {
    const today = getTodayDate();
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) dateFilter.value = today;
}

function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updateStatistics(exercises) {
    const today = getTodayDate();
    const todayExercises = exercises.filter(ex => {
        if (!ex.date) return false;
        const exerciseDate = new Date(ex.date).toISOString().split('T')[0];
        return exerciseDate === today;
    });

    const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
    const maxWeight = exercises.reduce((max, ex) => {
        if (!ex.sets || ex.sets.length === 0) return max;
        const exerciseMax = Math.max(...ex.sets.map(set => set.weight || 0));
        return Math.max(max, exerciseMax);
    }, 0);
    const totalVolume = exercises.reduce((sum, ex) => {
        if (!ex.sets) return sum;
        const exerciseVolume = ex.sets.reduce((volSum, set) => volSum + ((set.reps || 0) * (set.weight || 0)), 0);
        return sum + exerciseVolume;
    }, 0);

    const todayEl = document.getElementById('today-exercises');
    const totalSetsEl = document.getElementById('total-sets');
    const maxWeightEl = document.getElementById('max-weight');
    const totalVolumeEl = document.getElementById('total-volume');

    if (todayEl) todayEl.textContent = todayExercises.length;
    if (totalSetsEl) totalSetsEl.textContent = totalSets;
    if (maxWeightEl) maxWeightEl.textContent = maxWeight;
    if (totalVolumeEl) totalVolumeEl.textContent = totalVolume.toFixed(1);
}

function cancelEdit() {
    resetForm();
    showNotification('Edit cancelled', 'info');
}

// -------------------------
// Video Preview (Your theme)
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
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1].split('?')[0].split('&')[0];
        }
        return null;
    } catch (error) {
        console.error('Error extracting YouTube ID:', error);
        return null;
    }
}

function getVideoEmbed(url) {
    try {
        if (!url) return '';
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = extractYouTubeId(url);
            if (videoId) {
                return `<iframe src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; height: 400px; border-radius: 8px;"></iframe>`;
            }
        } else if (url.includes('vimeo.com')) {
            const videoId = url.split('/').pop().split('?')[0];
            if (videoId) {
                return `<iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width: 100%; height: 400px; border-radius: 8px;"></iframe>`;
            }
        }
    } catch (error) {
        console.error('Error creating video embed:', error);
    }

    return `
        <div style="text-align: center; padding: 40px; background: rgba(255, 68, 68, 0.1); border-radius: 8px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff4444; margin-bottom: 15px;"></i>
            <h4 style="color: #ff4444; margin-bottom: 10px;">Video Preview Not Available</h4>
            <p style="color: #cccccc;">This video URL cannot be embedded for preview.</p>
            <a href="${escapeHtml(url)}" target="_blank" class="action-btn btn-preview" style="text-decoration: none; margin-top: 15px; display: inline-block;">
                <i class="fas fa-external-link-alt"></i> View Original URL
            </a>
        </div>
    `;
}

function previewExercise(exerciseId) {
    const exercise = currentExercises.find(ex => ex.id === exerciseId || ex.id == exerciseId);

    if (!exercise) {
        showNotification('Exercise not found', 'error');
        return;
    }

    if (!exercise.exercise_url || exercise.exercise_url.trim() === '') {
        showNotification('This exercise does not have a video URL', 'error');
        return;
    }

    if (!isValidVideoUrl(exercise.exercise_url)) {
        showNotification('This exercise does not have a valid video URL for preview', 'error');
        return;
    }

    const modalHtml = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${escapeHtml(exercise.exercise_name)} - Video Preview</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="video-preview-info" style="margin-bottom: 15px; padding: 12px; background: rgba(139, 0, 0, 0.1); border-radius: 6px; border-left: 3px solid #8b0000;">
                        <p style="margin: 0; color: #cccccc; font-size: 0.9rem;"><i class="fas fa-info-circle"></i> If video doesn't play, use the "View Original" link below.</p>
                    </div>
                    <div class="video-container">
                        ${getVideoEmbed(exercise.exercise_url)}
                    </div>
                    <div style="margin-top: 20px;">
                        <h4 style="color: #cccccc; margin-bottom: 10px;">Description</h4>
                        <p style="color: #ffffff; line-height: 1.5;">${escapeHtml(exercise.exercise_description || 'No description available')}</p>
                    </div>
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <a href="${escapeHtml(exercise.exercise_url)}" target="_blank" class="action-btn btn-preview" style="text-decoration: none;">
                            <i class="fas fa-external-link-alt"></i> View Original Video
                        </a>
                        <button class="action-btn btn-edit" onclick="closeModal()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
}

// -------------------------
// CSS Injection (Your exact theme)
// -------------------------
(function injectStyles() {
    const styleId = 'workout-tracker-theme';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        :root {
            --primary-bg: #0c0c0c;
            --secondary-bg: #1a1a1a;
            --accent-color: #8b0000;
            --text-primary: #ffffff;
            --text-secondary: #cccccc;
            --border-color: rgba(255, 255, 255, 0.1);
            --card-bg: rgba(15, 15, 15, 0.95);
            --success-color: #00cc00;
            --error-color: #ff4444;
            --warning-color: #ffaa00;
            --info-color: #007bff;
        }

        body {
            background: linear-gradient(135deg, var(--primary-bg) 0%, var(--secondary-bg) 100%);
            min-height: 100vh;
            color: var(--text-primary);
            padding: 15px;
        }

        .container {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }

        /* Header Styles */
        .header {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 16px;
            border: 1px solid var(--border-color);
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
        }

        .header-content {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            justify-content: center;
        }

        .brand h1 {
            font-size: 1.8rem;
            font-weight: 700;
            background: linear-gradient(135deg, #ffffff 0%, #e6e6e6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .brand span {
            color: var(--accent-color);
            font-size: 0.8rem;
            font-weight: 300;
        }

        .header-controls {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }

        /* Button Styles */
        .control-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
        }

        .control-btn:hover {
            background: rgba(139, 0, 0, 0.2);
            border-color: var(--accent-color);
        }

        .btn-clear {
            background: rgba(255, 68, 68, 0.1);
            border-color: #ff4444;
            color: #ff4444;
        }

        .btn-clear:hover {
            background: #ff4444;
            color: white;
        }

        .cancel-btn {
            background: rgba(255, 68, 68, 0.2);
            border: 1px solid #ff4444;
            color: #ff4444;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
        }

        .cancel-btn:hover {
            background: #ff4444;
            color: white;
        }

        .submit-btn {
            background: linear-gradient(135deg, var(--accent-color) 0%, #a52a2a 100%);
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 20px;
            width: 100%;
        }

        .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(139, 0, 0, 0.4);
        }

        /* Statistics Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            backdrop-filter: blur(10px);
            text-align: center;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, 
                transparent, 
                rgba(139, 0, 0, 0.1), 
                transparent);
            transition: left 0.6s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 
                0 15px 35px rgba(139, 0, 0, 0.2),
                0 5px 15px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
            border-color: rgba(139, 0, 0, 0.3);
        }

        .stat-card:hover::before {
            left: 100%;
        }

        .stat-card:hover .stat-value {
            transform: scale(1.05);
        }

        .stat-card:hover .stat-label {
            color: var(--text-primary);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent-color) 0%, #a52a2a 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
            transition: all 0.3s ease;
            display: inline-block;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 0.8rem;
            font-weight: 300;
            transition: all 0.3s ease;
        }

        /* Main Content */
        .main-content {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        /* Form and Workout Sections */
        .form-section, .workouts-section {
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--border-color);
            backdrop-filter: blur(10px);
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .section-header {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin-bottom: 20px;
        }

        .section-header h2 {
            font-size: 1.5rem;
            font-weight: 600;
            background: linear-gradient(135deg, #ffffff 0%, #cccccc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .form-actions {
            display: flex;
            gap: 10px;
        }

        .date-filter {
            display: flex;
            justify-content: flex-end;
        }

        .date-input {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px;
            color: var(--text-primary);
            font-size: 0.9rem;
        }

        /* Form Styles */
        .exercise-form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .form-group {
            width: 100%;
        }

        .input-with-icon {
            position: relative;
            width: 100%;
        }

        .input-with-icon i {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--accent-color);
            font-size: 1rem;
            z-index: 1;
        }

        .input-with-icon input,
        .input-with-icon select {
            width: 100%;
            padding: 14px 45px 14px 45px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            color: var(--text-primary);
            font-size: 0.9rem;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .input-with-icon input:focus,
        .input-with-icon select:focus {
            outline: none;
            border-color: var(--accent-color);
            background: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 0 3px rgba(139, 0, 0, 0.2);
        }

        /* Sets Section */
        .sets-section {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 15px;
            margin-top: 15px;
        }

        .sets-header {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 15px;
        }

        .sets-header h3 {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .sets-controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .sets-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .set-row {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .set-inputs {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 10px;
            width: 100%;
            align-items: center;
        }

        .btn-remove-set {
            background: rgba(255, 68, 68, 0.2);
            border: 1px solid #ff4444;
            color: #ff4444;
            padding: 10px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .btn-remove-set:hover:not(:disabled) {
            background: #ff4444;
            color: white;
        }

        .btn-remove-set:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        /* Workouts Container */
        .workouts-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .workout-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }

        .workout-card:hover {
            transform: translateY(-2px);
            border-color: var(--accent-color);
            box-shadow: 0 8px 20px rgba(139, 0, 0, 0.2);
        }

        .workout-header {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 15px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
        }

        .workout-info h3 {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 5px;
            background: linear-gradient(135deg, #ffffff 0%, #cccccc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .workout-date {
            color: var(--accent-color);
            font-size: 0.85rem;
            font-weight: 500;
        }

        .workout-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .action-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.8rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 44px;
            justify-content: center;
        }

        .btn-edit {
            background: rgba(139, 0, 0, 0.2);
            color: var(--accent-color);
            border: 1px solid var(--accent-color);
        }

        .btn-edit:hover {
            background: var(--accent-color);
            color: white;
        }

        .btn-delete {
            background: rgba(255, 68, 68, 0.2);
            color: #ff4444;
            border: 1px solid #ff4444;
        }

        .btn-delete:hover {
            background: #ff4444;
            color: white;
        }

        /* Sets Table */
        .sets-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 0.85rem;
        }

        .sets-table th {
            background: rgba(139, 0, 0, 0.3);
            color: var(--text-primary);
            padding: 10px;
            text-align: left;
            font-weight: 600;
        }

        .sets-table td {
            padding: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            color: var(--text-secondary);
        }

        .set-number {
            font-weight: 600;
            color: var(--accent-color);
        }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666666;
        }

        .empty-state i {
            font-size: 2.5rem;
            margin-bottom: 15px;
            color: var(--accent-color);
        }

        .empty-state h3 {
            font-size: 1.3rem;
            margin-bottom: 8px;
            color: var(--text-secondary);
        }

        .empty-state p {
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        /* Notification Styles */
        .notification {
            position: fixed;
            top: 15px;
            right: 15px;
            left: 15px;
            padding: 12px 16px;
            border-radius: 10px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            z-index: 1001;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            animation: slideInRight 0.3s ease;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .notification-success {
            background: rgba(0, 150, 0, 0.9);
            border-left: 4px solid var(--success-color);
        }

        .notification-error {
            background: rgba(200, 0, 0, 0.9);
            border-left: 4px solid var(--error-color);
        }

        .notification-warning {
            background: rgba(200, 150, 0, 0.9);
            border-left: 4px solid var(--warning-color);
        }

        .notification-info {
            background: rgba(0, 100, 200, 0.9);
            border-left: 4px solid var(--info-color);
        }

        .notification-content {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
        }

        .notification-close {
            background: none;
            border: none;
            color: white;
            font-size: 1rem;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: background-color 0.3s ease;
            min-width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .notification-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        .notification.fade-out {
            animation: slideOutRight 0.3s ease forwards;
        }

        /* Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        }

        .modal-content {
            background: #2d2d2d;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            width: 90%;
            max-width: 900px;
            max-height: 90vh;
            overflow-y: auto;
            border: 1px solid #444;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #444;
            background: #363636;
            border-radius: 12px 12px 0 0;
        }

        .modal-header h3 {
            margin: 0;
            color: #ffffff;
            font-size: 1.4rem;
        }

        .modal-close {
            background: none;
            border: none;
            color: #cccccc;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.3s ease;
        }

        .modal-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
        }

        .modal-body {
            padding: 20px;
        }

        .video-container {
            margin-bottom: 20px;
            border-radius: 8px;
            overflow: hidden;
        }

        /* Close modal when clicking outside */
        .modal-overlay {
            cursor: pointer;
        }

        .modal-overlay .modal-content {
            cursor: default;
        }

        /* Preview Button Styles */
        .btn-preview {
            background: rgba(0, 100, 200, 0.2);
            color: #007bff;
            border: 1px solid #007bff;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.8rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 44px;
            justify-content: center;
        }

        .btn-preview:hover:not(.disabled) {
            background: #007bff;
            color: white;
        }

        .btn-preview.disabled {
            background: rgba(255, 255, 255, 0.05);
            color: #666;
            border: 1px solid #444;
            cursor: not-allowed;
            opacity: 0.5;
        }

        .btn-preview.disabled:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #666;
            border: 1px solid #444;
        }

        /* Exercise Select Dropdown */
        .input-with-icon select {
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            cursor: pointer;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b0000' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 15px center;
            background-size: 12px;
        }

        .input-with-icon select option {
            background: var(--primary-bg);
            color: var(--text-primary);
        }

        .input-with-icon select option:first-child {
            color: var(--text-secondary);
        }

        .input-with-icon select option:checked {
            background: var(--accent-color);
            color: white;
        }

        /* Responsive Design */
        @media (min-width: 768px) {
            body {
                padding: 20px;
            }

            .header-content {
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
            }

            .brand {
                justify-content: flex-start;
            }

            .header-controls {
                justify-content: flex-end;
            }

            .stats-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
            }

            .section-header {
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
            }

            .sets-header {
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
            }

            .set-row {
                flex-direction: row;
            }

            .set-inputs {
                grid-template-columns: 1fr 1fr auto;
            }

            .workout-header {
                flex-direction: row;
                justify-content: space-between;
                align-items: center;
            }

            .notification {
                left: auto;
                right: 20px;
                max-width: 400px;
            }
        }

        @media (min-width: 1024px) {
            .main-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
            }

            .brand h1 {
                font-size: 2rem;
            }

            .brand span {
                font-size: 0.9rem;
            }
        }
    `;
    document.head.appendChild(style);
})();

// -------------------------
// Global Exports
// -------------------------
window.addSet = addSet;
window.removeSet = removeSet;
window.cancelEdit = cancelEdit;
window.previewExercise = previewExercise;
window.closeModal = closeModal;
window.editExercise = editExercise;
window.deleteExercise = deleteExercise;

// -------------------------
// Padding Block
// -------------------------
/*
Padding lines...
// 1
// 2
// 3
... (additional padding lines)
// 100
*/