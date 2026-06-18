require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

// Ensure SQLite database directories exist before initializing Knex (dev only)
if (process.env.DB_CLIENT !== 'pg') {
  const dbPath = process.env.DB_CONNECTION_FILENAME || './src/database/ecopilot.sqlite';
  const dbDir = path.dirname(path.resolve(__dirname, dbPath));
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[DB] Created database folder path: ${dbDir}`);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Import route files
const authRoutes = require('./src/routes/auth');
const onboardingRoutes = require('./src/routes/onboarding');
const dashboardRoutes = require('./src/routes/dashboard');
const checkinRoutes = require('./src/routes/checkin');
const captureRoutes = require('./src/routes/captures');
const goalsRoutes = require('./src/routes/goals');

// Register routes
app.use('/auth', authRoutes);
app.use('/onboarding', onboardingRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/checkin', checkinRoutes);
app.use('/captures', captureRoutes);
app.use('/goals', goalsRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Programmatic DB Migration & Seeding on Startup
console.log('[DB] Checking migrations and seeds...');
const dbReady = db.migrate.latest()
  .then(() => {
    console.log('[DB] Migrations applied.');
    return db.seed.run();
  })
  .then(() => {
    console.log('[DB] Seeding emission factors completed successfully.');
    // Start listening once DB is configured
    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`[SERVER] EcoPilot backend running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
      });
    }
  })
  .catch(err => {
    console.error('[DB ERROR] Database initialization failed. Server could not start.', err);
    if (require.main === module) {
      process.exit(1);
    }
  });

app.dbReady = dbReady;
module.exports = app;
