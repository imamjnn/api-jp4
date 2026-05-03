import {db} from '../../db';
import {expenses, expenseCategories, expenseDetails, users} from '../../db/schema';
import {eq} from 'drizzle-orm';

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
