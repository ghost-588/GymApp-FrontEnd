// Global variables
const API_BASE_URL = 'https://gym-app-lime-nine.vercel.app';
let currentUserId = null;
let allExercises = [];
let allSets = [];
let exerciseNamesMap = new Map(); // To store exercise names by ID
let filteredExercises = []; // Track currently displayed exercises
let filteredSets = []; // Track currently displayed sets

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get user ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    currentUserId = urlParams.get('user_id') || localStorage.getItem('selectedUserId');
    
    console.log('URL Parameters:', Object.fromEntries(urlParams.entries()));
    console.log('Extracted User ID:', currentUserId);
    
    if (!currentUserId) {
        showNotification('No user ID provided. Please go back to users page and click "View Workouts".', 'error');
        // Add a back button for user convenience
        document.getElementById('workoutsContainer').innerHTML = `
            <div class="no-workouts-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>No User Selected</h3>
                <p>Please go back to users management and select a user to view workouts.</p>
                <a href="/admin_users/admin_users.html" class="control-btn back-btn" style="margin-top: 20px; display: inline-flex;">
                    <i class="fas fa-arrow-left"></i>
                    Back to Users
                </a>
            </div>
        `;
        return;
    }
    
    // Store the user ID for future use
    localStorage.setItem('selectedUserId', currentUserId);
    
    // Load user data and workouts
    loadUserData();
    loadUserWorkouts();
    
    // Set up date filter event listener
    document.getElementById('dateFilter').addEventListener('change', function() {
        filterWorkoutsByDate(this.value);
    });
});

