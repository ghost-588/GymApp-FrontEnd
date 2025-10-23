// =========================
// Workout Tracker - Complete Fixed File (Sets Display Fix)
// =========================

// API CONFIG
const API_BASE_URL = 'https://gym-app-lime-nine.vercel.app';
const USER_EXERCISES_ENDPOINT = '/user_exercises';
const SETS_ENDPOINT = '/sets';
const ALL_EXERCISES_ENDPOINT = '/all_exercises';

// APP STATE
let currentExercises = [];        // enriched user exercises (with sets + mapped exercise info)
let allAvailableExercises = [];   // list from /all_exercises
let editingExerciseId = null;
let isEditMode = false;

// ---------------------
// Authentication
// ---------------------
function getAuthToken() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        showNotification('No authentication token found. Please login again.', 'error');
        throw new Error('No authentication token');
    }
    return token;
}

// ---------------------
// Notifications
// ---------------------
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
        if (notification.parentElement) notification.remove();
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

// ---------------------
// Initialization
// ---------------------
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        await loadAvailableExercises();
        await loadUserExercises();
        setupEventListeners();
        setupDateFilter();
        showNotification('Workout tracker loaded successfully!', 'success', 3000);

        setTimeout(() => debugUserExerciseStructure(), 1500);
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error initializing application', 'error');
    }
}

