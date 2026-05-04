// Socket connection
const socket = io();

// Get current user
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

// Check authentication
if (!currentUser || currentUser.role !== 'responder') {
    window.location.href = 'login.html';
}

// Global variables
let currentReports = [];
let selectedReportId = null;
let currentView = 'unassigned'; // unassigned, assigned, all, resolved
let activeSocketRoom = null;
let responderRegistered = false;

// DOM Elements - New Sidebar Elements
let menuBtn, sidebar, overlay, logoutBtn, switchToResidentBtn;
let dashboardBtn, unassignedBtn, myAssignedBtn, resolvedBtn;
let myProfileBtn, settingsBtn;
let reportsQueue, filterTabs;
let chatModal, modalClose;
let modalChatMessages, modalChatInput, modalSendBtn;
let modalUpdateStatus, modalUpdateStatusBtn, modalAssignToMeBtn;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupEventListeners();
    loadReports();
    setupSocketListeners();
    updateSidebarCounts();
    updateUserInfo();
});

function initializeElements() {
    // Sidebar elements
    menuBtn = document.getElementById('menuBtn');
    sidebar = document.getElementById('sidebar');
    overlay = document.getElementById('sidebarOverlay');
    logoutBtn = document.getElementById('logoutBtnSidebar');
    switchToResidentBtn = document.getElementById('switchToResidentBtn');
    dashboardBtn = document.getElementById('dashboardBtn');
    unassignedBtn = document.getElementById('unassignedBtn');
    myAssignedBtn = document.getElementById('myAssignedBtn');
    resolvedBtn = document.getElementById('resolvedBtn');
    myProfileBtn = document.getElementById('myProfileBtn');
    settingsBtn = document.getElementById('settingsBtn');
    
    // Main content elements
    reportsQueue = document.getElementById('reportsQueue');
    filterTabs = document.querySelectorAll('.filter-tab');
    
    // Chat modal elements
    chatModal = document.getElementById('chatModal');
    modalClose = document.querySelector('.modal-close');
    modalChatMessages = document.getElementById('modalChatMessages');
    modalChatInput = document.getElementById('modalChatInput');
    modalSendBtn = document.getElementById('modalSendBtn');
    modalUpdateStatus = document.getElementById('modalUpdateStatus');
    modalUpdateStatusBtn = document.getElementById('modalUpdateStatusBtn');
    modalAssignToMeBtn = document.getElementById('modalAssignToMeBtn');
}

function updateUserInfo() {
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserDept = document.getElementById('sidebarUserDept');
    
    if (sidebarUserName) {
        sidebarUserName.textContent = currentUser.name || 'Responder';
    }
    if (sidebarUserDept) {
        sidebarUserDept.textContent = currentUser.department || 'Field Operations';
    }
}

function setupEventListeners() {
    // Sidebar toggle
    if (menuBtn) {
        menuBtn.addEventListener('click', toggleSidebar);
    }
    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }
    
    // Sidebar navigation
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            setActiveView('unassigned');
            updateSidebarActive('dashboardBtn');
            toggleSidebar();
        });
    }
    if (unassignedBtn) {
        unassignedBtn.addEventListener('click', () => {
            setActiveView('unassigned');
            updateSidebarActive('unassignedBtn');
            toggleSidebar();
        });
    }
    if (myAssignedBtn) {
        myAssignedBtn.addEventListener('click', () => {
            setActiveView('assigned');
            updateSidebarActive('myAssignedBtn');
            toggleSidebar();
        });
    }
    if (resolvedBtn) {
        resolvedBtn.addEventListener('click', () => {
            setActiveView('resolved');
            updateSidebarActive('resolvedBtn');
            toggleSidebar();
        });
    }
    
    // Profile and Settings
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
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
    }
    
    // Switch to resident view
    if (switchToResidentBtn) {
        switchToResidentBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Filter tabs
    if (filterTabs) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const view = tab.dataset.view;
                setActiveView(view);
            });
        });
    }
    
    // Modal close
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    window.addEventListener('click', (e) => {
        if (e.target === chatModal) closeModal();
    });
    
    // Chat send
    if (modalSendBtn) {
        modalSendBtn.addEventListener('click', sendChatMessage);
    }
    if (modalChatInput) {
        modalChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    // Update status
    if (modalUpdateStatusBtn) {
        modalUpdateStatusBtn.addEventListener('click', updateReportStatus);
    }
    
    // Assign to me
    if (modalAssignToMeBtn) {
        modalAssignToMeBtn.addEventListener('click', assignToMe);
    }
}

