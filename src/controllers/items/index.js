import {db} from '../../db';
import {items, itemRates, itemStocks, voucherDetails} from '../../db/schema';
import {eq, and, ne, count, ilike, desc, sql} from 'drizzle-orm';

const getCurrentStock = async (itemId) => {
  const [result] = await db
    .select({
      total: sql`SUM(CASE WHEN ${itemStocks.type} = 'in' THEN ${itemStocks.qty} ELSE -${itemStocks.qty} END)`,
    })
    .from(itemStocks)
    .where(eq(itemStocks.itemId, itemId));
  return Number(result?.total ?? 0);
};

export const getItems = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;
  const {search} = req.query;

  const where = search ? ilike(items.name, `%${search}%`) : undefined;

  try {
    const [totalResult, rows] = await Promise.all([
      db.select({total: count()}).from(items).where(where),
      db.select().from(items).where(where).orderBy(items.name).limit(limit).offset(offset),
    ]);

    // Attach latest rate and current stock to each item
    const itemsWithRate = await Promise.all(
      rows.map(async (item) => {
        const [[latestRate], currentStock] = await Promise.all([
          db
            .select()
            .from(itemRates)
            .where(eq(itemRates.itemId, item.id))
            .orderBy(desc(itemRates.createdAt))
            .limit(1),
          getCurrentStock(item.id),
        ]);
        return {...item, currentRate: latestRate?.rate ?? null, currentStock};
      })
    );

    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: 'OK',
      data: itemsWithRate,
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
    res
      .status(500)
      .json({success: false, message: 'Internal server error', error: JSON.stringify(err)});
  }
};

export const getItemById = async (req, res) => {
  const {id} = req.params;

  try {
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, Number(id)));

    if (!item) {
      return res.status(404).json({success: false, message: 'Item not found'});
    }

    const [rates, stockHistory, currentStock] = await Promise.all([
      db
        .select()
        .from(itemRates)
        .where(eq(itemRates.itemId, Number(id)))
        .orderBy(desc(itemRates.createdAt)),
      db
        .select()
        .from(itemStocks)
        .where(eq(itemStocks.itemId, Number(id)))
        .orderBy(desc(itemStocks.id)),
      getCurrentStock(Number(id)),
    ]);

    res.json({success: true, message: 'OK', data: {...item, rates, currentStock, stockHistory}});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const createItem = async (req, res) => {
  const {name, unit, rate, stock, stockNote} = req.body;

  if (!name || !unit || rate === undefined) {
    return res.status(400).json({success: false, message: 'name, unit, and rate are required'});
  }

  if (isNaN(rate) || Number(rate) < 0) {
    return res.status(400).json({success: false, message: 'rate must be a non-negative number'});
  }

  if (stock !== undefined && (isNaN(stock) || Number(stock) < 0)) {
    return res.status(400).json({success: false, message: 'stock must be a non-negative number'});
  }

  try {
    const [duplicate] = await db.select({id: items.id}).from(items).where(ilike(items.name, name));

    if (duplicate) {
      return res
        .status(409)
        .json({success: false, message: 'Item with the same name already exists'});
    }

    const [item] = await db.insert(items).values({name, unit}).returning();
    const [itemRate] = await db
      .insert(itemRates)
      .values({itemId: item.id, rate: Number(rate)})
      .returning();

    let currentStock = 0;
    if (stock !== undefined && Number(stock) > 0) {
      await db.insert(itemStocks).values({
        itemId: item.id,
        type: 'in',
        qty: Number(stock),
        note: stockNote ?? null,
        refType: 'manual',
        createdBy: req.user.userId,
      });
      currentStock = Number(stock);
    }

    res.status(201).json({
      success: true,
      message: 'Item created',
      data: {...item, currentRate: itemRate.rate, currentStock},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const updateItem = async (req, res) => {
  const {id} = req.params;
  const {name, unit, rate} = req.body;

  if (name === undefined && unit === undefined && rate === undefined) {
    return res.status(400).json({success: false, message: 'At least one field is required'});
  }

  if (rate !== undefined && (isNaN(rate) || Number(rate) < 0)) {
    return res.status(400).json({success: false, message: 'rate must be a non-negative number'});
  }

  try {
    const [existing] = await db
      .select()
      .from(items)
      .where(eq(items.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Item not found'});
    }

    if (name !== undefined) {
      const [duplicate] = await db
        .select({id: items.id})
        .from(items)
        .where(and(ilike(items.name, name), ne(items.id, Number(id))));

      if (duplicate) {
        return res
          .status(409)
          .json({success: false, message: 'Item with the same name already exists'});
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (unit !== undefined) updateData.unit = unit;

    let updated = existing;
    if (Object.keys(updateData).length > 0) {
      [updated] = await db
        .update(items)
        .set(updateData)
        .where(eq(items.id, Number(id)))
        .returning();
    }

    let currentRate = null;
    if (rate !== undefined) {
      const [newRate] = await db
        .insert(itemRates)
        .values({itemId: Number(id), rate: Number(rate)})
        .returning();
      currentRate = newRate.rate;
    } else {
      const [latestRate] = await db
        .select()
        .from(itemRates)
        .where(eq(itemRates.itemId, Number(id)))
        .orderBy(desc(itemRates.createdAt))
        .limit(1);
      currentRate = latestRate?.rate ?? null;
    }

    res.json({success: true, message: 'Item updated', data: {...updated, currentRate}});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const deleteItem = async (req, res) => {
  const {id} = req.params;

  try {
    const [existing] = await db
      .select()
      .from(items)
      .where(eq(items.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Item not found'});
    }

    const [used] = await db
      .select({total: count()})
      .from(voucherDetails)
      .where(eq(voucherDetails.itemId, Number(id)));

    if (Number(used.total) > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: item is used in ${used.total} voucher detail(s)`,
      });
    }

    // Delete rates and stocks first (FK safety), then item
    await db.delete(itemRates).where(eq(itemRates.itemId, Number(id)));
    await db.delete(itemStocks).where(eq(itemStocks.itemId, Number(id)));
    await db.delete(items).where(eq(items.id, Number(id)));

    res.json({success: true, message: 'Item deleted'});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const addStock = async (req, res) => {
  const {id} = req.params;
  const {qty, note} = req.body;

  if (qty === undefined || isNaN(qty) || Number(qty) <= 0) {
    return res.status(400).json({success: false, message: 'qty must be a positive number'});
  }

  try {
    const [existing] = await db
      .select()
      .from(items)
      .where(eq(items.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Item not found'});
    }

    const [record] = await db
      .insert(itemStocks)
      .values({
        itemId: Number(id),
        type: 'in',
        qty: Number(qty),
        note: note ?? null,
        refType: 'manual',
        createdBy: req.user.userId,
      })
      .returning();

    const currentStock = await getCurrentStock(Number(id));

    res.status(201).json({
      success: true,
      message: 'Stock added',
      data: {...record, currentStock},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
