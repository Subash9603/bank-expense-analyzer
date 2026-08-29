// auth.js - Session & Authentication Management for separated deployment

// In development, resolve API calls to the same host on port 5000 (supports localhost, local IPs like 10.x.x.x / 192.168.x.x for mobile testing)
// In production (no port), point to the public backend domain
const API_BASE_URL = window.location.port 
    ? `${window.location.protocol}//${window.location.hostname}:5000` 
    : 'https://ai-bank-analyzer-backend.onrender.com';

// Global helper to make fetch requests with cookies/credentials
async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    
    // Ensure credentials is set to 'include' for secure session cookies cross-domain
    options.credentials = 'include';
    options.headers = options.headers || {};
    
    // Default to JSON if body is provided and not FormData
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
        options.headers['Content-Type'] = 'application/json';
    }
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            // Handle HTTP errors
            if (response.status === 401 && !url.includes('/api/auth/me')) {
                // Session expired or unauthenticated
                window.location.href = 'login.html';
                return null;
            }
        }
        return response;
    } catch (error) {
        console.error("API Connection Error:", error);
        throw new Error("Unable to connect to server. Please check your internet connection.");
    }
}

// Check session status on page load (for protected pages like index.html)
async function checkAuthSession() {
    try {
        const response = await apiFetch('/api/auth/me');
        if (!response) return null;
        
        const data = await response.json();
        if (data.status === 'ok' && data.authenticated) {
            return data.user;
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
            return null;
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        // Show user-friendly connection error instead of blank screen
        const container = document.querySelector('.app-container');
        if (container) {
            container.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center min-vh-100 p-4 text-center">
                    <i class="fa-solid fa-cloud-slash text-danger fs-1 mb-3"></i>
                    <h4 class="fw-bold">Unable to connect to server</h4>
                    <p class="text-secondary small">Please ensure the backend server is running and accessible.</p>
                    <button class="btn btn-primary rounded-pill gradient-btn px-4 py-2 mt-2" onclick="window.location.reload()">
                        <i class="fa-solid fa-rotate-right me-1"></i> Retry
                    </button>
                </div>
            `;
        }
        return null;
    }
}

// Handle login page registration check
async function checkAnonymousSession() {
    try {
        const response = await apiFetch('/api/auth/me');
        if (!response) return;
        const data = await response.json();
        if (data.status === 'ok' && data.authenticated) {
            // If already logged in, redirect to dashboard
            window.location.href = 'index.html';
        }
    } catch (err) {
        console.log("Offline or server unreachable, letting user view auth screens");
    }
}
