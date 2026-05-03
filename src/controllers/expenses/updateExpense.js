import {db} from '../../db';
import {expenses, expenseCategories, expenseDetails} from '../../db/schema';
import {eq} from 'drizzle-orm';

export const updateExpense = async (req, res) => {
  const {id} = req.params;
  const {categoryId, description, date, details} = req.body;

  if (details !== undefined) {
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
  }

  try {
    const [existing] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Expense not found'});
    }

    if (categoryId) {
      const [category] = await db
        .select({id: expenseCategories.id})
        .from(expenseCategories)
        .where(eq(expenseCategories.id, Number(categoryId)));

      if (!category) {
        return res.status(404).json({success: false, message: 'Category not found'});
      }
    }

    const expenseDate = date ? new Date(date) : undefined;
    if (expenseDate && isNaN(expenseDate)) {
      return res.status(400).json({success: false, message: 'Invalid date format'});
    }

    // Hitung ulang totalAmount dari details baru jika ada
    let totalAmount;
    let insertedDetails;

    if (details) {
      totalAmount = details.reduce((sum, d) => sum + d.qty * d.price, 0);

      // Hapus details lama, insert yang baru
      await db.delete(expenseDetails).where(eq(expenseDetails.expenseId, Number(id)));

      const detailRows = details.map((d) => ({
        expenseId: Number(id),
        name: d.name,
        qty: d.qty,
        price: d.price,
        subtotal: d.qty * d.price,
      }));

      insertedDetails = await db.insert(expenseDetails).values(detailRows).returning();
    } else {
      // Ambil details lama untuk response
      insertedDetails = await db
        .select()
        .from(expenseDetails)
        .where(eq(expenseDetails.expenseId, Number(id)));
    }

    const updateData = {};
    if (categoryId) updateData.categoryId = Number(categoryId);
    if (description !== undefined) updateData.description = description;
    if (expenseDate) updateData.date = expenseDate;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;

    const [updated] = await db
      .update(expenses)
      .set(updateData)
      .where(eq(expenses.id, Number(id)))
      .returning();

    res.json({
      success: true,
      message: 'Expense updated',
      data: {...updated, details: insertedDetails},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
