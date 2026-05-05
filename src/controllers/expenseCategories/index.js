import {db} from '../../db';
import {expenseCategories, expenses} from '../../db/schema';
import {eq, count} from 'drizzle-orm';

export const getCategories = async (req, res) => {
  try {
    const rows = await db.select().from(expenseCategories).orderBy(expenseCategories.name);
    res.json({success: true, message: 'OK', data: rows});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const getCategoryById = async (req, res) => {
  const {id} = req.params;
  try {
    const [category] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, Number(id)));

    if (!category) {
      return res.status(404).json({success: false, message: 'Category not found'});
    }

    res.json({success: true, message: 'OK', data: category});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const createCategory = async (req, res) => {
  const {name} = req.body;

  if (!name) {
    return res.status(400).json({success: false, message: 'name is required'});
  }

  try {
    const [existing] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.name, name));

    if (existing) {
      return res.status(409).json({success: false, message: 'Category name already exists'});
    }

    const [category] = await db.insert(expenseCategories).values({name}).returning();
    res.status(201).json({success: true, message: 'Category created', data: category});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const updateCategory = async (req, res) => {
  const {id} = req.params;
  const {name} = req.body;

  if (!name) {
    return res.status(400).json({success: false, message: 'name is required'});
  }

  try {
    const [existing] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Category not found'});
    }

    const [duplicate] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.name, name));

    if (duplicate && duplicate.id !== Number(id)) {
      return res.status(409).json({success: false, message: 'Category name already exists'});
    }

    const [updated] = await db
      .update(expenseCategories)
      .set({name})
      .where(eq(expenseCategories.id, Number(id)))
      .returning();

    res.json({success: true, message: 'Category updated', data: updated});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const deleteCategory = async (req, res) => {
  const {id} = req.params;

  try {
    const [existing] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Category not found'});
    }

    // Cek apakah kategori masih dipakai
    const [used] = await db
      .select({total: count()})
      .from(expenses)
      .where(eq(expenses.categoryId, Number(id)));

    if (Number(used.total) > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: category is used by ${used.total} expense(s)`,
      });
    }

    await db.delete(expenseCategories).where(eq(expenseCategories.id, Number(id)));
    res.json({success: true, message: 'Category deleted'});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
