// ============================================
// RestaurantLedger v2.0 — Express API Server
// ============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import billRoutes from './routes/bills.js';
import branchRoutes from './routes/branches.js';
import managerRoutes from './routes/managers.js';
import vendorRoutes from './routes/vendors.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import staffRoutes from './routes/staff.js';
import pettyCashRoutes from './routes/pettyCash.js';
import wastageRoutes from './routes/wastage.js';
import recipeRoutes from './routes/recipes.js';
import recurringVendorRoutes from './routes/recurringVendors.js';
import { initCronJobs } from './jobs/scheduler.js';
import { apiLimiter } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || './uploads')));

// Rate limiting
app.use('/api/', apiLimiter);

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/wastage', wastageRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/recurring-vendors', recurringVendorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n🍽️  RestaurantLedger API v2.0`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Using in-memory store'}\n`);
  initCronJobs();
});

export default app;