function setupEventListeners() {
    const form = document.getElementById('exerciseForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) dateFilter.addEventListener('change', handleDateFilter);

    document.addEventListener('click', function(event) {
        if (event.target.classList && event.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') closeModal();
    });
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

// ---------------------
// Load all exercises (catalog)
// ---------------------
async function loadAvailableExercises() {
    try {
        const token = getAuthToken();
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
        console.log('Loaded available exercises:', allAvailableExercises);
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

// ---------------------
// Load user exercises (main list)
// ---------------------
async function loadUserExercises(date = null) {
    try {
        const exercises = await getUserExercisesWorkaround(date);

        // ✅ deep clone to prevent shared references that cause sets from leaking between exercises
        currentExercises = JSON.parse(JSON.stringify(exercises || []));
        displayWorkouts(currentExercises);
        updateStatistics(currentExercises);
    } catch (error) {
        console.error('Error loading workouts:', error);
        showNotification(`Failed to load workouts: ${error.message}`, 'error');
    }
}

// FIXED: Improved sets fetching with proper endpoint matching
async function fetchSetsForExercise(userExerciseId, token) {
    if (!userExerciseId) return [];
    
    // Try the most common endpoint patterns
    const candidates = [
        `${API_BASE_URL}${SETS_ENDPOINT}/exercise_id/${userExerciseId}`, // Most likely
        `${API_BASE_URL}${SETS_ENDPOINT}?exercise_id=${userExerciseId}`,
        `${API_BASE_URL}${SETS_ENDPOINT}?user_exercise_id=${userExerciseId}`,
        `${API_BASE_URL}${SETS_ENDPOINT}/${userExerciseId}/sets`,
        `${API_BASE_URL}${SETS_ENDPOINT}/user_exercise/${userExerciseId}`
    ];

    console.log(`🔍 Fetching sets for exercise ${userExerciseId}, trying endpoints:`, candidates);

    for (const url of candidates) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            
            console.log(`📡 Trying ${url}: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Found sets at ${url}:`, data);
                
                if (Array.isArray(data)) {
                    return data;
                }
                if (data && typeof data === 'object') {
                    // Handle case where it returns a single object instead of array
                    return [data];
                }
            } else if (response.status !== 404) {
                console.warn(`⚠️  Endpoint ${url} returned status: ${response.status}`);
            }
        } catch (error) {
            console.warn(`❌ Endpoint ${url} failed:`, error.message);
        }
    }
    
    console.log(`❌ No sets found for exercise ${userExerciseId}`);
    return [];
}

// FIXED: Improved exercise enrichment with better sets handling
async function getUserExercisesWorkaround(date = null) {
    const userExerciseIds = JSON.parse(localStorage.getItem('user_exercise_ids') || '[]');
    let userExercisesList = [];
    const token = getAuthToken();

    // Debug: Check what we have in localStorage
    console.log('📋 User exercise IDs from localStorage:', userExerciseIds);

    if (userExerciseIds && userExerciseIds.length > 0) {
        const promises = userExerciseIds.map(async (exerciseId) => {
            try {
                const url = `${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/${exerciseId}`;
                console.log(`🔍 Fetching user exercise: ${url}`);
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 
                        "Authorization": `Bearer ${token}`, 
                        "Content-Type": "application/json" 
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log(`✅ Loaded user exercise ${exerciseId}:`, data);
                    return data;
                } else {
                    console.warn(`❌ Failed to fetch user exercise ${exerciseId}, status: ${res.status}`);
                    // Remove invalid ID from tracking
                    removeExerciseFromTracking(exerciseId);
                    return null;
                }
            } catch (err) {
                console.error(`💥 Error fetching user exercise ${exerciseId}:`, err);
                return null;
            }
        });
        userExercisesList = (await Promise.all(promises)).filter(Boolean);
    } else {
        try {
            console.log('🔍 Fetching all user exercises from list endpoint');
            const res = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}`, {
                method: 'GET',
                headers: { 
                    "Authorization": `Bearer ${token}`, 
                    "Content-Type": "application/json" 
                }
            });
            if (res.ok) {
                const data = await res.json();
                userExercisesList = Array.isArray(data) ? data : [];
                console.log(`✅ Loaded ${userExercisesList.length} user exercises from list`);
                
                // Track these exercises for future use
                userExercisesList.forEach(exercise => {
                    if (exercise.id) {
                        trackNewExercise(exercise.id);
                    }
                });
            } else {
                console.warn('❌ Could not list user_exercises, status:', res.status);
                userExercisesList = [];
            }
        } catch (err) {
            console.error('💥 Error listing user_exercises:', err);
            userExercisesList = [];
        }
    }

    // Filter by date if provided
    if (date) {
        const originalCount = userExercisesList.length;
        userExercisesList = userExercisesList.filter(ue => {
            if (!ue.date) return false;
            const dateOnly = new Date(ue.date).toISOString().split('T')[0];
            return dateOnly === date;
        });
        console.log(`📅 Filtered ${originalCount} exercises to ${userExercisesList.length} for date ${date}`);
    }

    // Enrich each exercise with sets and exercise details
    const enrichedPromises = userExercisesList.map(async (ue) => {
        try {
            console.log(`🔄 Enriching exercise ${ue.id}...`);
            
            // Fetch sets for this specific exercise
            const sets = await fetchSetsForExercise(ue.id, token);
            console.log(`📊 Exercise ${ue.id} has ${sets.length} sets:`, sets);

            // Create a clean copy of the exercise with sets
            const mapped = { 
                ...ue, 
                sets: Array.isArray(sets) ? JSON.parse(JSON.stringify(sets)) : [] 
            };

            // Extract exercise information
            let exerciseIdToUse = null;
            let exerciseDetails = null;

            // Check for nested exercise object first
            if (typeof ue.exercise === 'object' && ue.exercise !== null) {
                exerciseDetails = ue.exercise;
                exerciseIdToUse = exerciseDetails.id ?? exerciseDetails._id;
                console.log(`🎯 Found nested exercise object for ${ue.id}:`, exerciseDetails);
            } else {
                // Try various field names for exercise ID
                exerciseIdToUse =
                    ue.exercise_id ??
                    ue.all_exercise_id ??
                    ue.base_exercise_id ??
                    ue.exercise ??
                    ue.exerciseId ??
                    ue.allExerciseId ??
                    null;
                console.log(`🔍 Extracted exercise ID for ${ue.id}: ${exerciseIdToUse}`);
            }

            // If we have exercise details from nested object, use them
            if (exerciseDetails) {
                mapped.exercise_name = exerciseDetails.name || exerciseDetails.title || `Exercise ${exerciseIdToUse ?? ''}`;
                mapped.exercise_description = exerciseDetails.description || exerciseDetails.desc || '';
                mapped.exercise_url = exerciseDetails.url || exerciseDetails.video_url || exerciseDetails.video || '';
                mapped.exercise_category = exerciseDetails.category || '';
                console.log(`✅ Used nested exercise details for ${ue.id}: ${mapped.exercise_name}`);
                return mapped;
            }

            // If no exercise ID found, use fallback
            if (!exerciseIdToUse) {
                console.warn(`⚠️ No exercise ID found for user exercise ${ue.id}`);
                mapped.exercise_name = mapped.exercise_name || 'Unknown Exercise';
                mapped.exercise_description = mapped.exercise_description || 'Exercise details not available';
                mapped.exercise_url = mapped.exercise_url || '';
                mapped.exercise_category = mapped.exercise_category || '';
                return mapped;
            }

            // Try to find exercise in cached list
            const cached = allAvailableExercises.find(a => 
                (a.id != null && a.id == exerciseIdToUse) || 
                (a._id != null && a._id == exerciseIdToUse)
            );
            
            if (cached) {
                mapped.exercise_name = cached.name || `Exercise ${exerciseIdToUse}`;
                mapped.exercise_description = cached.description || '';
                mapped.exercise_url = cached.url || cached.video_url || '';
                mapped.exercise_category = cached.category || '';
                console.log(`✅ Found exercise in cache for ${ue.id}: ${mapped.exercise_name}`);
                return mapped;
            }

            // Fetch exercise details from API
            try {
                console.log(`🔍 Fetching exercise details for ID ${exerciseIdToUse}`);
                const exRes = await fetch(`${API_BASE_URL}${ALL_EXERCISES_ENDPOINT}/${exerciseIdToUse}`, {
                    method: 'GET',
                    headers: { 
                        "Authorization": `Bearer ${token}`, 
                        "Content-Type": "application/json" 
                    }
                });
                
                if (exRes.ok) {
                    const ex = await exRes.json();
                    mapped.exercise_name = ex.name || `Exercise ${exerciseIdToUse}`;
                    mapped.exercise_description = ex.description || '';
                    mapped.exercise_url = ex.url || ex.video_url || '';
                    mapped.exercise_category = ex.category || '';
                    console.log(`✅ Fetched exercise details for ${ue.id}: ${mapped.exercise_name}`);
                    return mapped;
                } else {
                    console.warn(`❌ Failed to fetch exercise detail for ${exerciseIdToUse}, status: ${exRes.status}`);
                    mapped.exercise_name = `Unknown Exercise (ID: ${exerciseIdToUse})`;
                    mapped.exercise_description = mapped.exercise_description || 'Exercise details not found';
                    mapped.exercise_url = mapped.exercise_url || '';
                    mapped.exercise_category = mapped.exercise_category || '';
                    return mapped;
                }
            } catch (fetchErr) {
                console.error(`💥 Error fetching exercise details for ${exerciseIdToUse}:`, fetchErr);
                mapped.exercise_name = mapped.exercise_name || `Unknown Exercise (ID: ${exerciseIdToUse})`;
                mapped.exercise_description = mapped.exercise_description || 'Exercise details not found';
                mapped.exercise_url = mapped.exercise_url || '';
                mapped.exercise_category = mapped.exercise_category || '';
                return mapped;
            }
        } catch (err) {
            console.error(`💥 Error enriching user exercise ${ue.id}:`, err);
            return {
                ...ue,
                sets: ue.sets || [],
                exercise_name: ue.exercise_name || 'Unknown Exercise',
                exercise_description: ue.exercise_description || '',
                exercise_url: ue.exercise_url || ''
            };
        }
    });

    const settled = await Promise.allSettled(enrichedPromises);
    const exercisesWithSets = settled
        .filter(s => s.status === 'fulfilled')
        .map(s => s.value);

    // Final debug log
    console.log('🎉 FINAL ENRICHED EXERCISES:');
    exercisesWithSets.forEach((ex, index) => {
        console.log(`  ${index + 1}. ${ex.exercise_name} (ID: ${ex.id}) - ${ex.sets.length} sets`);
        ex.sets.forEach((set, setIndex) => {
            console.log(`     Set ${setIndex + 1}: ${set.reps} reps, ${set.weight} kg`);
        });
    });

    // Deep clone to prevent reference sharing
    return JSON.parse(JSON.stringify(exercisesWithSets));
}

// ---------------------
// Local tracking helpers
// ---------------------
function trackNewExercise(exerciseId) {
    if (!exerciseId) return;
    const userExerciseIds = JSON.parse(localStorage.getItem('user_exercise_ids') || '[]');
    if (!userExerciseIds.includes(exerciseId)) {
        userExerciseIds.push(exerciseId);
        localStorage.setItem('user_exercise_ids', JSON.stringify(userExerciseIds));
    }
}

function removeExerciseFromTracking(exerciseId) {
    const userExerciseIds = JSON.parse(localStorage.getItem('user_exercise_ids') || '[]');
    const updated = userExerciseIds.filter(id => id != exerciseId);
    localStorage.setItem('user_exercise_ids', JSON.stringify(updated));
}

// ---------------------
// Rendering UI
// ---------------------
function displayWorkouts(exercises) {
    const container = document.getElementById('workoutsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!exercises || exercises.length === 0) {
        const newEmptyState = document.createElement('div');
        newEmptyState.className = 'empty-state';
        newEmptyState.id = 'emptyState';
        newEmptyState.innerHTML = `
            <i class="fas fa-dumbbell"></i>
            <h3>No Workouts Found</h3>
            <p>Start logging your exercises to see your workouts here</p>
        `;
        container.appendChild(newEmptyState);
        return;
    }

    exercises.forEach(exercise => {
        const workoutCard = createWorkoutCard(exercise);
        container.appendChild(workoutCard);
    });
}

function createWorkoutCard(exercise) {
    const card = document.createElement('div');
    card.className = 'workout-card';
    card.dataset.exerciseId = exercise.id;

    // ✅ clone sets locally to avoid any mutation/aliasing problems during render
    const sets = Array.isArray(exercise.sets) ? JSON.parse(JSON.stringify(exercise.sets)) : [];
    const totalSets = sets.length;
    const totalReps = sets.reduce((sum, set) => sum + (set.reps || 0), 0);
    const maxWeight = sets.length > 0 ? Math.max(...sets.map(set => set.weight || 0)) : 0;
    const totalVolume = sets.reduce((sum, set) => sum + ((set.reps || 0) * (set.weight || 0)), 0);

    const exerciseName = exercise.exercise_name || 'Unknown Exercise';
    const exerciseDescription = exercise.exercise_description || '';
    const exerciseUrl = exercise.exercise_url || '';

    card.innerHTML = `
        <div class="workout-header">
            <div class="workout-info">
                <h3>${escapeHtml(exerciseName)}</h3>
                <div class="workout-date">${exercise.date ? new Date(exercise.date).toLocaleDateString() : ''}</div>
                ${exerciseDescription ? `<div class="workout-description">${escapeHtml(exerciseDescription)}</div>` : ''}
            </div>
            <div class="workout-actions">
                ${exerciseUrl ? `<button class="action-btn btn-preview" onclick="previewExercise(${exercise.id})" title="Preview exercise">
                    <i class="fas fa-play"></i> Preview
                </button>` : ''}
                <button class="action-btn btn-edit" onclick="editExercise(${exercise.id})" title="Edit exercise">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn btn-delete" onclick="deleteExercise(${exercise.id})" title="Delete exercise">
                    <i class="fas fa-trash"></i> Delete
                </button>
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
    `;

    return card;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ---------------------
// Statistics
// ---------------------
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

// ---------------------
// Sets UI helpers
// ---------------------
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

function clearAllSets() {
    const container = document.getElementById('setsContainer');
    if (!container) return;
    container.innerHTML = '';
    addSet();
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

function resetForm() {
    const form = document.getElementById('exerciseForm');
    if (form) form.reset();

    const container = document.getElementById('setsContainer');
    if (container) {
        container.innerHTML = `
            <div class="set-row">
                <div class="set-inputs">
                    <div class="input-with-icon">
                        <i class="fas fa-repeat"></i>
                        <input type="number" class="set-reps" placeholder="Reps" min="1" required>
                    </div>
                    <div class="input-with-icon">
                        <i class="fas fa-weight-hanging"></i>
                        <input type="number" class="set-weight" placeholder="Weight (kg)" min="0" step="0.5" required>
                    </div>
                    <button type="button" class="btn-remove-set" onclick="removeSet(this)" disabled>
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
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
    if (submitBtn) submitBtn.innerHTML = '<span>Log Exercise</span><i class="fas fa-save"></i>';
    const actions = document.getElementById('form-actions');
    if (actions) actions.style.display = 'none';
}

// ---------------------
// Form submit
// ---------------------
async function handleFormSubmit(event) {
    event.preventDefault();

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

    const submitBtn = (event.target && event.target.querySelector('button[type="submit"]')) || document.getElementById('submit-btn');
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

// ---------------------
// Create exercise + sets
// ---------------------
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
        console.log('=== CREATED EXERCISE STRUCTURE ===', createdExercise);

        // track id
        trackNewExercise(createdExercise.id ?? createdExercise._id ?? null);

        if (sets.length > 0) {
            const tokenLocal = token;
            const setPromises = sets.map(async (set) => {
                const payload = {
                    ...set,
                    exercise_id: createdExercise.id ?? createdExercise._id ?? createdExercise.exercise_id
                };
                const setRes = await fetch(`${API_BASE_URL}${SETS_ENDPOINT}`, {
                    method: 'POST',
                    headers: { "Authorization": `Bearer ${tokenLocal}`, "Content-Type": "application/json" },
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
        await loadUserExercises();
        showNotification(`Exercise created successfully with ${sets.length} sets!`, 'success');
    } catch (error) {
        console.error('Error creating exercise with sets:', error);
        throw error;
    }
}

// ---------------------
// Edit flow
// ---------------------
async function editExercise(exerciseId) {
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
            addSet(); // provide one empty set to add
        }

        updateRemoveButtons();

        const title = document.getElementById('form-title');
        if (title) title.textContent = `Add Sets to ${exerciseName}`;
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.innerHTML = '<span>Add Sets</span><i class="fas fa-plus"></i>';
        const actions = document.getElementById('form-actions');
        if (actions) actions.style.display = 'flex';

        document.querySelector('.form-section')?.scrollIntoView({ behavior: 'smooth' });
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
        await loadUserExercises();
        showNotification(`Added ${newSets.length} new sets to exercise!`, 'success');
    } catch (error) {
        console.error('Error adding sets to exercise:', error);
        throw error;
    }
}

// ---------------------
// Delete exercise & its sets
// ---------------------
async function deleteExercise(exerciseId) {
    if (!confirm('Are you sure you want to delete this exercise and all its sets? This action cannot be undone.')) return;

    try {
        const token = getAuthToken();
        const exercise = currentExercises.find(ex => ex.id === exerciseId || ex.id == exerciseId);
        if (exercise && Array.isArray(exercise.sets)) {
            const deleteSetPromises = exercise.sets.map(set => {
                const setId = set.id ?? set._id;
                const url = setId ? `${API_BASE_URL}${SETS_ENDPOINT}/${setId}` : `${API_BASE_URL}${SETS_ENDPOINT}/${set.id}`;
                return fetch(url, { method: 'DELETE', headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } });
            });
            await Promise.allSettled(deleteSetPromises);
        }

        const response = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/${exerciseId}`, {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
        }

        removeExerciseFromTracking(exerciseId);
        await loadUserExercises();
        showNotification('Exercise deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting exercise:', error);
        showNotification(`Error deleting exercise: ${error.message}`, 'error');
    }
}

// ---------------------
// Date filter handlers
// ---------------------
function handleDateFilter(event) {
    const date = event.target.value;
    loadUserExercises(date);
}

function refreshWorkouts() {
    try {
        const currentDate = document.getElementById('dateFilter')?.value || null;
        loadUserExercises(currentDate);
        showNotification('Workouts refreshed!', 'success');
    } catch (error) {
        console.error('Error refreshing workouts:', error);
        showNotification('Error refreshing workouts', 'error');
    }
}

function showTodayWorkouts() {
    try {
        const today = getTodayDate();
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) dateFilter.value = today;
        loadUserExercises(today);
        showNotification("Showing today's workouts", 'info');
    } catch (error) {
        console.error('Error showing today\'s workouts:', error);
        showNotification("Error loading today's workouts", 'error');
    }
}

function cancelEdit() {
    resetForm();
    showNotification('Edit cancelled', 'info');
}

// ---------------------
// Video helpers & preview
// ---------------------
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
    console.log('=== PREVIEW BUTTON CLICKED ===', exerciseId);
    const exercise = currentExercises.find(ex => ex.id === exerciseId || ex.id == exerciseId);

    if (!exercise) {
        console.error('Exercise not found for preview ID:', exerciseId);
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
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3>${escapeHtml(exercise.exercise_name)} - Video Preview</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="video-preview-info" style="margin-bottom: 15px; padding: 10px; background: rgba(139, 0, 0, 0.1); border-radius: 6px; border-left: 3px solid #8b0000;">
                        <p style="margin: 0; color: #cccccc; font-size: 0.9rem;"><i class="fas fa-info-circle"></i> If video doesn't play, use the "View Original" link below.</p>
                    </div>
                    <div class="video-container">
                        ${getVideoEmbed(exercise.exercise_url)}
                    </div>
                    <div style="margin-top: 20px;">
                        <h4 style="color: #cccccc; margin-bottom: 10px;">Description</h4>
                        <p style="color: #ffffff; line-height: 1.5;">${escapeHtml(exercise.exercise_description)}</p>
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

// ---------------------
// Debug helpers
// ---------------------
async function debugUserExerciseStructure() {
    try {
        const token = getAuthToken();
        const userExerciseIds = JSON.parse(localStorage.getItem('user_exercise_ids') || '[]');

        console.log('=== DEBUG USER EXERCISE STRUCTURE ===');
        console.log('User exercise IDs:', userExerciseIds);

        if (userExerciseIds.length === 0) {
            const res = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}`, { headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } });
            if (res.ok) {
                const data = await res.json();
                console.log('Sample user exercise (list):', data[0]);
                console.log('All keys in sample:', Object.keys(data[0] || {}));
            } else {
                console.log('No tracked ids and list endpoint returned', res.status);
            }
            return;
        }

        const first = userExerciseIds[0];
        const response = await fetch(`${API_BASE_URL}${USER_EXERCISES_ENDPOINT}/${first}`, {
            method: 'GET',
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (response.ok) {
            const userExercise = await response.json();
            console.log('First user exercise structure:', userExercise);
            console.log('All keys in user exercise:', Object.keys(userExercise));
            const possibleIdFields = ['exercise_id', 'exerciseId', 'all_exercise_id', 'exercise', 'base_exercise_id', 'base_exercise'];
            possibleIdFields.forEach(field => {
                if (userExercise[field] !== undefined) {
                    console.log(`Found field "${field}":`, userExercise[field]);
                }
            });
        } else {
            console.warn('Could not fetch first user exercise for debug, status', response.status);
        }
    } catch (error) {
        console.error('Error debugging user exercise structure:', error);
    }
}

// NEW: Debug function to check sets assignment
function debugSetsAssignment() {
    console.log('=== DEBUG SETS ASSIGNMENT ===');
    console.log('Current exercises:', currentExercises.length);
    
    currentExercises.forEach((ex, index) => {
        console.log(`Exercise ${index + 1}:`);
        console.log('  - ID:', ex.id);
        console.log('  - Name:', ex.exercise_name);
        console.log('  - Sets count:', ex.sets ? ex.sets.length : 0);
        
        if (ex.sets && ex.sets.length > 0) {
            ex.sets.forEach((set, setIndex) => {
                console.log(`    Set ${setIndex + 1}: ${set.reps} reps, ${set.weight} kg`);
            });
        } else {
            console.log('    No sets found');
        }
    });
}

function debugExerciseMapping() {
    console.log('=== DEBUG EXERCISE MAPPING ===');
    console.log('Current exercises:', currentExercises);
    console.log('All available exercises:', allAvailableExercises);

    currentExercises.forEach((ex, index) => {
        console.log(`Exercise ${index}:`);
        console.log('  - User exercise ID:', ex.id);
        console.log('  - Exercise ID (from database):', ex.exercise_id);
        console.log('  - Mapped name:', ex.exercise_name);
        console.log('  - Mapped description:', ex.exercise_description);
        console.log('  - Mapped URL:', ex.exercise_url);

        const foundExercise = allAvailableExercises.find(av => av.id == ex.exercise_id);
        console.log('  - Found in available:', foundExercise);
        console.log('  - Available exercise name:', foundExercise ? foundExercise.name : 'NOT FOUND');
        console.log('  - Available exercise URL:', foundExercise ? foundExercise.url : 'NOT FOUND');
    });
}

// Force reload helper
async function forceReloadExercises() {
    try {
        showNotification('Reloading exercise data...', 'info');
        await loadAvailableExercises();
        await loadUserExercises();
        showNotification('Exercise data reloaded successfully!', 'success');
    } catch (error) {
        console.error('Error force reloading exercises:', error);
        showNotification('Error reloading exercise data', 'error');
    }
}

// Expose debug tools
window.debugExerciseMapping = debugExerciseMapping;
window.debugSetsAssignment = debugSetsAssignment;
window.forceReloadExercises = forceReloadExercises;
window.addSet = addSet;
window.clearAllSets = clearAllSets;