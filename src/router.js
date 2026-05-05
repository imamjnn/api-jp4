import express from 'express';
import {main} from './controllers/main';
import {example} from './controllers/example';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} from './controllers/expenses';
import {login, logout, refresh, me} from './controllers/auth';
import {authenticate} from './middlewares/authenticate';
import {pool} from './db';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from './controllers/expenseCategories';
import {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
} from './controllers/members';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  addStock,
} from './controllers/items';

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

// Expense Categories (protected)
router.get('/expense-categories', authenticate, getCategories);
router.get('/expense-categories/:id', authenticate, getCategoryById);
router.post('/expense-categories', authenticate, createCategory);
router.put('/expense-categories/:id', authenticate, updateCategory);
router.delete('/expense-categories/:id', authenticate, deleteCategory);

// Members (protected)
router.get('/members', authenticate, getMembers);
router.get('/members/:id', authenticate, getMemberById);
router.post('/members', authenticate, createMember);
router.put('/members/:id', authenticate, updateMember);
router.delete('/members/:id', authenticate, deleteMember);

// Items (protected)
router.get('/items', authenticate, getItems);
router.get('/items/:id', authenticate, getItemById);
router.post('/items', authenticate, createItem);
router.put('/items/:id', authenticate, updateItem);
router.delete('/items/:id', authenticate, deleteItem);
router.post('/items/:id/stock', authenticate, addStock);

// Expenses (protected)
router.get('/expenses/summary', authenticate, getExpenseSummary);
router.get('/expenses', authenticate, getExpenses);
router.get('/expenses/:id', authenticate, getExpenseById);
router.post('/expenses', authenticate, createExpense);
router.put('/expenses/:id', authenticate, updateExpense);
router.delete('/expenses/:id', authenticate, deleteExpense);

export default router;
