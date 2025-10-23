// API configuration
const API_BASE_URL = 'https://gym-app-lime-nine.vercel.app'; // Your API URL
const EXERCISES_ENDPOINT = '/all_exercises'; // Adjust based on your API route
const token = localStorage.getItem("access_token");
// Global variable to store current exercises
let currentExercises = [];

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize the application
function initializeApp() {
    initializeExercises();
    setupEventListeners();
}

// Setup all event listeners
function setupEventListeners() {
    const addExerciseForm = document.getElementById("addExerciseForm");
    const searchInput = document.getElementById("searchInput");
    
    if (addExerciseForm) {
        addExerciseForm.addEventListener("submit", handleFormSubmit);
    }
    
    if (searchInput) {
        searchInput.addEventListener("input", handleSearch);
    }
    
    // Add global event listeners
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
}

// Function to fetch all exercises from API
async function fetchAllExercises() {
    try {
        const response = await fetch(`${API_BASE_URL}${EXERCISES_ENDPOINT}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const exercises = await response.json();
        return exercises;
    } catch (error) {
        console.error('Error fetching exercises:', error);
        throw error;
    }
}

// Function to fetch a specific exercise by ID
async function fetchExerciseById(exerciseId) {
    try {
        const response = await fetch(`${API_BASE_URL}${EXERCISES_ENDPOINT}/${exerciseId}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const exercise = await response.json();
        return exercise;
    } catch (error) {
        console.error('Error fetching exercise:', error);
        throw error;
    }
}

// Function to create exercise card
function createExerciseCard(exercise) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.innerHTML = `
        <div class="exercise-header">
            <div class="exercise-icon">
                <i class="fas fa-dumbbell"></i>
            </div>
            <div class="exercise-info">
                <h3>${exercise.name}</h3>
                <a href="${exercise.url}" target="_blank" class="exercise-url" onclick="event.stopPropagation()">
                    <i class="fas fa-external-link-alt"></i> View Original
                </a>
            </div>
        </div>
        <div class="exercise-description">
            ${exercise.description}
        </div>
        <div class="exercise-details">
            <div class="exercise-detail-item">
                <span class="exercise-detail-label">Exercise ID</span>
                <span class="exercise-detail-value">#${exercise.id}</span>
            </div>
            <div class="exercise-detail-item">
                <span class="exercise-detail-label">Video Available</span>
                <span class="exercise-detail-value">${isValidVideoUrl(exercise.url) ? 'Yes' : 'No'}</span>
            </div>
            <div class="exercise-detail-item">
                <span class="exercise-detail-label">Description</span>
                <span class="exercise-detail-value">${exercise.description.length} chars</span>
            </div>
        </div>
        <div class="exercise-actions">
            <button class="exercise-action-btn btn-preview" onclick="previewExercise(${exercise.id})" ${!isValidVideoUrl(exercise.url) ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                <i class="fas fa-play"></i> ${isValidVideoUrl(exercise.url) ? 'Preview' : 'No Video'}
            </button>
            <button class="exercise-action-btn btn-edit-exercise" onclick="editExercise(${exercise.id})">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="exercise-action-btn btn-delete-exercise" onclick="deleteExercise(${exercise.id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    return card;
}

// Helper function to check if URL is a valid video URL
function isValidVideoUrl(url) {
    if (!url) return false;
    
    // Check for YouTube URLs
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    
    // Check for Vimeo URLs
    const vimeoRegex = /^(https?:\/\/)?(www\.)?vimeo\.com\/.+$/;
    
    return youtubeRegex.test(url) || vimeoRegex.test(url);
}

// Function to load exercises into the grid
function loadExercises(exercises) {
    const exercisesGrid = document.getElementById('exercisesGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!exercisesGrid) {
        console.error('Exercises grid element not found');
        return;
    }
    
    // Clear existing content
    exercisesGrid.innerHTML = '';
    
    if (exercises.length === 0) {
        if (emptyState) {
            exercisesGrid.appendChild(emptyState);
            emptyState.style.display = 'block';
        } else {
            const fallbackEmptyState = document.createElement('div');
            fallbackEmptyState.className = 'empty-state';
            fallbackEmptyState.innerHTML = `
                <i class="fas fa-dumbbell"></i>
                <h3>No Exercises Found</h3>
                <p>No exercises match your search criteria</p>
            `;
            exercisesGrid.appendChild(fallbackEmptyState);
        }
    } else {
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        exercises.forEach(exercise => {
            const exerciseCard = createExerciseCard(exercise);
            exercisesGrid.appendChild(exerciseCard);
        });
    }
    
    updateStatistics(exercises);
}

// Function to update statistics
function updateStatistics(exercises) {
    const totalExercisesEl = document.getElementById('total-exercises');
    const recentExercisesEl = document.getElementById('recent-exercises');
    const videoExercisesEl = document.getElementById('video-exercises');
    const popularExercisesEl = document.getElementById('popular-exercises');
    
    if (totalExercisesEl) totalExercisesEl.textContent = exercises.length;
    
    if (recentExercisesEl) {
        // Count exercises added in the last 7 days (mock data - adjust based on your actual data)
        const recentCount = exercises.filter(ex => {
            // This would normally check created_at timestamp
            return true; // Mock: all exercises are considered recent for demo
        }).length;
        recentExercisesEl.textContent = recentCount;
    }
    
    if (videoExercisesEl) {
        // Count exercises with valid video URLs
        const videoCount = exercises.filter(ex => isValidVideoUrl(ex.url)).length;
        videoExercisesEl.textContent = videoCount;
    }
    
    if (popularExercisesEl) {
        // Mock popular count (would normally come from usage data)
        popularExercisesEl.textContent = Math.floor(exercises.length * 0.3);
    }
}

// Function to initialize and load exercises
async function initializeExercises() {
    try {
        const exercisesGrid = document.getElementById('exercisesGrid');
        if (exercisesGrid) {
            exercisesGrid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading exercises...</h3></div>';
        }
        
        const exercises = await fetchAllExercises();
        currentExercises = exercises;
        loadExercises(exercises);
    } catch (error) {
        console.error('Error initializing exercises:', error);
        const exercisesGrid = document.getElementById('exercisesGrid');
        if (exercisesGrid) {
            exercisesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Exercises</h3>
                    <p>${error.message}</p>
                    <button onclick="initializeExercises()" class="login-btn" style="margin-top: 20px; max-width: 200px; margin-left: auto; margin-right: auto;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
        showNotification(`Error loading exercises: ${error.message}`, 'error');
    }
}

// Form submit handler
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const editingExerciseId = form.dataset.editingExerciseId;
    
    if (editingExerciseId) {
        await updateExercise(parseInt(editingExerciseId), form, submitBtn);
    } else {
        await createExercise(form, submitBtn, originalText);
    }
}

// Create new exercise
async function createExercise(form, submitBtn, originalText) {
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    submitBtn.disabled = true;
    
    const formData = {
        name: document.getElementById("exerciseName").value,
        url: document.getElementById("exerciseUrl").value,
        description: document.getElementById("exerciseDescription").value
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${EXERCISES_ENDPOINT}`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to create exercise: ${response.status}`);
        }

        const newExercise = await response.json();
        
        await initializeExercises();
        form.reset();
        showNotification(`Exercise "${newExercise.name}" created successfully!`, 'success');
        
    } catch (error) {
        console.error('Error creating exercise:', error);
        showNotification(`Error creating exercise: ${error.message}`, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Delete exercise function
async function deleteExercise(exerciseId) {
    try {
        const exercise = await fetchExerciseById(exerciseId);
        
        if (confirm(`Are you sure you want to delete "${exercise.name}"?`)) {
            const response = await fetch(`${API_BASE_URL}${EXERCISES_ENDPOINT}/${exerciseId}`, {
                method: 'DELETE',
                headers: {
                    "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete exercise: ${response.status}`);
            }

            await initializeExercises();
            showNotification(`Exercise "${exercise.name}" deleted successfully!`, 'success');
        }
    } catch (error) {
        console.error('Error deleting exercise:', error);
        showNotification(`Error deleting exercise: ${error.message}`, 'error');
    }
}

