const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// Create uploads folder
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Setup Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ============ PERSISTENT STORAGE (Using JSON files) ============
const REPORTS_FILE = './reports.json';
const MESSAGES_FILE = './messages.json';
const USERS_FILE = './users.json';

// Load data from files
let reports = [];
let messages = [];
let users = [];
let nextReportId = 1;
let nextMessageId = 1;
let nextUserId = 1;

// Load users.json if exists
if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    nextUserId = Math.max(...users.map(u => u.id), 0) + 1;
    console.log(`✅ Loaded ${users.length} users from file`);
} else {
    // Create default users
    users = [
        { id: nextUserId++, name: "John Resident", email: "resident@demo.com", password: "123456", role: "resident", phone: "1234567890", createdAt: new Date().toISOString() },
        { id: nextUserId++, name: "Alice Chen", email: "alice@demo.com", password: "123456", role: "resident", phone: "1234567890", createdAt: new Date().toISOString() },
        { id: nextUserId++, name: "Officer Mike", empId: "RES-001", password: "123456", role: "responder", department: "Street Maintenance", createdAt: new Date().toISOString() },
        { id: nextUserId++, name: "Officer Sarah", empId: "RES-002", password: "123456", role: "responder", department: "Emergency Response", createdAt: new Date().toISOString() }
    ];
    saveUsers();
}

// Load reports.json if exists
if (fs.existsSync(REPORTS_FILE)) {
    reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
    nextReportId = Math.max(...reports.map(r => r.id), 0) + 1;
    console.log(`✅ Loaded ${reports.length} reports from file`);
} else {
    // Sample reports
    reports.push({
        id: nextReportId++,
        title: "Broken Street Light",
        description: "Street light broken for 2 weeks, very dark at night",
        urgency: "high",
        location: "123 Main Street",
        status: "pending",
        residentId: 1,
        residentName: "John Resident",
        createdAt: new Date().toISOString(),
        photo: null,
        assignedTo: null
    });
    
    reports.push({
        id: nextReportId++,
        title: "Large Pothole",
        description: "Dangerous pothole that damaged my tire",
        urgency: "medium",
        location: "Oak Avenue",
        status: "investigating",
        residentId: 2,
        residentName: "Alice Chen",
        createdAt: new Date().toISOString(),
        photo: null,
        assignedTo: 3
    });
    
    reports.push({
        id: nextReportId++,
        title: "Flooded Street",
        description: "Heavy flooding, cars cannot pass",
        urgency: "emergency",
        location: "River Road",
        status: "pending",
        residentId: 1,
        residentName: "John Resident",
        createdAt: new Date().toISOString(),
        photo: null,
        assignedTo: null
    });
    saveReports();
}

// Load messages.json if exists
if (fs.existsSync(MESSAGES_FILE)) {
    messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    nextMessageId = Math.max(...messages.map(m => m.id), 0) + 1;
    console.log(`✅ Loaded ${messages.length} messages from file`);
}

// Save functions
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveReports() {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2));
}

