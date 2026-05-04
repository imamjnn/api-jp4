import express from 'express';
import {main} from './controllers/main';
import {example} from './controllers/example';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from './controllers/expenses';
import {login, logout, refresh, me} from './controllers/auth';
import {authenticate} from './middlewares/authenticate';
import {pool} from './db';

const router = express.Router();

router.get('/', main);
router.get('/example', example);

// DB health check
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({success: true, message: 'Database connected'});
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message,
      url: process.env.BASE_URL || 'Not set',
    });
  }
});

// Auth
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', logout);
router.get('/auth/me', authenticate, me);

// Expenses (protected)
router.get('/expenses', authenticate, getExpenses);
router.get('/expenses/:id', authenticate, getExpenseById);
router.post('/expenses', authenticate, createExpense);
router.put('/expenses/:id', authenticate, updateExpense);
router.delete('/expenses/:id', authenticate, deleteExpense);

export default router;
