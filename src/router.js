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

const router = express.Router();

router.get('/', main);
router.get('/example', example);

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