function saveMessages() {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// ============ USER API ROUTES ============

// Resident Login
app.post('/api/login/resident', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password && u.role === 'resident');
    
    if (user) {
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Responder Login
app.post('/api/login/responder', (req, res) => {
    const { empId, password } = req.body;
    const user = users.find(u => u.empId === empId && u.password === password && u.role === 'responder');
    
    if (user) {
        res.json({ id: user.id, name: user.name, empId: user.empId, department: user.department, role: user.role });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Resident Registration
app.post('/api/register/resident', (req, res) => {
    const { name, email, password, phone } = req.body;
    
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        res.status(400).json({ error: 'Email already registered' });
        return;
    }
    
    const newUser = {
        id: nextUserId++,
        name: name,
        email: email,
        password: password,
        phone: phone,
        role: 'resident',
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers();
    
    res.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
});

// Check server status
app.get('/api/login/check', (req, res) => {
    res.json({ status: 'ok', users: users.length });
});

// Get all users
app.get('/api/users', (req, res) => {
    res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
});

// ============ REPORT API ROUTES ============

// Get all reports
app.get('/api/reports', (req, res) => {
    res.json(reports);
});

// ✅ NEW: Get single report by ID (THIS WAS MISSING!)
app.get('/api/reports/:id', (req, res) => {
    const reportId = parseInt(req.params.id);
    const report = reports.find(r => r.id === reportId);
    
    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json(report);
});

// ✅ NEW: Get reports by resident ID
app.get('/api/reports/resident/:residentId', (req, res) => {
    const residentId = parseInt(req.params.residentId);
    const userReports = reports.filter(r => r.residentId === residentId);
    res.json(userReports);
});

// ✅ NEW: Get messages for a report
app.get('/api/messages/:reportId', (req, res) => {
    const reportId = parseInt(req.params.reportId);
    const reportMessages = messages.filter(m => m.reportId === reportId);
    res.json(reportMessages);
});

// Create new report with photo upload
app.post('/api/reports', upload.single('photo'), (req, res) => {
    const { title, description, urgency, location, residentId, residentName } = req.body;
    
    const newReport = {
        id: nextReportId++,
        title: title,
        description: description,
        urgency: urgency || 'medium',
        location: location || 'Location not specified',
        status: 'pending',
        residentId: parseInt(residentId) || 0,
        residentName: residentName || 'Anonymous',
        createdAt: new Date().toISOString(),
        photo: req.file ? `/uploads/${req.file.filename}` : null,
        assignedTo: null
    };
    
    reports.push(newReport);
    saveReports();
    
    // Broadcast to all connected clients
    io.emit('report-updated', { reportId: newReport.id, action: 'created' });
    
    res.status(201).json(newReport);
});

// Update report status
app.put('/api/reports/:id/status', (req, res) => {
    const { status } = req.body;
    const report = reports.find(r => r.id == parseInt(req.params.id));
    
    if (report) {
        report.status = status;
        report.updatedAt = new Date().toISOString();
        saveReports();
        io.emit('report-updated', { reportId: report.id, status: status });
        res.json(report);
    } else {
        res.status(404).json({ error: 'Report not found' });
    }
});

// Assign report to responder
app.post('/api/reports/:id/assign', (req, res) => {
    const { responderId } = req.body;
    const report = reports.find(r => r.id == parseInt(req.params.id));
    
    if (report) {
        report.assignedTo = parseInt(responderId);
        report.status = 'investigating';
        report.updatedAt = new Date().toISOString();
        saveReports();
        io.emit('report-updated', { reportId: report.id, status: 'investigating', assignedTo: responderId });
        res.json(report);
    } else {
        res.status(404).json({ error: 'Report not found' });
    }
});

// ============ WEBSOCKET CHAT (UPDATED) ============
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    // Join a report room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`📡 Socket ${socket.id} joined room: ${roomId}`);
    });
    
    // Leave a report room
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        console.log(`📡 Socket ${socket.id} left room: ${roomId}`);
    });
    
    // Send message
    socket.on('send-message', (data) => {
        console.log('💬 Chat message:', data);
        
        const newMessage = {
            id: nextMessageId++,
            reportId: data.reportId,
            message: data.message,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            timestamp: new Date().toISOString()
        };
        
        messages.push(newMessage);
        saveMessages();
        
        // Broadcast to everyone in the report room
        io.to(`report_${data.reportId}`).emit('new-message', {
            id: newMessage.id,
            reportId: data.reportId,
            message: data.message,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            timestamp: newMessage.timestamp
        });
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Open in browser: http://localhost:${PORT}/login.html`);
    console.log(`💾 Data saved to JSON files`);
    console.log(`👥 ${users.length} users loaded`);
    console.log(`📊 ${reports.length} reports loaded`);
    console.log(`💬 ${messages.length} messages loaded`);
});