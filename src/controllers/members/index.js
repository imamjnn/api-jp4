import {db} from '../../db';
import {members, vouchers} from '../../db/schema';
import {eq, ne, and, count, ilike, or} from 'drizzle-orm';

export const getMembers = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;
  const {search} = req.query;

  const where = search
    ? or(ilike(members.name, `%${search}%`), ilike(members.phone, `%${search}%`))
    : undefined;

  try {
    const [totalResult, rows] = await Promise.all([
      db.select({total: count()}).from(members).where(where),
      db.select().from(members).where(where).orderBy(members.name).limit(limit).offset(offset),
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

export const getMemberById = async (req, res) => {
  const {id} = req.params;

  try {
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.id, Number(id)));

    if (!member) {
      return res.status(404).json({success: false, message: 'Member not found'});
    }

    res.json({success: true, message: 'OK', data: member});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const createMember = async (req, res) => {
  const {name, phone, address} = req.body;

  if (!name) {
    return res.status(400).json({success: false, message: 'name is required'});
  }

  try {
    const [duplicate] = await db
      .select({id: members.id})
      .from(members)
      .where(ilike(members.name, name));

    if (duplicate) {
      return res
        .status(409)
        .json({success: false, message: 'Member with the same name already exists'});
    }

    const [member] = await db.insert(members).values({name, phone, address}).returning();
    res.status(201).json({success: true, message: 'Member created', data: member});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const updateMember = async (req, res) => {
  const {id} = req.params;
  const {name, phone, address} = req.body;

  if (!name && phone === undefined && address === undefined) {
    return res.status(400).json({success: false, message: 'At least one field is required'});
  }

  try {
    const [existing] = await db
      .select()
      .from(members)
      .where(eq(members.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Member not found'});
    }

    if (name) {
      const [duplicate] = await db
        .select({id: members.id})
        .from(members)
        .where(and(ilike(members.name, name), ne(members.id, Number(id))));

      if (duplicate) {
        return res
          .status(409)
          .json({success: false, message: 'Member with the same name already exists'});
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    const [updated] = await db
      .update(members)
      .set(updateData)
      .where(eq(members.id, Number(id)))
      .returning();

    res.json({success: true, message: 'Member updated', data: updated});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const deleteMember = async (req, res) => {
  const {id} = req.params;

  try {
    const [existing] = await db
      .select()
      .from(members)
      .where(eq(members.id, Number(id)));

    if (!existing) {
      return res.status(404).json({success: false, message: 'Member not found'});
    }

    const [used] = await db
      .select({total: count()})
      .from(vouchers)
      .where(eq(vouchers.memberId, Number(id)));

    if (Number(used.total) > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: member has ${used.total} voucher(s)`,
      });
    }

    await db.delete(members).where(eq(members.id, Number(id)));
    res.json({success: true, message: 'Member deleted'});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
