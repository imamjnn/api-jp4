import {db} from '../../db';
import {
  vouchers,
  voucherDetails,
  payouts,
  expenses,
  expenseCategories,
  members,
  items,
} from '../../db/schema';
import {eq, sum, count, and, gte, lte, sql} from 'drizzle-orm';

const buildDateRange = (period, dateFrom, dateTo) => {
  const now = new Date();
  let from, to;

  if (period === 'daily') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = now.getDay();
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
    if (dateFrom) from = new Date(dateFrom);
    if (dateTo) {
      to = new Date(dateTo);
      if (!isNaN(to)) to.setHours(23, 59, 59, 999);
    }
  }

  return {from, to};
};

export const getReportSummary = async (req, res) => {
  const {period, dateFrom, dateTo} = req.query;

  const {from, to} = buildDateRange(period, dateFrom, dateTo);

  if (dateFrom && from && isNaN(from))
    return res.status(400).json({success: false, message: 'Invalid dateFrom format'});
  if (dateTo && to && isNaN(to))
    return res.status(400).json({success: false, message: 'Invalid dateTo format'});

  // Filter berdasarkan vouchers.createdAt
  const voucherFilters = [];
  if (from) voucherFilters.push(gte(vouchers.createdAt, from));
  if (to) voucherFilters.push(lte(vouchers.createdAt, to));
  const voucherWhere = voucherFilters.length > 0 ? and(...voucherFilters) : undefined;

  // Filter berdasarkan expenses.date
  const expenseFilters = [];
  if (from) expenseFilters.push(gte(expenses.date, from));
  if (to) expenseFilters.push(lte(expenses.date, to));
  const expenseWhere = expenseFilters.length > 0 ? and(...expenseFilters) : undefined;

  // Filter berdasarkan payouts.paidAt
  const payoutFilters = [];
  if (from) payoutFilters.push(gte(payouts.paidAt, from));
  if (to) payoutFilters.push(lte(payouts.paidAt, to));
  const payoutWhere = payoutFilters.length > 0 ? and(...payoutFilters) : undefined;

  try {
    const [
      voucherTotals,
      voucherByStatus,
      expenseTotals,
      expenseByCategory,
      payoutTotals,
      totalMembers,
      totalItems,
      productionByItem,
    ] = await Promise.all([
      // Total voucher keseluruhan
      db
        .select({
          totalVouchers: count(vouchers.id),
          totalQty: sum(vouchers.totalQty),
          totalAmount: sum(vouchers.totalAmount),
        })
        .from(vouchers)
        .where(voucherWhere),

      // Voucher per status
      db
        .select({
          status: vouchers.status,
          total: count(vouchers.id),
          totalQty: sum(vouchers.totalQty),
          totalAmount: sum(vouchers.totalAmount),
        })
        .from(vouchers)
        .where(voucherWhere)
        .groupBy(vouchers.status),

      // Total pengeluaran
      db
        .select({
          totalAmount: sum(expenses.totalAmount),
          totalTransactions: count(expenses.id),
        })
        .from(expenses)
        .where(expenseWhere),

      // Pengeluaran per kategori
      db
        .select({
          categoryId: expenseCategories.id,
          categoryName: expenseCategories.name,
          totalAmount: sum(expenses.totalAmount),
          totalTransactions: count(expenses.id),
        })
        .from(expenses)
        .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(expenseWhere)
        .groupBy(expenseCategories.id, expenseCategories.name)
        .orderBy(sql`sum(${expenses.totalAmount}) desc`),

      // Total payout (pemasukan)
      db
        .select({
          totalPayout: sum(payouts.amount),
          totalPayoutCount: count(payouts.id),
        })
        .from(payouts)
        .where(payoutWhere),

      // Total anggota
      db.select({total: count(members.id)}).from(members),

      // Total item
      db.select({total: count(items.id)}).from(items),

      // Produksi per item (dari voucherDetails → vouchers)
      db
        .select({
          itemId: items.id,
          itemName: items.name,
          unit: items.unit,
          totalQty: sum(voucherDetails.qty),
          totalRejected: sum(voucherDetails.rejectedQty),
          totalSubtotal: sum(voucherDetails.subtotal),
        })
        .from(voucherDetails)
        .leftJoin(vouchers, eq(voucherDetails.voucherId, vouchers.id))
        .leftJoin(items, eq(voucherDetails.itemId, items.id))
        .where(voucherWhere)
        .groupBy(items.id, items.name, items.unit)
        .orderBy(sql`sum(${voucherDetails.qty}) desc`),
    ]);

    const totalRevenue = Number(payoutTotals[0]?.totalPayout ?? 0);
    const totalExpense = Number(expenseTotals[0]?.totalAmount ?? 0);
    const netProfit = totalRevenue - totalExpense;

    res.json({
      success: true,
      message: 'OK',
      data: {
        period: period || 'custom',
        dateFrom: from ?? null,
        dateTo: to ?? null,

        vouchers: {
          total: Number(voucherTotals[0]?.totalVouchers ?? 0),
          totalQty: Number(voucherTotals[0]?.totalQty ?? 0),
          totalAmount: Number(voucherTotals[0]?.totalAmount ?? 0),
          byStatus: voucherByStatus.map((s) => ({
            status: s.status,
            total: Number(s.total),
            totalQty: Number(s.totalQty ?? 0),
            totalAmount: Number(s.totalAmount ?? 0),
          })),
        },

        revenue: {
          total: totalRevenue,
          totalTransactions: Number(payoutTotals[0]?.totalPayoutCount ?? 0),
        },

        expenses: {
          total: totalExpense,
          totalTransactions: Number(expenseTotals[0]?.totalTransactions ?? 0),
          byCategory: expenseByCategory.map((c) => ({
            categoryId: c.categoryId,
            categoryName: c.categoryName,
            totalAmount: Number(c.totalAmount ?? 0),
            totalTransactions: Number(c.totalTransactions),
          })),
        },

        netProfit,

        members: {
          total: Number(totalMembers[0]?.total ?? 0),
        },

        items: {
          total: Number(totalItems[0]?.total ?? 0),
        },

        production: productionByItem.map((p) => ({
          itemId: p.itemId,
          itemName: p.itemName,
          unit: p.unit,
          totalQty: Number(p.totalQty ?? 0),
          totalRejected: Number(p.totalRejected ?? 0),
          totalSubtotal: Number(p.totalSubtotal ?? 0),
        })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
