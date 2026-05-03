import {db} from '../db';
import {expenses, expenseCategories, expenseDetails, users} from '../db/schema';
import {eq, count, and, gte, lte} from 'drizzle-orm';

export const getExpenses = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const {dateFrom, dateTo} = req.query;

  const filters = [];
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (isNaN(from))
      return res.status(400).json({success: false, message: 'Invalid dateFrom format'});
    filters.push(gte(expenses.date, from));
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (isNaN(to)) return res.status(400).json({success: false, message: 'Invalid dateTo format'});
    to.setHours(23, 59, 59, 999);
    filters.push(lte(expenses.date, to));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  try {
    const [totalResult, rows] = await Promise.all([
      db.select({total: count()}).from(expenses).where(where),
      db
        .select({
          id: expenses.id,
          description: expenses.description,
          totalAmount: expenses.totalAmount,
          date: expenses.date,
          createdAt: expenses.createdAt,
          category: {
            id: expenseCategories.id,
            name: expenseCategories.name,
          },
          createdBy: {
            id: users.id,
            name: users.name,
          },
        })
        .from(expenses)
        .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .leftJoin(users, eq(expenses.createdBy, users.id))
        .where(where)
        .orderBy(expenses.date)
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: 'OK',
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const getExpenseById = async (req, res) => {
  const {id} = req.params;

  try {
    const [expense] = await db
      .select({
        id: expenses.id,
        description: expenses.description,
        totalAmount: expenses.totalAmount,
        date: expenses.date,
        createdAt: expenses.createdAt,
        category: {
          id: expenseCategories.id,
          name: expenseCategories.name,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(users, eq(expenses.createdBy, users.id))
      .where(eq(expenses.id, Number(id)));

    if (!expense) {
      return res.status(404).json({success: false, message: 'Expense not found'});
    }

    const details = await db
      .select()
      .from(expenseDetails)
      .where(eq(expenseDetails.expenseId, Number(id)));

    res.json({success: true, message: 'OK', data: {...expense, details}});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
