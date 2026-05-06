import {db} from '../../db';
import {
  vouchers,
  voucherDetails,
  members,
  items,
  itemRates,
  itemStocks,
  payouts,
} from '../../db/schema';
import {eq, count, desc, inArray, sql, ilike} from 'drizzle-orm';

const generateCode = () => {
  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from(
    {length: 5},
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `VCH-${datePart}-${random}`;
};

// ─── GET ALL ─────────────────────────────────────────────────────────────────

export const getVouchers = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;
  const {status, memberId, code} = req.query;

  const conditions = [];
  if (status) conditions.push(eq(vouchers.status, status));
  if (memberId) conditions.push(eq(vouchers.memberId, Number(memberId)));
  if (code) conditions.push(ilike(vouchers.code, `%${code}%`));

  const where =
    conditions.length > 0 ? sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}` : undefined;

  try {
    const [totalResult, rows] = await Promise.all([
      db.select({total: count()}).from(vouchers).where(where),
      db
        .select({
          id: vouchers.id,
          memberId: vouchers.memberId,
          memberName: members.name,
          code: vouchers.code,
          status: vouchers.status,
          totalQty: vouchers.totalQty,
          totalAmount: vouchers.totalAmount,
          createdAt: vouchers.createdAt,
          completedAt: vouchers.completedAt,
        })
        .from(vouchers)
        .leftJoin(members, eq(vouchers.memberId, members.id))
        .where(where)
        .orderBy(desc(vouchers.createdAt))
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

// ─── GET BY ID ────────────────────────────────────────────────────────────────

export const getVoucherById = async (req, res) => {
  const {id} = req.params;

  try {
    const [voucher] = await db
      .select({
        id: vouchers.id,
        code: vouchers.code,
        memberId: vouchers.memberId,
        memberName: members.name,
        status: vouchers.status,
        totalQty: vouchers.totalQty,
        totalAmount: vouchers.totalAmount,
        createdAt: vouchers.createdAt,
        completedAt: vouchers.completedAt,
      })
      .from(vouchers)
      .leftJoin(members, eq(vouchers.memberId, members.id))
      .where(eq(vouchers.id, Number(id)));

    if (!voucher) {
      return res.status(404).json({success: false, message: 'Voucher not found'});
    }

    const details = await db
      .select({
        id: voucherDetails.id,
        itemId: voucherDetails.itemId,
        itemName: items.name,
        unit: items.unit,
        qty: voucherDetails.qty,
        rate: voucherDetails.rate,
        subtotal: voucherDetails.subtotal,
        rejectedQty: voucherDetails.rejectedQty,
        rejectNote: voucherDetails.rejectNote,
      })
      .from(voucherDetails)
      .leftJoin(items, eq(voucherDetails.itemId, items.id))
      .where(eq(voucherDetails.voucherId, Number(id)));

    const [payout] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.voucherId, Number(id)));

    res.json({success: true, message: 'OK', data: {...voucher, details, payout: payout ?? null}});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────

export const createVoucher = async (req, res) => {
  const {memberId, details} = req.body;

  if (!memberId) {
    return res.status(400).json({success: false, message: 'memberId is required'});
  }
  if (!Array.isArray(details) || details.length === 0) {
    return res.status(400).json({success: false, message: 'details must be a non-empty array'});
  }
  for (const d of details) {
    if (!d.itemId || !d.qty || Number(d.qty) <= 0) {
      return res
        .status(400)
        .json({success: false, message: 'Each detail requires itemId and qty > 0'});
    }
  }

  try {
    // Validate member
    const [member] = await db
      .select({id: members.id})
      .from(members)
      .where(eq(members.id, Number(memberId)));
    if (!member) {
      return res.status(404).json({success: false, message: 'Member not found'});
    }

    // Fetch latest rate for each item
    const itemIds = [...new Set(details.map((d) => Number(d.itemId)))];
    const itemRows = await db.select().from(items).where(inArray(items.id, itemIds));
    const itemMap = Object.fromEntries(itemRows.map((i) => [i.id, i]));

    const rateRows = await Promise.all(
      itemIds.map((itemId) =>
        db
          .select()
          .from(itemRates)
          .where(eq(itemRates.itemId, itemId))
          .orderBy(desc(itemRates.createdAt))
          .limit(1)
          .then((r) => ({itemId, rate: r[0]?.rate ?? null}))
      )
    );
    const rateMap = Object.fromEntries(rateRows.map((r) => [r.itemId, r.rate]));

    // Validate all items exist and have rate
    for (const itemId of itemIds) {
      if (!itemMap[itemId]) {
        return res.status(404).json({success: false, message: `Item id ${itemId} not found`});
      }
      if (rateMap[itemId] === null) {
        return res.status(400).json({success: false, message: `Item id ${itemId} has no rate set`});
      }
    }

    // Build detail rows and totals
    const detailRows = details.map((d) => {
      const qty = Number(d.qty);
      const rate = rateMap[Number(d.itemId)];
      return {itemId: Number(d.itemId), qty, rate, subtotal: qty * rate};
    });
    const totalQty = detailRows.reduce((s, d) => s + d.qty, 0);
    const totalAmount = detailRows.reduce((s, d) => s + d.subtotal, 0);

    // Insert voucher + details (retry on code collision)
    let voucher;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        [voucher] = await db
          .insert(vouchers)
          .values({code, memberId: Number(memberId), totalQty, totalAmount})
          .returning();
        break;
      } catch (e) {
        if (e.code === '23505' && attempt < 4) continue; // unique violation, retry
        throw e;
      }
    }

    const insertedDetails = await db
      .insert(voucherDetails)
      .values(detailRows.map((d) => ({...d, voucherId: voucher.id})))
      .returning();

    res.status(201).json({
      success: true,
      message: 'Voucher created',
      data: {...voucher, details: insertedDetails},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

// ─── CLAIM ────────────────────────────────────────────────────────────────────
// Body opsional: array rejections [{voucherDetailId, rejectedQty, rejectNote}]

export const claimVoucher = async (req, res) => {
  const {id} = req.params;
  const {rejections} = req.body ?? {};

  try {
    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, Number(id)));

    if (!voucher) {
      return res.status(404).json({success: false, message: 'Voucher not found'});
    }
    if (voucher.status !== 'on_process') {
      return res
        .status(409)
        .json({success: false, message: `Voucher is already ${voucher.status}`});
    }

    // Apply rejections if any
    if (Array.isArray(rejections) && rejections.length > 0) {
      for (const r of rejections) {
        if (!r.voucherDetailId || r.rejectedQty === undefined) continue;
        const [detail] = await db
          .select()
          .from(voucherDetails)
          .where(eq(voucherDetails.id, Number(r.voucherDetailId)));

        if (!detail || detail.voucherId !== voucher.id) continue;
        if (Number(r.rejectedQty) > detail.qty) {
          return res.status(400).json({
            success: false,
            message: `rejectedQty cannot exceed qty (${detail.qty}) for detail id ${r.voucherDetailId}`,
          });
        }
        await db
          .update(voucherDetails)
          .set({
            rejectedQty: Number(r.rejectedQty),
            rejectNote: r.rejectNote ?? null,
          })
          .where(eq(voucherDetails.id, Number(r.voucherDetailId)));
      }
    }

    // Recalculate totalQty & totalAmount after rejections
    const allDetails = await db
      .select()
      .from(voucherDetails)
      .where(eq(voucherDetails.voucherId, Number(id)));

    const totalQty = allDetails.reduce((s, d) => s + (d.qty - (d.rejectedQty ?? 0)), 0);
    const totalAmount = allDetails.reduce((s, d) => s + (d.qty - (d.rejectedQty ?? 0)) * d.rate, 0);

    // Update voucher status
    const [updated] = await db
      .update(vouchers)
      .set({status: 'claimed', totalQty, totalAmount, completedAt: new Date()})
      .where(eq(vouchers.id, Number(id)))
      .returning();

    // Deduct stock for each detail (qty - rejectedQty)
    for (const detail of allDetails) {
      const effectiveQty = detail.qty - (detail.rejectedQty ?? 0);
      if (effectiveQty > 0) {
        await db.insert(itemStocks).values({
          itemId: detail.itemId,
          type: 'out',
          qty: effectiveQty,
          refType: 'voucher',
          refId: voucher.id,
          createdBy: req.user.userId,
        });
      }
    }

    res.json({success: true, message: 'Voucher claimed', data: {...updated, details: allDetails}});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

// ─── PAY ──────────────────────────────────────────────────────────────────────

export const payVoucher = async (req, res) => {
  const {id} = req.params;

  try {
    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, Number(id)));

    if (!voucher) {
      return res.status(404).json({success: false, message: 'Voucher not found'});
    }
    if (voucher.status !== 'claimed') {
      return res.status(409).json({
        success: false,
        message:
          voucher.status === 'paid'
            ? 'Voucher already paid'
            : 'Voucher must be claimed before payment',
      });
    }

    const [payout] = await db
      .insert(payouts)
      .values({voucherId: Number(id), amount: voucher.totalAmount})
      .returning();

    const [updated] = await db
      .update(vouchers)
      .set({status: 'paid'})
      .where(eq(vouchers.id, Number(id)))
      .returning();

    res.json({success: true, message: 'Voucher paid', data: {...updated, payout}});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const deleteVoucher = async (req, res) => {
  const {id} = req.params;

  try {
    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, Number(id)));

    if (!voucher) {
      return res.status(404).json({success: false, message: 'Voucher not found'});
    }
    if (voucher.status !== 'on_process') {
      return res.status(409).json({
        success: false,
        message: 'Only on_process vouchers can be deleted',
      });
    }

    await db.delete(voucherDetails).where(eq(voucherDetails.voucherId, Number(id)));
    await db.delete(vouchers).where(eq(vouchers.id, Number(id)));

    res.json({success: true, message: 'Voucher deleted'});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