function toggleSidebar() {
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

function updateSidebarActive(activeId) {
    const navItems = ['dashboardBtn', 'unassignedBtn', 'myAssignedBtn', 'resolvedBtn', 'myProfileBtn', 'settingsBtn'];
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

function setActiveView(view) {
    currentView = view;
    filterAndRenderReports();
}

function updateSidebarCounts() {
    if (!currentReports.length) return;
    
    const unassignedCount = currentReports.filter(r => !r.assignedTo && r.status !== 'resolved').length;
    const assignedCount = currentReports.filter(r => r.assignedTo == currentUser.id && r.status !== 'resolved').length;
    
    const unassignedCountSpan = document.getElementById('unassignedCount');
    const myAssignedCountSpan = document.getElementById('myAssignedCount');
    const filterUnassignedCount = document.getElementById('filterUnassignedCount');
    const filterAssignedCount = document.getElementById('filterAssignedCount');
    
    if (unassignedCountSpan) unassignedCountSpan.textContent = unassignedCount;
    if (myAssignedCountSpan) myAssignedCountSpan.textContent = assignedCount;
    if (filterUnassignedCount) filterUnassignedCount.textContent = unassignedCount;
    if (filterAssignedCount) filterAssignedCount.textContent = assignedCount;
}

function setupSocketListeners() {
    if (!socket) return;
    
    socket.on('connect', () => {
        console.log('✅ Responder socket connected');
        registerResponder();
    });
    
    socket.on('newReport', (report) => {
        currentReports.unshift(report);
        filterAndRenderReports();
        updateStats();
        updateSidebarCounts();
        showNotification('📢 New report submitted!');
    });
    
    socket.on('report-updated', (data) => {
        loadReports(); // Reload all reports
        if (selectedReportId === data.reportId) {
            // Refresh modal if open
            openReportModal(selectedReportId);
        }
    });
    
    socket.on('new-message', (data) => {
        console.log('📨 New chat message:', data);
        
        // Add message to chat if this report is selected
        if (selectedReportId === data.reportId && chatModal && chatModal.style.display === 'block') {
            addMessageToChat(data.message, data.senderRole, data.senderName, data.id);
        }
        
        if (selectedReportId !== data.reportId) {
            showNotification(`💬 New message from ${data.senderName} on report #${data.reportId}`);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Responder socket disconnected');
        responderRegistered = false;
    });
}

function registerResponder() {
    if (!responderRegistered && socket && currentUser) {
        socket.emit('register', currentUser.id);
        responderRegistered = true;
        console.log('✅ Responder registered with socket');
    }
}

async function loadReports() {
    if (!reportsQueue) return;
    
    reportsQueue.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading reports...</div>';
    
    try {
        const response = await fetch('/api/reports');
        if (!response.ok) throw new Error('Failed to load reports');
        currentReports = await response.json();
        console.log('📋 Loaded reports:', currentReports.length);
        filterAndRenderReports();
        updateStats();
        updateSidebarCounts();
    } catch (error) {
        console.error('Error loading reports:', error);
        if (reportsQueue) {
            reportsQueue.innerHTML = '<div class="loading-spinner">❌ Error loading reports. Make sure server is running.</div>';
        }
    }
}

function filterAndRenderReports() {
    let filtered = [];
    
    switch(currentView) {
        case 'unassigned':
            filtered = currentReports.filter(r => !r.assignedTo && r.status !== 'resolved');
            break;
        case 'assigned':
            filtered = currentReports.filter(r => r.assignedTo == currentUser.id && r.status !== 'resolved');
            break;
        case 'resolved':
            filtered = currentReports.filter(r => r.status === 'resolved');
            break;
        case 'all':
        default:
            filtered = currentReports.filter(r => r.status !== 'resolved');
            break;
    }
    
    renderReports(filtered);
}

function renderReports(reports) {
    if (!reportsQueue) return;
    
    if (reports.length === 0) {
        reportsQueue.innerHTML = `
            <div class="saved-empty">
                <i class="fas fa-inbox" style="font-size: 48px; color: #ccc;"></i>
                <p>No reports in this category</p>
            </div>
        `;
        return;
    }
    
    reportsQueue.innerHTML = reports.map(report => createResponderCard(report)).join('');
    
    // Add click handlers to cards
    document.querySelectorAll('.responder-card').forEach(card => {
        card.addEventListener('click', () => {
            const reportId = parseInt(card.dataset.id);
            openReportModal(reportId);
        });
    });
}

function createResponderCard(report) {
    const urgencyClass = `urgency-${report.urgency}`;
    const urgencyText = { low: '🟢 Low', medium: '🟡 Medium', high: '🟠 High', emergency: '🔴 Emergency' }[report.urgency];
    const statusText = { pending: 'Pending', investigating: 'Investigating', resolved: 'Resolved' }[report.status];
    const statusClass = `status-${report.status}`;
    const timeAgo = getTimeAgo(new Date(report.createdAt));
    const isAssigned = report.assignedTo == currentUser.id;
    
    return `
        <div class="responder-card feed-card" data-id="${report.id}">
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
                <span class="${isAssigned ? 'assigned-badge' : 'unassigned-badge'}">
                    ${isAssigned ? '✓ Assigned to You' : '📋 Unassigned'}
                </span>
            </div>
            <div class="card-title">#${report.id} - ${escapeHtml(report.title)}</div>
            <div class="card-description">${escapeHtml(report.description.substring(0, 120))}${report.description.length > 120 ? '...' : ''}</div>
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

async function openReportModal(reportId) {
    selectedReportId = reportId;
    
    try {
        const response = await fetch(`/api/reports/${reportId}`);
        if (!response.ok) throw new Error('Failed to load report');
        const report = await response.json();
        currentReportData = report;
        
        displayReportDetails(report);
        await loadChatHistory(reportId);
        
        // Join socket room
        if (activeSocketRoom) {
            socket.emit('leave-room', activeSocketRoom);
        }
        activeSocketRoom = `report_${reportId}`;
        socket.emit('join-room', activeSocketRoom);
        
        // Update status dropdown
        if (modalUpdateStatus) {
            modalUpdateStatus.value = report.status;
        }
        
        // Show/hide assign button based on assignment
        if (modalAssignToMeBtn) {
            if (report.assignedTo === currentUser.id || report.assignedTo) {
                modalAssignToMeBtn.style.display = 'none';
            } else {
                modalAssignToMeBtn.style.display = 'block';
            }
        }
        
        // Show modal
        if (chatModal) {
            chatModal.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error opening report:', error);
        alert('Failed to load report details. Make sure server is running.');
    }
}

function displayReportDetails(report) {
    const container = document.getElementById('modalReportDetails');
    if (!container) return;
    
    const urgencyText = { low: '🟢 Low', medium: '🟡 Medium', high: '🟠 High', emergency: '🔴 Emergency' }[report.urgency];
    const statusText = { pending: 'Pending', investigating: 'Investigating', resolved: 'Resolved' }[report.status];
    const statusClass = `status-${report.status}`;
    
    container.innerHTML = `
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-hashtag"></i> Report ID</div>
            <div class="report-detail-value"><strong>#${report.id}</strong></div>
        </div>
        <div class="report-detail-item">
            <div class="report-detail-label"><i class="fas fa-user"></i> Submitted By</div>
            <div class="report-detail-value">${escapeHtml(report.residentName || 'Anonymous')}</div>
        </div>
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
        ${report.assignedTo ? `
            <div class="report-detail-item">
                <div class="report-detail-label"><i class="fas fa-user-check"></i> Assigned To</div>
                <div class="report-detail-value">${report.assignedTo === currentUser.id ? 'You' : `Responder #${report.assignedTo}`}</div>
            </div>
        ` : ''}
    `;
}

async function loadChatHistory(reportId) {
    if (!modalChatMessages) return;
    
    modalChatMessages.innerHTML = '<div class="system-message">💬 Loading messages...</div>';
    
    try {
        const response = await fetch(`/api/messages/${reportId}`);
        if (!response.ok) throw new Error('Failed to load messages');
        const messages = await response.json();
        
        modalChatMessages.innerHTML = '';
        if (messages.length === 0) {
            modalChatMessages.innerHTML = '<div class="system-message">💬 No messages yet. Start the conversation!</div>';
        } else {
            messages.forEach(msg => {
                addMessageToChat(msg.message, msg.senderRole, msg.senderName, msg.id);
            });
        }
        modalChatMessages.scrollTop = modalChatMessages.scrollHeight;
    } catch (error) {
        console.error('Error loading chat:', error);
        modalChatMessages.innerHTML = '<div class="system-message">❌ Error loading messages</div>';
    }
}

function addMessageToChat(message, senderRole, senderName, messageId) {
    if (!modalChatMessages) return;
    
    // Check for duplicate
    if (document.querySelector(`.chat-message[data-mid="${messageId}"]`)) {
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${senderRole === 'responder' ? 'responder' : 'resident'}`;
    messageDiv.setAttribute('data-mid', messageId);
    
    let displayName = senderRole === 'resident' ? senderName : `${senderName} (Responder)`;
    if (senderRole === 'responder' && senderName === currentUser.name) {
        displayName = `${senderName} (Responder) - You`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <div class="message-sender">
                ${escapeHtml(displayName)}
                <span class="message-time">${new Date().toLocaleTimeString()}</span>
            </div>
            <div>${escapeHtml(message)}</div>
        </div>
    `;
    
    modalChatMessages.appendChild(messageDiv);
    modalChatMessages.scrollTop = modalChatMessages.scrollHeight;
}

function sendChatMessage() {
    const message = modalChatInput.value.trim();
    if (!message || !selectedReportId) return;
    
    socket.emit('send-message', {
        reportId: selectedReportId,
        message: message,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: 'responder'
    });
    
    modalChatInput.value = '';
}

async function updateReportStatus() {
    if (!selectedReportId || !modalUpdateStatus) return;
    
    const newStatus = modalUpdateStatus.value;
    
    try {
        const response = await fetch(`/api/reports/${selectedReportId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            showNotification(`✅ Status updated to ${newStatus}`);
            await loadReports(); // Reload all reports
            if (chatModal && chatModal.style.display === 'block') {
                openReportModal(selectedReportId);
            }
        } else {
            throw new Error('Failed to update status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('❌ Error updating status');
    }
}

async function assignToMe() {
    if (!selectedReportId) return;
    
    try {
        const response = await fetch(`/api/reports/${selectedReportId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ responderId: currentUser.id })
        });
        
        if (response.ok) {
            showNotification(`✅ Report assigned to you!`);
            await loadReports();
            if (chatModal && chatModal.style.display === 'block') {
                openReportModal(selectedReportId);
            }
        } else {
            throw new Error('Failed to assign report');
        }
    } catch (error) {
        console.error('Error assigning report:', error);
        alert('❌ Error assigning report');
    }
}

function updateStats() {
    if (!currentReports.length) return;
    
    const emergency = currentReports.filter(r => r.urgency === 'emergency' && r.status !== 'resolved').length;
    const high = currentReports.filter(r => r.urgency === 'high' && r.status !== 'resolved').length;
    const assigned = currentReports.filter(r => r.assignedTo == currentUser.id && r.status !== 'resolved').length;
    const resolvedToday = currentReports.filter(r => {
        if (r.status !== 'resolved') return false;
        const today = new Date().toDateString();
        const resolvedDate = new Date(r.updatedAt || r.createdAt).toDateString();
        return resolvedDate === today;
    }).length;
    
    const emergencyCount = document.getElementById('emergencyCount');
    const highCount = document.getElementById('highCount');
    const assignedCount = document.getElementById('assignedCount');
    const resolvedTodayEl = document.getElementById('resolvedToday');
    
    if (emergencyCount) emergencyCount.innerText = emergency;
    if (highCount) highCount.innerText = high;
    if (assignedCount) assignedCount.innerText = assigned;
    if (resolvedTodayEl) resolvedTodayEl.innerText = resolvedToday;
}

function showProfile() {
    const profileModal = document.getElementById('profileModal');
    const profileName = document.getElementById('profileName');
    const profileEmpId = document.getElementById('profileEmpId');
    const profileDept = document.getElementById('profileDept');
    const profileHandled = document.getElementById('profileHandled');
    
    const handledCount = currentReports.filter(r => r.assignedTo == currentUser.id).length;
    
    if (profileName) profileName.value = currentUser.name || '';
    if (profileEmpId) profileEmpId.value = currentUser.empId || '';
    if (profileDept) profileDept.value = currentUser.department || 'Field Operations';
    if (profileHandled) profileHandled.value = handledCount;
    
    if (profileModal) profileModal.style.display = 'block';
    
    const closeBtn = document.querySelector('#profileModal .profile-modal-close');
    if (closeBtn) {
        closeBtn.onclick = () => profileModal.style.display = 'none';
    }
    window.onclick = (e) => {
        if (e.target === profileModal) profileModal.style.display = 'none';
    };
}

function showSettings() {
    const settingsModal = document.getElementById('settingsModal');
    
    const notifyMessages = localStorage.getItem('notifyMessages') === 'true';
    const notifyAssignments = localStorage.getItem('notifyAssignments') === 'true';
    const theme = localStorage.getItem('theme') || 'light';
    
    const notifyMessagesCheck = document.getElementById('notifyMessages');
    const notifyAssignmentsCheck = document.getElementById('notifyAssignments');
    const themeSelect = document.getElementById('themeSelect');
    
    if (notifyMessagesCheck) notifyMessagesCheck.checked = notifyMessages;
    if (notifyAssignmentsCheck) notifyAssignmentsCheck.checked = notifyAssignments;
    if (themeSelect) themeSelect.value = theme;
    
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    if (settingsModal) settingsModal.style.display = 'block';
    
    if (notifyMessagesCheck) {
        notifyMessagesCheck.onchange = () => localStorage.setItem('notifyMessages', notifyMessagesCheck.checked);
    }
    if (notifyAssignmentsCheck) {
        notifyAssignmentsCheck.onchange = () => localStorage.setItem('notifyAssignments', notifyAssignmentsCheck.checked);
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
    
    const closeBtn = document.querySelector('#settingsModal .settings-modal-close');
    if (closeBtn) {
        closeBtn.onclick = () => settingsModal.style.display = 'none';
    }
    window.onclick = (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
    };
}

function closeModal() {
    if (chatModal) {
        chatModal.style.display = 'none';
    }
    if (activeSocketRoom) {
        socket.emit('leave-room', activeSocketRoom);
        activeSocketRoom = null;
    }
    selectedReportId = null;
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #f59e0b, #ea580c);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);