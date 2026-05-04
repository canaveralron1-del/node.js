// Socket.IO connection
const socket = io();

// Global variables
let currentUser = null;
let currentReportId = null;
let allReports = [];
let currentFilter = 'all';
let currentView = 'all';
let activeSocketRoom = null;
let savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');

// DOM Elements
let menuBtn, sidebar, overlay, newReportBtn, logoutBtn, fabNewReport;
let reportFormContainer, closeFormBtn, reportForm;
let reportsFeed, feedFilters, modal, modalClose;
let getLocationBtn, photoInput, photoPreview;
let myProfileBtn, settingsBtn, savedBtn;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'resident') {
        window.location.href = 'login.html';
        return;
    }
    
    initializeElements();
    setupEventListeners();
    updateUserInfo();
    await loadReports();
    setupSocket();
    updateSavedCount();
});

function initializeElements() {
    menuBtn = document.getElementById('menuBtn');
    sidebar = document.getElementById('sidebar');
    overlay = document.getElementById('sidebarOverlay');
    newReportBtn = document.getElementById('newReportBtn');
    logoutBtn = document.getElementById('logoutBtnSidebar');
    fabNewReport = document.getElementById('fabNewReport');
    reportFormContainer = document.getElementById('reportFormContainer');
    closeFormBtn = document.getElementById('closeFormBtn');
    reportForm = document.getElementById('reportForm');
    reportsFeed = document.getElementById('reportsFeed');
    feedFilters = document.querySelectorAll('.feed-filter-btn');
    modal = document.getElementById('reportModal');
    modalClose = document.querySelector('.modal-close');
    getLocationBtn = document.getElementById('getLocationBtn');
    photoInput = document.getElementById('photo');
    photoPreview = document.getElementById('photoPreview');
    myProfileBtn = document.getElementById('myProfileBtn');
    settingsBtn = document.getElementById('settingsBtn');
    savedBtn = document.getElementById('savedBtn');
    
    const myReportsBtn = document.getElementById('myReportsBtn');
    const allReportsBtn = document.getElementById('allReportsBtn');
    
    if (myReportsBtn) {
        myReportsBtn.addEventListener('click', () => {
            currentView = 'my';
            updateActiveNavItem('myReportsBtn');
            loadReports();
            toggleSidebar();
        });
    }
    
    if (allReportsBtn) {
        allReportsBtn.addEventListener('click', () => {
            currentView = 'all';
            updateActiveNavItem('allReportsBtn');
            loadReports();
            toggleSidebar();
        });
    }
    
    if (myProfileBtn) {
        myProfileBtn.addEventListener('click', () => {
            toggleSidebar();
            showProfile();
        });
    }
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            toggleSidebar();
            showSettings();
        });
    }
    
    if (savedBtn) {
        savedBtn.addEventListener('click', () => {
            toggleSidebar();
            showSavedReports();
        });
    }
}

function updateActiveNavItem(activeId) {
    const navItems = ['myReportsBtn', 'allReportsBtn', 'newReportBtn', 'myProfileBtn', 'settingsBtn', 'savedBtn'];
    navItems.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id === activeId) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        }
    });
}

function updateUserInfo() {
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserRole = document.getElementById('sidebarUserRole');
    
    if (sidebarUserName) {
        sidebarUserName.textContent = currentUser.name || currentUser.email;
    }
    if (sidebarUserRole) {
        sidebarUserRole.textContent = 'Resident';
    }
}

function updateSavedCount() {
    const savedCount = document.getElementById('savedCount');
    if (savedCount) {
        savedCount.textContent = savedReports.length;
    }
}

function setupEventListeners() {
    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);
    
    if (newReportBtn) {
        newReportBtn.addEventListener('click', () => {
            toggleSidebar();
            showReportForm();
        });
    }
    if (fabNewReport) fabNewReport.addEventListener('click', showReportForm);
    if (closeFormBtn) closeFormBtn.addEventListener('click', hideReportForm);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    
    if (reportForm) reportForm.addEventListener('submit', submitReport);
    
    feedFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            feedFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderReports();
        });
    });
    
    if (modalClose) modalClose.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    if (getLocationBtn) getLocationBtn.addEventListener('click', getLocation);
    if (photoInput) photoInput.addEventListener('change', previewPhoto);
}

function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

function showReportForm() {
    reportFormContainer.classList.remove('hidden');
}

function hideReportForm() {
    reportFormContainer.classList.add('hidden');
    reportForm.reset();
    if (photoPreview) photoPreview.innerHTML = '';
}

