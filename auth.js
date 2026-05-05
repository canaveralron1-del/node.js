// API Base URL
const API_URL = '';

// Tab switching
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        if (currentUser.role === 'resident') {
            window.location.href = 'index.html';
        } else if (currentUser.role === 'responder') {
            window.location.href = 'responder.html';
        }
    }
    
    // Tab switching for Login/Register
    const tabs = document.querySelectorAll('.form-tab');
    const panels = document.querySelectorAll('.form-panel');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            panels.forEach(p => p.classList.remove('active'));
            document.getElementById(tabName + 'Panel').classList.add('active');
        });
    });
    
    // Role switching within forms
    const roleOptions = document.querySelectorAll('.role-option');
    roleOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.dataset.role;
            const parent = btn.closest('.form-panel');
            
            parent.querySelectorAll('.role-option').forEach(r => r.classList.remove('active'));
            btn.classList.add('active');
            
            parent.querySelectorAll('.role-form').forEach(f => f.classList.remove('active'));
            
            if (role === 'resident-login') {
                parent.querySelector('#residentLoginForm')?.classList.add('active');
            } else if (role === 'responder-login') {
                parent.querySelector('#responderLoginForm')?.classList.add('active');
            } else if (role === 'resident-register') {
                parent.querySelector('#residentRegisterForm')?.classList.add('active');
            } else if (role === 'responder-register') {
                parent.querySelector('#responderRegisterForm')?.classList.add('active');
            }
        });
    });
    
    // ============ RESIDENT LOGIN (SERVER-BASED) ============
    const residentLoginForm = document.getElementById('residentLoginForm');
    if (residentLoginForm) {
        residentLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginResidentEmail').value;
            const password = document.getElementById('loginResidentPassword').value;
            
            try {
                const response = await fetch(`${API_URL}/api/login/resident`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                if (response.ok) {
                    const user = await response.json();
                    sessionStorage.setItem('currentUser', JSON.stringify(user));
                    window.location.href = 'index.html';
                } else {
                    alert('Invalid credentials. Use: resident@demo.com / 123456');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Error connecting to server. Make sure server is running.');
            }
        });
    }
    
    // ============ RESPONDER LOGIN (SERVER-BASED) ============
    const responderLoginForm = document.getElementById('responderLoginForm');
    if (responderLoginForm) {
        responderLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const empId = document.getElementById('loginResponderId').value;
            const password = document.getElementById('loginResponderPassword').value;
            
            try {
                const response = await fetch('/api/login/responder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ empId, password })
                });
                
                if (response.ok) {
                    const user = await response.json();
                    sessionStorage.setItem('currentUser', JSON.stringify(user));
                    window.location.href = 'responder.html';
                } else {
                    alert('Invalid credentials. Use: RES-001 / 123456');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Error connecting to server. Make sure server is running.');
            }
        });
    }
    
    // ============ RESIDENT REGISTRATION (SERVER-BASED) ============
    const residentRegisterForm = document.getElementById('residentRegisterForm');
    if (residentRegisterForm) {
        residentRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regResidentName').value;
            const email = document.getElementById('regResidentEmail').value;
            const password = document.getElementById('regResidentPassword').value;
            const phone = document.getElementById('regResidentPhone').value;
            
            try {
                const response = await fetch(`${API_URL}/api/register/resident`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, phone })
                });
                
                if (response.ok) {
                    alert('✅ Registration successful! Please login.');
                    // Switch to login tab
                    document.querySelector('[data-tab="login"]').click();
                    residentRegisterForm.reset();
                } else {
                    const error = await response.json();
                    alert(error.error || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                alert('Error connecting to server. Make sure server is running.');
            }
        });
    }
    
    // ============ RESPONDER REGISTRATION ============
    const responderRegisterForm = document.getElementById('responderRegisterForm');
    if (responderRegisterForm) {
        responderRegisterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('📝 Responder registration submitted. Admin will review and approve.');
            responderRegisterForm.reset();
        });
    }
});

// Logout function
function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}