// Load user basic information
async function loadUserData() {
    try {
        const token = localStorage.getItem("access_token");
        if (!token) {
            showNotification('Authentication required. Please log in again.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/users/${currentUserId}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load user data: ${response.status}`);
        }
        
        const userData = await response.json();
        displayUserInfo(userData);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Failed to load user information: ' + error.message, 'error');
    }
}

// Fetch all exercise names
async function fetchExerciseNames() {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`${API_BASE_URL}/all_exercises`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load exercise names: ${response.status}`);
        }

        const allExercises = await response.json();
        
        // Create a map of exercise_id -> exercise_name
        allExercises.forEach(exercise => {
            exerciseNamesMap.set(exercise.id, exercise.name || exercise.exercise_name || 'Unknown Exercise');
        });
        
        console.log('Exercise names loaded:', exerciseNamesMap);
        
    } catch (error) {
        console.error('Error loading exercise names:', error);
        showNotification('Failed to load exercise names', 'warning');
    }
}

// Load user exercises and sets
async function loadUserWorkouts() {
    try {
        // Show loading state
        document.getElementById('workoutsContainer').innerHTML = `
            <div class="no-workouts-message">
                <i class="fas fa-spinner fa-spin"></i>
                <h3>Loading Workouts...</h3>
                <p>Please wait while we fetch the user's exercises</p>
            </div>
        `;

        const token = localStorage.getItem("access_token");
        if (!token) {
            showNotification('Authentication required. Please log in again.', 'error');
            return;
        }

        // First, fetch all exercise names
        await fetchExerciseNames();

        // Then fetch user exercises
        const exercisesResponse = await fetch(`${API_BASE_URL}/user_exercises`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!exercisesResponse.ok) {
            throw new Error(`Failed to load exercises: ${exercisesResponse.status}`);
        }

        const allExercisesData = await exercisesResponse.json();
        
        console.log('All exercises data:', allExercisesData); // Debug log
        
        // Filter exercises for the current user
        const userExercises = allExercisesData.filter(exercise => {
            return exercise.user && exercise.user.id.toString() === currentUserId.toString();
        });

        console.log(`Found ${userExercises.length} exercises for user ${currentUserId}`, userExercises);

        // If no exercises found, show empty state
        if (userExercises.length === 0) {
            allExercises = [];
            filteredExercises = [];
            allSets = [];
            filteredSets = [];
            updateWorkoutStatistics();
            displayExercises([]);
            return;
        }

        // Fetch sets for each exercise and enrich with exercise names
        const exercisesWithSets = [];
        
        for (const exercise of userExercises) {
            try {
                const setsResponse = await fetch(`${API_BASE_URL}/sets/exercise_id/${exercise.id}`, {
                    method: 'GET',
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                // Get exercise name from our map
                const exerciseName = exerciseNamesMap.get(exercise.exercise_id) || 
                                   exercise.exercise?.name || 
                                   'Unknown Exercise';

                if (setsResponse.ok) {
                    const sets = await setsResponse.json();
                    exercisesWithSets.push({
                        exercise: {
                            ...exercise,
                            display_name: exerciseName
                        },
                        sets: sets
                    });
                } else {
                    // If sets can't be fetched, still show the exercise without sets
                    console.warn(`Could not fetch sets for exercise ${exercise.id}`);
                    exercisesWithSets.push({
                        exercise: {
                            ...exercise,
                            display_name: exerciseName
                        },
                        sets: []
                    });
                }
            } catch (setError) {
                console.error(`Error fetching sets for exercise ${exercise.id}:`, setError);
                const exerciseName = exerciseNamesMap.get(exercise.exercise_id) || 'Unknown Exercise';
                exercisesWithSets.push({
                    exercise: {
                        ...exercise,
                        display_name: exerciseName
                    },
                    sets: []
                });
            }
        }
        
        allExercises = exercisesWithSets;
        filteredExercises = [...exercisesWithSets]; // Initialize filtered exercises with all exercises
        
        // Collect all sets for statistics
        allSets = exercisesWithSets.flatMap(item => item.sets);
        filteredSets = [...allSets]; // Initialize filtered sets with all sets
        
        // Update statistics
        updateWorkoutStatistics();
        
        // Display exercises
        displayExercises(filteredExercises);
        
    } catch (error) {
        console.error('Error loading workouts:', error);
        showNotification('Failed to load user workouts: ' + error.message, 'error');
        document.getElementById('workoutsContainer').innerHTML = `
            <div class="no-workouts-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Workouts</h3>
                <p>${error.message}</p>
                <button onclick="loadUserWorkouts()" class="control-btn" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Display user information
function displayUserInfo(user) {
    document.getElementById('userName').textContent = `${user.first_name} ${user.last_name}`;
    
    const userDetails = document.getElementById('userDetails');
    userDetails.innerHTML = `
        <div class="user-detail-item">
            <span class="user-detail-label">Email</span>
            <span class="user-detail-value">${user.email}</span>
        </div>
        <div class="user-detail-item">
            <span class="user-detail-label">Role</span>
            <span class="user-detail-value">
                <span class="role-badge ${user.role === 'ADMIN' ? 'role-admin' : 'role-nonadmin'}">
                    ${user.role}
                </span>
            </span>
        </div>
        <div class="user-detail-item">
            <span class="user-detail-label">Member Since</span>
            <span class="user-detail-value">${formatDate(user.created_at)}</span>
        </div>
        <div class="user-detail-item">
            <span class="user-detail-label">Last Active</span>
            <span class="user-detail-value">${formatDate(user.updated_at)}</span>
        </div>
    `;
}

// Display exercises with their sets
function displayExercises(exercises) {
    const workoutsContainer = document.getElementById('workoutsContainer');
    
    if (exercises.length === 0) {
        workoutsContainer.innerHTML = `
            <div class="no-workouts-message">
                <i class="fas fa-dumbbell"></i>
                <h3>No Workouts Found</h3>
                <p>This user hasn't logged any workouts yet</p>
            </div>
        `;
        return;
    }

    // Sort exercises by date (newest first)
    exercises.sort((a, b) => new Date(b.exercise.date) - new Date(a.exercise.date));
    
    workoutsContainer.innerHTML = exercises.map(exercise => {
        const exerciseName = exercise.exercise.display_name || 'Unknown Exercise';
        
        return `
        <div class="workout-card" data-exercise-id="${exercise.exercise.id}">
            <div class="workout-header">
                <div class="workout-info">
                    <h3>${exerciseName}</h3>
                    <div class="workout-date">
                        <i class="far fa-calendar"></i>
                        ${formatDate(exercise.exercise.date)}
                    </div>
                </div>
                <div class="workout-actions">
                    <button class="action-btn btn-preview" onclick="viewExerciseDetails(${exercise.exercise.id})">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                </div>
            </div>
            
            ${exercise.sets.length > 0 ? `
                <table class="sets-table">
                    <thead>
                        <tr>
                            <th>Set</th>
                            <th>Weight (kg)</th>
                            <th>Reps</th>
                            <th>Volume</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exercise.sets.map((set, index) => `
                            <tr>
                                <td class="set-number">${index + 1}</td>
                                <td>${set.weight}</td>
                                <td>${set.reps}</td>
                                <td>${calculateVolume(set.weight, set.reps)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : `
                <p style="color: var(--text-secondary); text-align: center; padding: 20px;">
                    No sets recorded for this exercise
                </p>
            `}
            
            ${exercise.exercise.description ? `
                <div class="exercise-description">
                    <strong>Notes:</strong>
                    <p>${exercise.exercise.description}</p>
                </div>
            ` : ''}
        </div>
        `;
    }).join('');
    
    // Update workout count
    document.getElementById('workoutCount').textContent = `${exercises.length} workout${exercises.length !== 1 ? 's' : ''} found`;
}

// Update workout statistics based on currently displayed exercises
function updateWorkoutStatistics() {
    const totalWorkouts = filteredExercises.length;
    const totalSets = filteredSets.length;
    
    // Calculate max weight and total volume from filtered sets
    let maxWeight = 0;
    let totalVolume = 0;
    
    filteredSets.forEach(set => {
        const weight = Number(set.weight);
        const reps = Number(set.reps);
        
        if (weight > maxWeight) {
            maxWeight = weight;
        }
        totalVolume += weight * reps;
    });
    
    // Update DOM elements
    document.getElementById('totalWorkouts').textContent = totalWorkouts;
    document.getElementById('totalSets').textContent = totalSets;
    document.getElementById('maxWeight').textContent = maxWeight;
    document.getElementById('totalVolume').textContent = totalVolume.toLocaleString();
}

// Filter workouts by date and update statistics
function filterWorkoutsByDate(dateString) {
    if (!dateString) {
        // If no date selected, show all exercises and sets
        filteredExercises = [...allExercises];
        filteredSets = [...allSets];
    } else {
        const selectedDate = new Date(dateString);
        filteredExercises = allExercises.filter(exercise => {
            const exerciseDate = new Date(exercise.exercise.date);
            return exerciseDate.toDateString() === selectedDate.toDateString();
        });
        
        // Update filtered sets based on filtered exercises
        filteredSets = filteredExercises.flatMap(item => item.sets);
    }
    
    // Update display and statistics
    displayExercises(filteredExercises);
    updateWorkoutStatistics();
}

// View exercise details (modal)
async function viewExerciseDetails(exerciseId) {
    try {
        const token = localStorage.getItem("access_token");
        if (!token) {
            showNotification('Authentication required. Please log in again.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/user_exercises/${exerciseId}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load exercise details: ${response.status}`);
        }
        
        const exercise = await response.json();
        
        // Get exercise name for the modal
        const exerciseName = exerciseNamesMap.get(exercise.exercise_id) || 
                           exercise.exercise?.name || 
                           'Unknown Exercise';
        
        showExerciseModal(exercise, exerciseName);
        
    } catch (error) {
        console.error('Error loading exercise details:', error);
        showNotification('Failed to load exercise details', 'error');
    }
}

// Show exercise details modal
function showExerciseModal(exercise, exerciseName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${exerciseName}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="workout-info">
                    <p><strong>Date:</strong> ${formatDate(exercise.date)}</p>
                    <p><strong>User:</strong> ${exercise.user ? `${exercise.user.first_name} ${exercise.user.last_name}` : 'N/A'}</p>
                    ${exercise.description ? `<p><strong>Description:</strong> ${exercise.description}</p>` : ''}
                </div>
                
                ${exercise.video_url ? `
                    <div class="video-container">
                        <video controls style="width: 100%; border-radius: 8px;">
                            <source src="${exercise.video_url}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function calculateVolume(weight, reps) {
    const volume = Number(weight) * Number(reps);
    return volume.toFixed(0);
}

function refreshWorkouts() {
    loadUserWorkouts();
    showNotification('Workouts refreshed', 'success');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
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
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}