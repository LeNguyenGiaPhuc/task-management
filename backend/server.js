const express = require('express');
const path = require('path');
require('dotenv').config();

const {
  aiLimiter,
  authLimiter,
  configureSecurity,
  generalLimiter,
  uploadLimiter,
} = require('./middleware/security.middleware');
const authRoutes = require('./routes/auth.routes');
const aiRoutes = require('./routes/ai.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const boardsRoutes = require('./routes/boards.routes');
const columnsRoutes = require('./routes/columns.routes');
const tasksRoutes = require('./routes/tasks.routes');
const subtasksRoutes = require('./routes/subtasks.routes');
const usersRoutes = require('./routes/users.routes');

const app = express();
const PORT = process.env.PORT || 5000;

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

configureSecurity(app);
app.use(generalLimiter);
app.use('/uploads', uploadLimiter, express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('MartinDesk API is running smoothly!');
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/ai', aiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/columns', columnsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/subtasks', subtasksRoutes);
app.use('/api/users', usersRoutes);

app.use((error, req, res, next) => {
  if (error.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: 'Origin is not allowed by CORS' });
  }

  return next(error);
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
