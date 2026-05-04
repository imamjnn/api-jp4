import {db} from '../../db';
import {expenses, expenseCategories} from '../../db/schema';
import {eq, sum, count, and, gte, lte, sql} from 'drizzle-orm';

export const getExpenseSummary = async (req, res) => {
  const {period, dateFrom, dateTo} = req.query;

  // Tentukan range tanggal berdasarkan period
  const now = new Date();
  let from, to;

  if (period === 'daily') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = now.getDay(); // 0=Sun
    const diffToMonday = day === 0 ? -6 : 1 - day;
    from = new Date(now);
    from.setDate(now.getDate() + diffToMonday);
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === 'yearly') {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    // Custom range via dateFrom & dateTo
    if (dateFrom) {
      from = new Date(dateFrom);
      if (isNaN(from))
        return res.status(400).json({success: false, message: 'Invalid dateFrom format'});
    }
    if (dateTo) {
      to = new Date(dateTo);
      if (isNaN(to))
        return res.status(400).json({success: false, message: 'Invalid dateTo format'});
      to.setHours(23, 59, 59, 999);
    }
  }

  const filters = [];
  if (from) filters.push(gte(expenses.date, from));
  if (to) filters.push(lte(expenses.date, to));
  const where = filters.length > 0 ? and(...filters) : undefined;

  try {
    // Total keseluruhan
    const [totals] = await db
      .select({
        totalAmount: sum(expenses.totalAmount),
        totalTransactions: count(expenses.id),
      })
      .from(expenses)
      .where(where);

    // Per kategori
    const byCategory = await db
      .select({
        categoryId: expenseCategories.id,
        categoryName: expenseCategories.name,
        totalAmount: sum(expenses.totalAmount),
        totalTransactions: count(expenses.id),
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(where)
      .groupBy(expenseCategories.id, expenseCategories.name)
      .orderBy(sql`sum(${expenses.totalAmount}) desc`);

    res.json({
      success: true,
      message: 'OK',
      data: {
        period: period || 'custom',
        dateFrom: from || null,
        dateTo: to || null,
        totalAmount: Number(totals.totalAmount) || 0,
        totalTransactions: Number(totals.totalTransactions) || 0,
        byCategory,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
