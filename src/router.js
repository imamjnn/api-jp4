import express from 'express';
import {main} from './controllers/main';
import {example} from './controllers/example';
import {getExpenses, getExpenseById} from './controllers/expenses';

const router = express.Router();

router.get('/', main);
router.get('/example', example);

router.get('/expenses', getExpenses);
router.get('/expenses/:id', getExpenseById);

export default router;
