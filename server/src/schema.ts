import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['customer', 'agent', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Ticket category enum
export const ticketCategorySchema = z.enum([
  'network_outage',
  'billing_issue', 
  'technical_support',
  'service_upgrade',
  'rfo'
]);
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

// Ticket priority enum
export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

// Ticket status enum
export const ticketStatusSchema = z.enum([
  'open',
  'in_progress', 
  'on_hold',
  'resolved',
  'closed'
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

// RFO Details schema for JSONB field
export const rfoDetailsSchema = z.object({
  outage_type: z.enum(['planned', 'unplanned']).optional(),
  affected_areas: z.array(z.string()).optional(),
  estimated_duration: z.string().optional(),
  services_affected: z.array(z.string()).optional(),
  root_cause: z.string().optional(),
  resolution_steps: z.string().optional()
}).nullable();

export type RfoDetails = z.infer<typeof rfoDetailsSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Input schema for creating users
export const createUserInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Input schema for updating users
export const updateUserInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: userRoleSchema.optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// User login schema
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Ticket schema
export const ticketSchema = z.object({
  id: z.number(),
  subject: z.string(),
  description: z.string(),
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  customer_id: z.number(),
  assigned_agent_id: z.number().nullable(),
  rfo_details: rfoDetailsSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  resolved_at: z.coerce.date().nullable()
});

export type Ticket = z.infer<typeof ticketSchema>;

// Input schema for creating tickets
export const createTicketInputSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  customer_id: z.number(),
  rfo_details: rfoDetailsSchema.optional()
});

export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;

// Input schema for updating tickets
export const updateTicketInputSchema = z.object({
  id: z.number(),
  subject: z.string().min(1).optional(),
  description: z.string().optional(),
  category: ticketCategorySchema.optional(),
  priority: ticketPrioritySchema.optional(),
  status: ticketStatusSchema.optional(),
  assigned_agent_id: z.number().nullable().optional(),
  rfo_details: rfoDetailsSchema.optional()
});

export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;

// Comment schema
export const commentSchema = z.object({
  id: z.number(),
  ticket_id: z.number(),
  user_id: z.number(),
  content: z.string(),
  is_internal: z.boolean(), // Internal notes only visible to agents
  created_at: z.coerce.date()
});

export type Comment = z.infer<typeof commentSchema>;

// Input schema for creating comments
export const createCommentInputSchema = z.object({
  ticket_id: z.number(),
  user_id: z.number(),
  content: z.string().min(1, 'Comment content is required'),
  is_internal: z.boolean().default(false)
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;

// Input schema for updating comments
export const updateCommentInputSchema = z.object({
  id: z.number(),
  content: z.string().min(1).optional(),
  is_internal: z.boolean().optional()
});

export type UpdateCommentInput = z.infer<typeof updateCommentInputSchema>;

// Attachment schema
export const attachmentSchema = z.object({
  id: z.number(),
  ticket_id: z.number(),
  filename: z.string(),
  file_path: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  uploaded_by: z.number(),
  created_at: z.coerce.date()
});

export type Attachment = z.infer<typeof attachmentSchema>;

// Input schema for creating attachments
export const createAttachmentInputSchema = z.object({
  ticket_id: z.number(),
  filename: z.string(),
  file_path: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  uploaded_by: z.number()
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentInputSchema>;

// Query schemas for filtering and pagination
export const ticketQuerySchema = z.object({
  customer_id: z.number().optional(),
  assigned_agent_id: z.number().optional(),
  status: ticketStatusSchema.optional(),
  category: ticketCategorySchema.optional(),
  priority: ticketPrioritySchema.optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0)
});

export type TicketQuery = z.infer<typeof ticketQuerySchema>;

export const userQuerySchema = z.object({
  role: userRoleSchema.optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0)
});

export type UserQuery = z.infer<typeof userQuerySchema>;