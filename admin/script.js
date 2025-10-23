// API configuration
const API_BASE_URL = 'https://gym-app-lime-nine.vercel.app'; // Change to your API URL
const USERS_ENDPOINT = '/users';
const token = localStorage.getItem("access_token");
// Global variable to store current users
let currentUsers = [];

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize the application
function initializeApp() {
    initializeUsers();
    setupEventListeners();
    addGlobalStyles();
}

// Setup all event listeners
function setupEventListeners() {
    const addUserForm = document.getElementById("addUserForm");
    const searchInput = document.getElementById("searchInput");
    
    if (addUserForm) {
        addUserForm.addEventListener("submit", handleFormSubmit);
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

// Add global styles for modals and notifications
function addGlobalStyles() {
    if (!document.querySelector('#global-styles')) {
        const globalStyles = document.createElement('style');
        globalStyles.id = 'global-styles';
        globalStyles.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                backdrop-filter: blur(5px);
            }
            .modal-content {
                background: rgba(15, 15, 15, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 30px;
                width: 90%;
                max-width: 500px;
                backdrop-filter: blur(10px);
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 15px;
            }
            .modal-header h3 {
                background: linear-gradient(135deg, #ffffff 0%, #cccccc 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin: 0;
            }
            .modal-close {
                background: none;
                border: none;
                color: #ffffff;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .user-detail {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            .user-detail label {
                color: #cccccc;
                font-weight: 500;
            }
            .user-detail span {
                color: #ffffff;
            }
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                display: flex;
                align-items: center;
                gap: 15px;
                z-index: 1001;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                animation: slideIn 0.3s ease;
                max-width: 400px;
            }
            .notification-success {
                background: rgba(0, 150, 0, 0.9);
            }
            .notification-error {
                background: rgba(200, 0, 0, 0.9);
            }
            .notification-info {
                background: rgba(0, 100, 200, 0.9);
            }
            .notification button {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: #666666;
                grid-column: 1 / -1;
            }
            .empty-state i {
                font-size: 3rem;
                margin-bottom: 20px;
                color: #8b0000;
            }
            .empty-state h3 {
                font-size: 1.5rem;
                margin-bottom: 10px;
                color: #cccccc;
            }
        `;
        document.head.appendChild(globalStyles);
    }
}

// Function to fetch a specific user by ID
async function fetchUserById(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}${USERS_ENDPOINT}/${userId}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const user = await response.json();
        return user;
    } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
    }
}

// Function to fetch all users from API
async function fetchAllUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}${USERS_ENDPOINT}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const users = await response.json();
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

// Function to create user card
function createUserCard(user) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
        <div class="user-header">
            <div class="user-avatar">
                ${user.first_name[0]}${user.last_name[0]}
            </div>
            <div class="user-info">
                <h3>${user.first_name} ${user.last_name}</h3>
                <p class="user-email">${user.email}</p>
            </div>
        </div>
        <div class="user-details">
            <div class="detail-item">
                <span class="detail-label">Role</span>
                <span class="detail-value role-${user.role}">
                    ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Phone</span>
                <span class="detail-value">${user.phone_number}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">User ID</span>
                <span class="detail-value">#${user.id}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Created</span>
                <span class="detail-value">${formatDate(user.created_at)}</span>
            </div>
        </div>
        <div class="user-actions">
            <button class="action-btn btn-view" onclick="viewUser(${user.id})">
                <i class="fas fa-eye"></i> View Workouts
            </button>
            <button class="action-btn btn-edit" onclick="editUser(${user.id})">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="action-btn btn-delete" onclick="deleteUser(${user.id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    return card;
}

// Helper function to format date
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    } catch (error) {
        return dateString;
    }
}

// Function to load users into the grid
function loadUsers(users) {
    const usersGrid = document.getElementById('usersGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!usersGrid) {
        console.error('Users grid element not found');
        return;
    }
    
    // Clear existing content
    usersGrid.innerHTML = '';
    
    if (users.length === 0) {
        if (emptyState) {
            usersGrid.appendChild(emptyState);
            emptyState.style.display = 'block';
        } else {
            // Create empty state if it doesn't exist
            const fallbackEmptyState = document.createElement('div');
            fallbackEmptyState.className = 'empty-state';
            fallbackEmptyState.innerHTML = `
                <i class="fas fa-users"></i>
                <h3>No Users Found</h3>
                <p>No users match your search criteria</p>
            `;
            usersGrid.appendChild(fallbackEmptyState);
        }
    } else {
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        users.forEach(user => {
            const userCard = createUserCard(user);
            usersGrid.appendChild(userCard);
        });
    }
    
    updateStatistics(users);
}

// Function to update statistics
function updateStatistics(users) {
    const totalUsersEl = document.getElementById('total-users');
    const adminUsersEl = document.getElementById('admin-users');
    const nonadminUsersEl = document.getElementById('nonadmin-users');
    const newUsersEl = document.getElementById('new-users');
    
    if (totalUsersEl) totalUsersEl.textContent = users.length;
    if (adminUsersEl) adminUsersEl.textContent = users.filter(u => u.role === 'admin').length;
    if (nonadminUsersEl) nonadminUsersEl.textContent = users.filter(u => u.role === 'nonadmin').length;
    
    if (newUsersEl) {
        const newUsersCount = users.filter(u => {
            try {
                const createdDate = new Date(u.created_at);
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
            } catch (error) {
                return false;
            }
        }).length;
        newUsersEl.textContent = newUsersCount;
    }
}

// Function to initialize and load users
async function initializeUsers() {
    try {
        // Show loading state
        const usersGrid = document.getElementById('usersGrid');
        if (usersGrid) {
            usersGrid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h3>Loading users...</h3></div>';
        }
        
        const users = await fetchAllUsers();
        currentUsers = users; // Store users globally
        loadUsers(users);
    } catch (error) {
        console.error('Error initializing users:', error);
        const usersGrid = document.getElementById('usersGrid');
        if (usersGrid) {
            usersGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Users</h3>
                    <p>${error.message}</p>
                    <button onclick="initializeUsers()" class="login-btn" style="margin-top: 20px; max-width: 200px; margin-left: auto; margin-right: auto;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
        showNotification(`Error loading users: ${error.message}`, 'error');
    }
}

// Form submit handler
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const editingUserId = form.dataset.editingUserId;
    
    if (editingUserId) {
        // Update existing user
        await updateUser(parseInt(editingUserId), form, submitBtn);
    } else {
        // Create new user
        await createUser(form, submitBtn, originalText);
    }
}

// Create new user
async function createUser(form, submitBtn, originalText) {
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    submitBtn.disabled = true;
    
    // Get form values
    const formData = {
        first_name: document.getElementById("firstName").value,
        last_name: document.getElementById("lastName").value,
        email: document.getElementById("email").value,
        phone_number: document.getElementById("phoneNumber").value,
        password: document.getElementById("password").value,
        role: document.getElementById("role").value
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${USERS_ENDPOINT}`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to create user: ${response.status}`);
        }

        const newUser = await response.json();
        
        // Refresh the users list
        await initializeUsers();
        
        // Reset form
        form.reset();
        
        // Show success message
        showNotification(`User ${newUser.first_name} ${newUser.last_name} created successfully!`, 'success');
        
    } catch (error) {
        console.error('Error creating user:', error);
        showNotification(`Error creating user: ${error.message}`, 'error');
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Delete user function
async function deleteUser(userId) {
    try {
        // Fetch the specific user first to get their name for confirmation
        const user = await fetchUserById(userId);
        
        if (confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}?`)) {
            const response = await fetch(`${API_BASE_URL}${USERS_ENDPOINT}/${userId}`, {
                method: 'DELETE',
                headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete user: ${response.status}`);
            }

            // Refresh the users list
            await initializeUsers();
            showNotification(`User ${user.first_name} ${user.last_name} deleted successfully!`, 'success');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification(`Error deleting user: ${error.message}`, 'error');
    }
}

// Edit user function - FIXED VERSION
async function editUser(userId) {
    try {
        // Show loading notification
        showNotification('Loading user data...', 'info');
        
        // Fetch the specific user from API instead of relying on currentUsers
        const user = await fetchUserById(userId);

        // Pre-fill the form
        const firstName = document.getElementById("firstName");
        const lastName = document.getElementById("lastName");
        const email = document.getElementById("email");
        const phoneNumber = document.getElementById("phoneNumber");
        const role = document.getElementById("role");
        const password = document.getElementById("password");
        
        if (firstName) firstName.value = user.first_name;
        if (lastName) lastName.value = user.last_name;
        if (email) email.value = user.email;
        if (phoneNumber) phoneNumber.value = user.phone_number;
        if (role) role.value = user.role;
        if (password) password.value = "";
        
        // Change form to update mode
        const form = document.getElementById("addUserForm");
        const submitBtn = form?.querySelector('button[type="submit"]');
        
        if (form && submitBtn) {
            // Store the user ID for update
            form.dataset.editingUserId = userId;
            submitBtn.innerHTML = '<span>Update User</span><i class="fas fa-save"></i>';
            
            // Scroll to form
            form.scrollIntoView({ behavior: 'smooth' });
        }
        
        showNotification(`Editing user: ${user.first_name} ${user.last_name}. Form has been pre-filled.`, 'success');
        
    } catch (error) {
        console.error('Error loading user for edit:', error);
        showNotification(`Error loading user: ${error.message}`, 'error');
    }
}

// Function to update user
async function updateUser(userId, form, submitBtn) {
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    submitBtn.disabled = true;
    
    // Get form data - FIXED: Use proper field names that match your Pydantic model
    const formData = {
        first_name: document.getElementById("firstName")?.value || '',
        last_name: document.getElementById("lastName")?.value || '',
        email: document.getElementById("email")?.value || '',
        phone_number: document.getElementById("phoneNumber")?.value || '',
        role: document.getElementById("role")?.value || ''
    };
    
    // Only include password if it's not empty
    const password = document.getElementById("password")?.value;
    if (password && password.trim() !== '') {
        formData.password = password;
    }
    
    try {
        console.log('Updating user with data:', formData); // Debug log
        
        const response = await fetch(`${API_BASE_URL}${USERS_ENDPOINT}/${userId}`, {
            method: 'PUT',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Update failed:', errorText);
            throw new Error(`Failed to update user: ${response.status} - ${errorText}`);
        }

        const updatedUser = await response.json();
        
        // Reset form to add mode
        resetAddUserForm();
        
        // Refresh users list
        await initializeUsers();
        
        showNotification(`User ${updatedUser.first_name} ${updatedUser.last_name} updated successfully!`, 'success');
        
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification(`Error updating user: ${error.message}`, 'error');
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Helper function to reset form to add mode
function resetAddUserForm() {
    const form = document.getElementById("addUserForm");
    const submitBtn = form?.querySelector('button[type="submit"]');
    
    if (form) {
        form.reset();
        delete form.dataset.editingUserId;
    }
    
    if (submitBtn) {
        submitBtn.innerHTML = '<span>Add User</span><i class="fas fa-plus"></i>';
    }
}

// View user function - UPDATED to redirect to admin workouts page
function viewUser(userId) {
    // Redirect to admin user workouts page with the user ID as parameter
    window.location.href = `/admin_user_exercise/admin_user_exercise.html?user_id=${userId}`;
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
    const filteredUsers = currentUsers.filter(user => 
        user.first_name.toLowerCase().includes(searchTerm) ||
        user.last_name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.phone_number && user.phone_number.toLowerCase().includes(searchTerm))
    );
    loadUsers(filteredUsers);
}

// Refresh users function
async function refreshUsers() {
    await initializeUsers();
    showNotification('Users refreshed successfully!', 'success');
}

// Export users function
async function exportUsers() {
    try {
        const users = await fetchAllUsers();
        const csvContent = "data:text/csv;charset=utf-8," 
            + "ID,First Name,Last Name,Email,Phone,Role,Created Date\n"
            + users.map(user => 
                `"${user.id}","${user.first_name}","${user.last_name}","${user.email}","${user.phone_number}","${user.role}","${user.created_at}"`
            ).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "elitefit_users.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Users exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting users:', error);
        showNotification('Error exporting users', 'error');
    }
}

// Settings function
function openSettings() {
    showNotification('Settings panel would open here', 'info');
}

// Notification function
function showNotification(message, type = 'info') {
    // Remove existing notification
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
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}