function previewPhoto(e) {
    const file = e.target.files[0];
    if (file && photoPreview) {
        const reader = new FileReader();
        reader.onload = function(event) {
            photoPreview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

async function getLocation() {
    const locationInput = document.getElementById('location');
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                locationInput.value = data.display_name || `${latitude}, ${longitude}`;
            } catch (error) {
                locationInput.value = `${latitude}, ${longitude}`;
            }
        }, () => {
            alert('Unable to get location');
        });
    } else {
        alert('Geolocation not supported');
    }
}

async function submitReport(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const urgency = document.getElementById('urgency').value;
    const location = document.getElementById('location').value;
    const photo = document.getElementById('photo').files[0];
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('urgency', urgency);
    formData.append('location', location);
    formData.append('residentId', currentUser.id);
    formData.append('residentName', currentUser.name);
    if (photo) formData.append('photo', photo);
    
    try {
        const response = await fetch('/api/reports', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('✅ Report submitted successfully!');
            hideReportForm();
            await loadReports();
        } else {
            const error = await response.json();
            alert('❌ Failed to submit report: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error submitting report. Make sure server is running.');
    }
}

async function loadReports() {
    try {
        let url = '/api/reports';
        if (currentView === 'my') {
            url = `/api/reports/resident/${currentUser.id}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            allReports = await response.json();
            renderReports();
        } else {
            throw new Error('Failed to load reports');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        if (reportsFeed) {
            reportsFeed.innerHTML = '<div class="loading-spinner">❌ Failed to load reports. Make sure server is running.</div>';
        }
    }
}

function renderReports() {
    if (!reportsFeed) return;
    
    let filteredReports = allReports;
    if (currentFilter !== 'all') {
        filteredReports = allReports.filter(r => r.status === currentFilter);
    }
    
    if (filteredReports.length === 0) {
        reportsFeed.innerHTML = '<div class="loading-spinner"><i class="fas fa-inbox"></i> No reports found</div>';
        return;
    }
    
    reportsFeed.innerHTML = filteredReports.map(report => createFeedCard(report)).join('');
    
    document.querySelectorAll('.feed-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.save-btn') && !e.target.closest('.card-image')) {
                const reportId = parseInt(card.dataset.id);
                openReportModal(reportId);
            }
        });
    });
    
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const reportId = parseInt(btn.dataset.id);
            toggleSaveReport(reportId);
        });
    });
}

function createFeedCard(report) {
    const urgencyClass = `urgency-${report.urgency}`;
    const urgencyText = { low: '🟢 Low', medium: '🟡 Medium', high: '🟠 High', emergency: '🔴 Emergency' }[report.urgency];
    const statusText = { pending: 'Pending', investigating: 'Investigating', resolved: 'Resolved' }[report.status];
    const statusClass = `status-${report.status}`;
    const timeAgo = getTimeAgo(new Date(report.createdAt));
    const isSaved = savedReports.includes(report.id);
    
    return `
        <div class="feed-card" data-id="${report.id}">
            <div class="card-header">
                <div class="card-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="card-user-info">
                    <div class="card-user-name">${escapeHtml(report.residentName || 'Resident')}</div>
                    <div class="card-time">
                        <span>${timeAgo}</span>
                        <span class="urgency-badge ${urgencyClass}">${urgencyText}</span>
                    </div>
                </div>
                <button class="save-btn ${isSaved ? 'saved' : ''}" data-id="${report.id}">
                    <i class="fas ${isSaved ? 'fa-bookmark' : 'fa-bookmark'}"></i>
                </button>
            </div>
            <div class="card-title">${escapeHtml(report.title)}</div>
            <div class="card-description">${escapeHtml(report.description.substring(0, 150))}${report.description.length > 150 ? '...' : ''}</div>
            ${report.photo ? `<div class="card-image"><img src="${report.photo}" alt="Report photo" loading="lazy"></div>` : ''}
            <div class="card-location">
                <i class="fas fa-location-dot"></i> ${escapeHtml(report.location || 'Location not specified')}
            </div>
            <div class="card-stats">
                <span><i class="fas fa-comment"></i> Chat</span>
                <span><i class="fas fa-tag"></i> <span class="status-badge ${statusClass}">${statusText}</span></span>
            </div>
        </div>
    `;
}

function toggleSaveReport(reportId) {
    const index = savedReports.indexOf(reportId);
    if (index === -1) {
        savedReports.push(reportId);
        alert('✅ Report saved!');
    } else {
        savedReports.splice(index, 1);
        alert('📌 Report removed from saved');
    }
    localStorage.setItem('savedReports', JSON.stringify(savedReports));
    updateSavedCount();
    renderReports();
}

function showSavedReports() {
    const savedReportsList = allReports.filter(r => savedReports.includes(r.id));
    
    if (savedReportsList.length === 0) {
        reportsFeed.innerHTML = `
            <div class="saved-empty">
                <i class="fas fa-bookmark" style="font-size: 48px; color: #ccc;"></i>
                <p>No saved reports yet</p>
                <p style="font-size: 12px;">Click the bookmark icon on any report to save it</p>
            </div>
        `;
    } else {
        reportsFeed.innerHTML = savedReportsList.map(report => createFeedCard(report)).join('');
        // Re-attach event listeners
        document.querySelectorAll('.feed-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.save-btn')) {
                    const reportId = parseInt(card.dataset.id);
                    openReportModal(reportId);
                }
            });
        });
        document.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const reportId = parseInt(btn.dataset.id);
                toggleSaveReport(reportId);
            });
        });
    }
    
    currentView = 'saved';
    updateActiveNavItem('savedBtn');
}

function showProfile() {
    const profileModal = document.getElementById('profileModal');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileJoinDate = document.getElementById('profileJoinDate');
    const profileReportCount = document.getElementById('profileReportCount');
    
    if (profileName) profileName.value = currentUser.name || '';
    if (profileEmail) profileEmail.value = currentUser.email || '';
    if (profileJoinDate) profileJoinDate.value = new Date().toLocaleDateString();
    if (profileReportCount) profileReportCount.value = allReports.filter(r => r.residentId === currentUser.id).length;
    
    profileModal.style.display = 'block';
    
    const closeBtn = document.querySelector('.profile-modal-close');
    if (closeBtn) {
        closeBtn.onclick = () => profileModal.style.display = 'none';
    }
    window.onclick = (e) => {
        if (e.target === profileModal) profileModal.style.display = 'none';
    };
}

function showSettings() {
    const settingsModal = document.getElementById('settingsModal');
    
    // Load saved settings
    const notifyMessages = localStorage.getItem('notifyMessages') === 'true';
    const notifyStatus = localStorage.getItem('notifyStatus') === 'true';
    const showEmail = localStorage.getItem('showEmail') === 'true';
    const theme = localStorage.getItem('theme') || 'light';
    
    const notifyMessagesCheck = document.getElementById('notifyMessages');
    const notifyStatusCheck = document.getElementById('notifyStatus');
    const showEmailCheck = document.getElementById('showEmail');
    const themeSelect = document.getElementById('themeSelect');
    
    if (notifyMessagesCheck) notifyMessagesCheck.checked = notifyMessages;
    if (notifyStatusCheck) notifyStatusCheck.checked = notifyStatus;
    if (showEmailCheck) showEmailCheck.checked = showEmail;
    if (themeSelect) themeSelect.value = theme;
    
    // Apply theme
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    settingsModal.style.display = 'block';
    
    // Save settings when changed
    if (notifyMessagesCheck) {
        notifyMessagesCheck.onchange = () => localStorage.setItem('notifyMessages', notifyMessagesCheck.checked);
    }
    if (notifyStatusCheck) {
        notifyStatusCheck.onchange = () => localStorage.setItem('notifyStatus', notifyStatusCheck.checked);
    }
    if (showEmailCheck) {
        showEmailCheck.onchange = () => localStorage.setItem('showEmail', showEmailCheck.checked);
    }
    if (themeSelect) {
        themeSelect.onchange = () => {
            const newTheme = themeSelect.value;
            localStorage.setItem('theme', newTheme);
            if (newTheme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        };
    }
    
    const closeBtn = document.querySelector('.settings-modal-close');
    if (closeBtn) {
        closeBtn.onclick = () => settingsModal.style.display = 'none';
    }
    window.onclick = (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    };
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

async function openReportModal(reportId) {
    currentReportId = reportId;
    
    try {
        const response = await fetch(`/api/reports/${reportId}`);
        if (!response.ok) throw new Error('Failed to load report');
        const report = await response.json();
        
        displayReportDetails(report);
        await loadChatMessages(reportId);
        
        if (activeSocketRoom) {
            socket.emit('leave-room', activeSocketRoom);
        }
        activeSocketRoom = `report_${reportId}`;
        socket.emit('join-room', activeSocketRoom);
        
        modal.style.display = 'block';
        
        const sendBtn = document.getElementById('modalSendBtn');
        const chatInput = document.getElementById('modalChatInput');
        
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        
        newSendBtn.addEventListener('click', () => {
            sendChatMessage(chatInput.value);
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage(chatInput.value);
        });
        
    } catch (error) {
        console.error('Error opening report:', error);
        alert('Failed to load report details. Make sure server is running.');
    }
}

function displayReportDetails(report) {
    const container = document.getElementById('modalReportDetails');
    const urgencyText = { low: '🟢 Low', medium: '🟡 Medium', high: '🟠 High', emergency: '🔴 Emergency' }[report.urgency];
    const statusText = { pending: 'Pending', investigating: 'Investigating', resolved: 'Resolved' }[report.status];
    const statusClass = `status-${report.status}`;
    
    container.innerHTML = `
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-heading"></i> Title</div>
            <div class="report-detail-value"><strong>${escapeHtml(report.title)}</strong></div>
        </div>
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-align-left"></i> Description</div>
            <div class="report-detail-value">${escapeHtml(report.description)}</div>
        </div>
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-exclamation-triangle"></i> Urgency</div>
            <div class="report-detail-value">${urgencyText}</div>
        </div>
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-tag"></i> Status</div>
            <div class="report-detail-value"><span class="status-badge ${statusClass}">${statusText}</span></div>
        </div>
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-location-dot"></i> Location</div>
            <div class="report-detail-value">${escapeHtml(report.location || 'Not specified')}</div>
        </div>
        ${report.photo ? `
            <div class="report-detail-item">
                <div class="report-detail-label"><i class="fas fa-image"></i> Photo</div>
                <div class="report-detail-image">
                    <img src="${report.photo}" alt="Report photo" style="max-width: 100%; border-radius: 10px;">
                </div>
            </div>
        ` : ''}
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-clock"></i> Submitted</div>
            <div class="report-detail-value">${new Date(report.createdAt).toLocaleString()}</div>
        </div>
    `;
}

async function loadChatMessages(reportId) {
    try {
        const response = await fetch(`/api/messages/${reportId}`);
        if (!response.ok) throw new Error('Failed to load messages');
        const messages = await response.json();
        displayChatMessages(messages);
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function displayChatMessages(messages) {
    const container = document.getElementById('modalChatMessages');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="system-message">No messages yet. Start the conversation!</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="chat-message ${msg.senderRole === 'responder' ? 'responder' : 'resident'}">
            <div class="message-bubble">
                <div class="message-sender">
                    ${escapeHtml(msg.senderName)}${msg.senderRole === 'responder' ? ' (Responder)' : ''}
                    <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div>${escapeHtml(msg.message)}</div>
            </div>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

function sendChatMessage(message) {
    if (!message.trim() || !currentReportId) return;
    
    const chatInput = document.getElementById('modalChatInput');
    
    socket.emit('send-message', {
        reportId: currentReportId,
        message: message.trim(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: 'resident'
    });
    
    chatInput.value = '';
}

function setupSocket() {
    socket.on('new-message', (data) => {
        if (data.reportId === currentReportId) {
            const container = document.getElementById('modalChatMessages');
            const messageHtml = `
                <div class="chat-message ${data.senderRole === 'responder' ? 'responder' : 'resident'}">
                    <div class="message-bubble">
                        <div class="message-sender">
                            ${escapeHtml(data.senderName)}${data.senderRole === 'responder' ? ' (Responder)' : ''}
                            <span class="message-time">${new Date(data.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div>${escapeHtml(data.message)}</div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', messageHtml);
            container.scrollTop = container.scrollHeight;
            
            // Play notification if enabled
            if (localStorage.getItem('notifyMessages') === 'true') {
                // Optional: play sound
                // new Audio('/notification.mp3').play();
            }
        }
    });
    
    socket.on('report-updated', (data) => {
        if (localStorage.getItem('notifyStatus') === 'true') {
            alert(`📢 Report #${data.reportId} status has been updated!`);
        }
        loadReports();
        if (modal.style.display === 'block' && data.reportId === currentReportId) {
            openReportModal(currentReportId);
        }
    });
}

function closeModal() {
    modal.style.display = 'none';
    if (activeSocketRoom) {
        socket.emit('leave-room', activeSocketRoom);
        activeSocketRoom = null;
    }
    currentReportId = null;
}

function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}