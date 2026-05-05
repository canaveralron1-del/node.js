const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');

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

// ============ MySQL CONNECTION (Using Railway Environment Variables) ============
const pool = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    port: process.env.MYSQLPORT || 3306,
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

// ============ INITIALIZE DATABASE TABLES ============
async function initDatabase() {
    try {
        // Create users table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                phone VARCHAR(50),
                empId VARCHAR(50),
                department VARCHAR(255),
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create reports table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                urgency VARCHAR(50),
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                residentId INT,
                residentName VARCHAR(255),
                photo VARCHAR(500),
                assignedTo INT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Create messages table
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT PRIMARY KEY AUTO_INCREMENT,
                reportId INT NOT NULL,
                message TEXT NOT NULL,
                senderId INT NOT NULL,
                senderName VARCHAR(255) NOT NULL,
                senderRole VARCHAR(50) NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Check if users exist, if not, insert demo data
        const [users] = await promisePool.query('SELECT COUNT(*) as count FROM users');
        if (users[0].count === 0) {
            console.log('📝 Inserting demo data...');
            
            await promisePool.query(`
                INSERT INTO users (name, email, password, role, phone) VALUES 
                ('John Resident', 'resident@demo.com', '123456', 'resident', '1234567890'),
                ('Alice Chen', 'alice@demo.com', '123456', 'resident', '1234567890'),
                ('Officer Mike', NULL, '123456', 'responder', NULL, 'RES-001', 'Street Maintenance'),
                ('Officer Sarah', NULL, '123456', 'responder', NULL, 'RES-002', 'Emergency Response')
            `);
            
            await promisePool.query(`
                INSERT INTO reports (title, description, urgency, location, status, residentId, residentName) VALUES 
                ('Broken Street Light', 'Street light broken for 2 weeks, very dark at night', 'high', '123 Main Street', 'pending', 1, 'John Resident'),
                ('Large Pothole', 'Dangerous pothole that damaged my tire', 'medium', 'Oak Avenue', 'investigating', 2, 'Alice Chen'),
                ('Flooded Street', 'Heavy flooding, cars cannot pass', 'emergency', 'River Road', 'pending', 1, 'John Resident')
            `);
            
            console.log('✅ Demo data inserted');
        }
        
        console.log('✅ Database tables ready');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// ============ USER API ROUTES ============

// Resident Login
app.post('/api/login/resident', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM users WHERE email = ? AND password = ? AND role = "resident"',
            [email, password]
        );
        
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Responder Login
app.post('/api/login/responder', async (req, res) => {
    const { empId, password } = req.body;
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM users WHERE empId = ? AND password = ? AND role = "responder"',
            [empId, password]
        );
        
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ id: user.id, name: user.name, empId: user.empId, department: user.department, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Resident Registration
app.post('/api/register/resident', async (req, res) => {
    const { name, email, password, phone } = req.body;
    
    try {
        const [existing] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            res.status(400).json({ error: 'Email already registered' });
            return;
        }
        
        const [result] = await promisePool.query(
            'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "resident", ?)',
            [name, email, password, phone]
        );
        
        res.json({ id: result.insertId, name: name, email: email, role: 'resident' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check server status
app.get('/api/login/check', async (req, res) => {
    try {
        const [users] = await promisePool.query('SELECT COUNT(*) as count FROM users');
        res.json({ status: 'ok', users: users[0].count });
    } catch (error) {
        res.json({ status: 'ok', users: 0 });
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT id, name, email, role FROM users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ REPORT API ROUTES ============

// Get all reports
app.get('/api/reports', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT * FROM reports ORDER BY createdAt DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single report by ID
app.get('/api/reports/:id', async (req, res) => {
    try {
        const [rows] = await promisePool.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get reports by resident ID
app.get('/api/reports/resident/:residentId', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM reports WHERE residentId = ? ORDER BY createdAt DESC',
            [req.params.residentId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get messages for a report
app.get('/api/messages/:reportId', async (req, res) => {
    try {
        const [rows] = await promisePool.query(
            'SELECT * FROM messages WHERE reportId = ? ORDER BY timestamp ASC',
            [req.params.reportId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new report with photo upload
app.post('/api/reports', upload.single('photo'), async (req, res) => {
    const { title, description, urgency, location, residentId, residentName } = req.body;
    
    try {
        const [result] = await promisePool.query(
            'INSERT INTO reports (title, description, urgency, location, status, residentId, residentName, photo) VALUES (?, ?, ?, ?, "pending", ?, ?, ?)',
            [title, description, urgency || 'medium', location || 'Location not specified', residentId || 0, residentName || 'Anonymous', req.file ? `/uploads/${req.file.filename}` : null]
        );
        
        const [newReport] = await promisePool.query('SELECT * FROM reports WHERE id = ?', [result.insertId]);
        
        // Broadcast to all connected clients
        io.emit('report-updated', { reportId: result.insertId, action: 'created' });
        
        res.status(201).json(newReport[0]);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update report status
app.put('/api/reports/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        await promisePool.query('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
        
        const [updated] = await promisePool.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        io.emit('report-updated', { reportId: parseInt(req.params.id), status: status });
        res.json(updated[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Assign report to responder
app.post('/api/reports/:id/assign', async (req, res) => {
    const { responderId } = req.body;
    try {
        await promisePool.query(
            'UPDATE reports SET assignedTo = ?, status = "investigating" WHERE id = ?',
            [responderId, req.params.id]
        );
        
        const [updated] = await promisePool.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        io.emit('report-updated', { reportId: parseInt(req.params.id), status: 'investigating', assignedTo: responderId });
        res.json(updated[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ WEBSOCKET CHAT ============
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`📡 Socket ${socket.id} joined room: ${roomId}`);
    });
    
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        console.log(`📡 Socket ${socket.id} left room: ${roomId}`);
    });
    
    socket.on('send-message', async (data) => {
        console.log('💬 Chat message:', data);
        
        try {
            const [result] = await promisePool.query(
                'INSERT INTO messages (reportId, message, senderId, senderName, senderRole, timestamp) VALUES (?, ?, ?, ?, ?, NOW())',
                [data.reportId, data.message, data.senderId, data.senderName, data.senderRole]
            );
            
            const [newMessage] = await promisePool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
            
            io.to(`report_${data.reportId}`).emit('new-message', newMessage[0]);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;

// Initialize database and start server
initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📋 Open in browser: http://localhost:${PORT}/login.html`);
        console.log(`✅ Using MySQL database on Railway`);
    });
}).catch(error => {
    console.error('❌ Failed to initialize database:', error);
    server.listen(PORT, () => {
        console.log(`🚀 Server running but database may not be connected`);
    });
});