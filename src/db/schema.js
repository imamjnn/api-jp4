import {pgTable, serial, text, timestamp, integer, pgEnum} from 'drizzle-orm/pg-core';

// ENUM
export const roleEnum = pgEnum('role', ['owner', 'admin', 'staff', 'worker', 'user']);

// USERS
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// CREDENTIALS
export const userCredentials = pgTable('user_credentials', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  role: roleEnum('role').default('user').notNull(),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  lastLoginUserAgent: text('last_login_user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
});

// SESSIONS
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// EXPENSE CATEGORIES
export const expenseCategories = pgTable('expense_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // bahan, jasa, operasional
});

// EXPENSES
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .references(() => expenseCategories.id)
    .notNull(),
  description: text('description'),
  totalAmount: integer('total_amount').notNull(),
  createdBy: integer('created_by').references(() => users.id),
  date: timestamp('date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdate(() => new Date()),
});

// EXPENSE DETAILS
export const expenseDetails = pgTable('expense_details', {
  id: serial('id').primaryKey(),
  expenseId: integer('expense_id')
    .references(() => expenses.id)
    .notNull(),
  name: text('name'), // kain katun, jasa potong
  qty: integer('qty'),
  price: integer('price'),
  subtotal: integer('subtotal'),
});

// ITEMS
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // lengan, badan, dll
  unit: text('unit').notNull(), // pcs
  createdAt: timestamp('created_at').defaultNow(),
});

// ITEM RATES
export const itemRates = pgTable('item_rates', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id')
    .references(() => items.id)
    .notNull(),
  rate: integer('rate').notNull(), // 2000 / pcs
  createdAt: timestamp('created_at').defaultNow(),
});

// ITEM STOCKS
export const itemStocks = pgTable('item_stocks', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id')
    .references(() => items.id)
    .notNull(),
  type: text('type', {enum: ['in', 'out']}).notNull(),
  qty: integer('qty').notNull(),
  note: text('note'),
  refType: text('ref_type'), // 'manual' | 'voucher'
  refId: integer('ref_id'), // voucherId jika refType = 'voucher'
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// MEMBERS
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow(),
});

// VOUCHERS
export const vouchers = pgTable('vouchers', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => members.id)
    .notNull(),
  status: text('status', {
    enum: ['on_process', 'claimed', 'paid'],
  }).default('on_process'),
  totalQty: integer('total_qty').default(0),
  totalAmount: integer('total_amount').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// VOUCHER DETAILS
export const voucherDetails = pgTable('voucher_details', {
  id: serial('id').primaryKey(),
  voucherId: integer('voucher_id')
    .references(() => vouchers.id)
    .notNull(),
  itemId: integer('item_id')
    .references(() => items.id)
    .notNull(),
  qty: integer('qty').notNull(),
  rate: integer('rate').notNull(), // snapshot
  subtotal: integer('subtotal').notNull(), // qty * rate
  rejectedQty: integer('rejected_qty').default(0),
  rejectNote: text('reject_note'),
});

// PAYOUTS
export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  voucherId: integer('voucher_id')
    .references(() => vouchers.id)
    .notNull()
    .unique(),
  amount: integer('amount').notNull(),
  paidAt: timestamp('paid_at').defaultNow(),
});
