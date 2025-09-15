import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  integer, 
  pgEnum, 
  jsonb, 
  boolean,
  bigint
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['customer', 'agent', 'admin']);
export const ticketCategoryEnum = pgEnum('ticket_category', [
  'network_outage',
  'billing_issue',
  'technical_support', 
  'service_upgrade',
  'rfo'
]);
export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'urgent']);
export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'on_hold', 
  'resolved',
  'closed'
]);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Tickets table
export const ticketsTable = pgTable('tickets', {
  id: serial('id').primaryKey(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  category: ticketCategoryEnum('category').notNull(),
  priority: ticketPriorityEnum('priority').notNull(),
  status: ticketStatusEnum('status').notNull().default('open'),
  customer_id: integer('customer_id').notNull().references(() => usersTable.id),
  assigned_agent_id: integer('assigned_agent_id').references(() => usersTable.id),
  rfo_details: jsonb('rfo_details'), // Nullable JSONB for RFO-specific data
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  resolved_at: timestamp('resolved_at') // Nullable timestamp for resolution time
});

// Comments table
export const commentsTable = pgTable('comments', {
  id: serial('id').primaryKey(),
  ticket_id: integer('ticket_id').notNull().references(() => ticketsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  is_internal: boolean('is_internal').notNull().default(false), // Internal notes for agents only
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Attachments table
export const attachmentsTable = pgTable('attachments', {
  id: serial('id').primaryKey(),
  ticket_id: integer('ticket_id').notNull().references(() => ticketsTable.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  file_path: text('file_path').notNull(),
  file_size: bigint('file_size', { mode: 'number' }).notNull(),
  mime_type: text('mime_type').notNull(),
  uploaded_by: integer('uploaded_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdTickets: many(ticketsTable, { relationName: 'customer' }),
  assignedTickets: many(ticketsTable, { relationName: 'assignedAgent' }),
  comments: many(commentsTable),
  attachments: many(attachmentsTable)
}));

export const ticketsRelations = relations(ticketsTable, ({ one, many }) => ({
  customer: one(usersTable, {
    fields: [ticketsTable.customer_id],
    references: [usersTable.id],
    relationName: 'customer'
  }),
  assignedAgent: one(usersTable, {
    fields: [ticketsTable.assigned_agent_id],
    references: [usersTable.id],
    relationName: 'assignedAgent'
  }),
  comments: many(commentsTable),
  attachments: many(attachmentsTable)
}));

export const commentsRelations = relations(commentsTable, ({ one }) => ({
  ticket: one(ticketsTable, {
    fields: [commentsTable.ticket_id],
    references: [ticketsTable.id]
  }),
  user: one(usersTable, {
    fields: [commentsTable.user_id],
    references: [usersTable.id]
  })
}));

export const attachmentsRelations = relations(attachmentsTable, ({ one }) => ({
  ticket: one(ticketsTable, {
    fields: [attachmentsTable.ticket_id],
    references: [ticketsTable.id]
  }),
  uploadedBy: one(usersTable, {
    fields: [attachmentsTable.uploaded_by],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Ticket = typeof ticketsTable.$inferSelect;
export type NewTicket = typeof ticketsTable.$inferInsert;

export type Comment = typeof commentsTable.$inferSelect;
export type NewComment = typeof commentsTable.$inferInsert;

export type Attachment = typeof attachmentsTable.$inferSelect;
export type NewAttachment = typeof attachmentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  tickets: ticketsTable,
  comments: commentsTable,
  attachments: attachmentsTable
};

export const tableRelations = {
  usersRelations,
  ticketsRelations,
  commentsRelations,
  attachmentsRelations
};