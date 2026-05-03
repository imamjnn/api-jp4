import {db} from '../../db';
import {expenses, expenseDetails} from '../../db/schema';
import {eq} from 'drizzle-orm';

export const deleteExpense = async (req, res) => {
  const {id} = req.params;

  try {
    const [existing] = await db
      .select({id: expenses.id})
      .from(expenses)
      .where(eq(expenses.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Expense not found'});
    }

    await db.delete(expenseDetails).where(eq(expenseDetails.expenseId, Number(id)));
    await db.delete(expenses).where(eq(expenses.id, Number(id)));

    res.json({success: true, message: 'Expense deleted'});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
