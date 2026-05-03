import {db} from '../../db';
import {expenses, expenseCategories, expenseDetails} from '../../db/schema';
import {eq} from 'drizzle-orm';

export const createExpense = async (req, res) => {
  const {categoryId, description, date, details} = req.body;

  if (!categoryId) {
    return res.status(400).json({success: false, message: 'categoryId is required'});
  }
  if (!Array.isArray(details) || details.length === 0) {
    return res.status(400).json({success: false, message: 'details must be a non-empty array'});
  }
  for (const d of details) {
    if (!d.name || d.qty == null || d.price == null) {
      return res
        .status(400)
        .json({success: false, message: 'Each detail must have name, qty, and price'});
    }
  }

  const totalAmount = details.reduce((sum, d) => sum + d.qty * d.price, 0);
  const expenseDate = date ? new Date(date) : new Date();

  if (isNaN(expenseDate)) {
    return res.status(400).json({success: false, message: 'Invalid date format'});
  }

  try {
    const [category] = await db
      .select({id: expenseCategories.id})
      .from(expenseCategories)
      .where(eq(expenseCategories.id, Number(categoryId)));

    if (!category) {
      return res.status(404).json({success: false, message: 'Category not found'});
    }

    const [newExpense] = await db
      .insert(expenses)
      .values({
        categoryId: Number(categoryId),
        description: description || null,
        totalAmount,
        createdBy: req.user.userId,
        date: expenseDate,
      })
      .returning();

    const detailRows = details.map((d) => ({
      expenseId: newExpense.id,
      name: d.name,
      qty: d.qty,
      price: d.price,
      subtotal: d.qty * d.price,
    }));

    const insertedDetails = await db.insert(expenseDetails).values(detailRows).returning();

    res.status(201).json({
      success: true,
      message: 'Expense created',
      data: {...newExpense, details: insertedDetails},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
