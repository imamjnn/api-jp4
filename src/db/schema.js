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