// Edit exercise function
async function editExercise(exerciseId) {
    try {
        showNotification('Loading exercise data...', 'info');
        
        const exercise = await fetchExerciseById(exerciseId);

        const name = document.getElementById("exerciseName");
        const url = document.getElementById("exerciseUrl");
        const description = document.getElementById("exerciseDescription");
        
        if (name) name.value = exercise.name;
        if (url) url.value = exercise.url;
        if (description) description.value = exercise.description;
        
        const form = document.getElementById("addExerciseForm");
        const submitBtn = form?.querySelector('button[type="submit"]');
        
        if (form && submitBtn) {
            form.dataset.editingExerciseId = exerciseId;
            submitBtn.innerHTML = '<span>Update Exercise</span><i class="fas fa-save"></i>';
            form.scrollIntoView({ behavior: 'smooth' });
        }
        
        showNotification(`Editing exercise: "${exercise.name}". Form has been pre-filled.`, 'success');
        
    } catch (error) {
        console.error('Error loading exercise for edit:', error);
        showNotification(`Error loading exercise: ${error.message}`, 'error');
    }
}

// Function to update exercise
async function updateExercise(exerciseId, form, submitBtn) {
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    submitBtn.disabled = true;
    
    const formData = {
        name: document.getElementById("exerciseName")?.value || '',
        url: document.getElementById("exerciseUrl")?.value || '',
        description: document.getElementById("exerciseDescription")?.value || ''
    };
    
    try {
        let response = await fetch(`${API_BASE_URL}${EXERCISES_ENDPOINT}/${exerciseId}`, {
            method: 'PUT',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });

        if (response.status === 405) {
            response = await fetch(`${API_BASE_URL}${EXERCISES_ENDPOINT}/${exerciseId}`, {
                method: 'PATCH',
                headers: {
                    "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update exercise: ${response.status} - ${errorText}`);
        }

        const updatedExercise = await response.json();
        
        resetAddExerciseForm();
        await initializeExercises();
        showNotification(`Exercise "${updatedExercise.name}" updated successfully!`, 'success');
        
    } catch (error) {
        console.error('Error updating exercise:', error);
        showNotification(`Error updating exercise: ${error.message}`, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Helper function to reset form to add mode
function resetAddExerciseForm() {
    const form = document.getElementById("addExerciseForm");
    const submitBtn = form?.querySelector('button[type="submit"]');
    
    if (form) {
        form.reset();
        delete form.dataset.editingExerciseId;
    }
    
    if (submitBtn) {
        submitBtn.innerHTML = '<span>Add Exercise</span><i class="fas fa-plus"></i>';
    }
}

// Preview exercise function - FIXED VERSION
function previewExercise(exerciseId) {
    const exercise = currentExercises.find(ex => ex.id === exerciseId);
    if (!exercise) {
        showNotification('Exercise not found', 'error');
        return;
    }

    if (!isValidVideoUrl(exercise.url)) {
        showNotification('This exercise does not have a valid video URL for preview', 'error');
        return;
    }

    const modalHtml = `
        <div class="modal-overlay">
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3>${exercise.name} - Video Preview</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="video-preview-info" style="margin-bottom: 15px; padding: 10px; background: rgba(139, 0, 0, 0.1); border-radius: 6px; border-left: 3px solid #8b0000;">
                        <p style="margin: 0; color: #cccccc; font-size: 0.9rem;">
                            <i class="fas fa-info-circle"></i> If video doesn't play, use the "View Original" link below.
                        </p>
                    </div>
                    <div class="video-container">
                        ${getVideoEmbed(exercise.url)}
                    </div>
                    <div style="margin-top: 20px;">
                        <h4 style="color: #cccccc; margin-bottom: 10px;">Description</h4>
                        <p style="color: #ffffff; line-height: 1.5;">${exercise.description}</p>
                    </div>
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <a href="${exercise.url}" target="_blank" class="exercise-action-btn btn-preview" style="text-decoration: none;">
                            <i class="fas fa-external-link-alt"></i> View Original Video
                        </a>
                        <button class="exercise-action-btn btn-edit-exercise" onclick="closeModal()">
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

// Improved video embed function
function getVideoEmbed(url) {
    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = extractYouTubeId(url);
            if (videoId) {
                return `<iframe 
                    src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>`;
            }
        } else if (url.includes('vimeo.com')) {
            const videoId = url.split('/').pop().split('?')[0];
            if (videoId) {
                return `<iframe 
                    src="https://player.vimeo.com/video/${videoId}" 
                    frameborder="0" 
                    allow="autoplay; fullscreen; picture-in-picture" 
                    allowfullscreen>
                </iframe>`;
            }
        }
    } catch (error) {
        console.error('Error creating video embed:', error);
    }
    
    // Fallback for invalid URLs
    return `
        <div style="text-align: center; padding: 40px; background: rgba(255, 68, 68, 0.1); border-radius: 8px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff4444; margin-bottom: 15px;"></i>
            <h4 style="color: #ff4444; margin-bottom: 10px;">Video Preview Not Available</h4>
            <p style="color: #cccccc;">This video URL cannot be embedded for preview.</p>
            <a href="${url}" target="_blank" class="exercise-action-btn btn-preview" style="text-decoration: none; margin-top: 15px; display: inline-block;">
                <i class="fas fa-external-link-alt"></i> View Original URL
            </a>
        </div>
    `;
}

// Improved YouTube ID extraction
function extractYouTubeId(url) {
    try {
        // Handle various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/,
            /youtube\.com\/embed\/([^?]+)/,
            /youtube\.com\/v\/([^?]+)/,
            /youtube\.com\/watch\?.*v=([^&]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1].split('?')[0].split('&')[0];
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting YouTube ID:', error);
        return null;
    }
}

// Close modal function
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Search functionality
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filteredExercises = currentExercises.filter(exercise => 
        exercise.name.toLowerCase().includes(searchTerm) ||
        exercise.description.toLowerCase().includes(searchTerm) ||
        exercise.url.toLowerCase().includes(searchTerm)
    );
    loadExercises(filteredExercises);
}

// Refresh exercises function
async function refreshExercises() {
    await initializeExercises();
    showNotification('Exercises refreshed successfully!', 'success');
}

// Export exercises function
async function exportExercises() {
    try {
        const exercises = await fetchAllExercises();
        const csvContent = "data:text/csv;charset=utf-8," 
            + "ID,Name,URL,Description\n"
            + exercises.map(exercise => 
                `"${exercise.id}","${exercise.name}","${exercise.url}","${exercise.description}"`
            ).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "elitefit_exercises.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Exercises exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting exercises:', error);
        showNotification('Error exporting exercises', 'error');
    }
}

// Settings function
function openSettings() {
    showNotification('Settings panel would open here', 'info');
}

// Notification function
function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}