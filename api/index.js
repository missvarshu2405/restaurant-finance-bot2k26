// ============================================
// Vercel Serverless Function — Express Adapter
// Wraps the entire Express backend as a single
// serverless function for Vercel deployment
// ============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from '../backend/routes/auth.js';
import billRoutes from '../backend/routes/bills.js';
import branchRoutes from '../backend/routes/branches.js';
import managerRoutes from '../backend/routes/managers.js';
import vendorRoutes from '../backend/routes/vendors.js';
import reportRoutes from '../backend/routes/reports.js';
import notificationRoutes from '../backend/routes/notifications.js';
import staffRoutes from '../backend/routes/staff.js';
import pettyCashRoutes from '../backend/routes/pettyCash.js';
import wastageRoutes from '../backend/routes/wastage.js';
import recipeRoutes from '../backend/routes/recipes.js';
import recurringVendorRoutes from '../backend/routes/recurringVendors.js';
import { apiLimiter } from '../backend/middleware/rateLimit.js';

const app = express();

// --- Middleware ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

// Add Vercel deployment URL if set
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
// Add custom production URL if set
if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any .vercel.app subdomain
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  res.json({
    status: 'ok',
    version: '2.0.0',
    environment: 'vercel',
    timestamp: new Date().toISOString(),
  });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Export for Vercel serverless
export default app;
