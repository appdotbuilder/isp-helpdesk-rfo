import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  updateUserInputSchema,
  loginInputSchema,
  userQuerySchema,
  createTicketInputSchema,
  updateTicketInputSchema,
  ticketQuerySchema,
  createCommentInputSchema,
  updateCommentInputSchema,
  createAttachmentInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { getUserById } from './handlers/get_user_by_id';
import { updateUser } from './handlers/update_user';
import { loginUser } from './handlers/login_user';
import { createTicket } from './handlers/create_ticket';
import { getTickets } from './handlers/get_tickets';
import { getTicketById } from './handlers/get_ticket_by_id';
import { updateTicket } from './handlers/update_ticket';
import { assignTicket } from './handlers/assign_ticket';
import { createComment } from './handlers/create_comment';
import { getTicketComments } from './handlers/get_ticket_comments';
import { updateComment } from './handlers/update_comment';
import { createAttachment } from './handlers/create_attachment';
import { getTicketAttachments } from './handlers/get_ticket_attachments';
import { deleteAttachment } from './handlers/delete_attachment';
import { getTicketStats } from './handlers/get_ticket_stats';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .input(userQuerySchema.optional())
    .query(({ input }) => getUsers(input)),

  getUserById: publicProcedure
    .input(z.number())
    .query(({ input }) => getUserById(input)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  loginUser: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // Ticket management routes
  createTicket: publicProcedure
    .input(createTicketInputSchema)
    .mutation(({ input }) => createTicket(input)),

  getTickets: publicProcedure
    .input(ticketQuerySchema.optional())
    .query(({ input }) => getTickets(input)),

  getTicketById: publicProcedure
    .input(z.number())
    .query(({ input }) => getTicketById(input)),

  updateTicket: publicProcedure
    .input(updateTicketInputSchema)
    .mutation(({ input }) => updateTicket(input)),

  assignTicket: publicProcedure
    .input(z.object({
      ticketId: z.number(),
      agentId: z.number()
    }))
    .mutation(({ input }) => assignTicket(input.ticketId, input.agentId)),

  // Comment management routes
  createComment: publicProcedure
    .input(createCommentInputSchema)
    .mutation(({ input }) => createComment(input)),

  getTicketComments: publicProcedure
    .input(z.object({
      ticketId: z.number(),
      includeInternal: z.boolean().default(false)
    }))
    .query(({ input }) => getTicketComments(input.ticketId, input.includeInternal)),

  updateComment: publicProcedure
    .input(updateCommentInputSchema)
    .mutation(({ input }) => updateComment(input)),

  // Attachment management routes
  createAttachment: publicProcedure
    .input(createAttachmentInputSchema)
    .mutation(({ input }) => createAttachment(input)),

  getTicketAttachments: publicProcedure
    .input(z.number())
    .query(({ input }) => getTicketAttachments(input)),

  deleteAttachment: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteAttachment(input)),

  // Statistics and reporting routes
  getTicketStats: publicProcedure
    .input(z.object({
      agentId: z.number().optional()
    }).optional())
    .query(({ input }) => getTicketStats(input?.agentId)),

  // Utility routes for dropdowns/enums
  getEnums: publicProcedure
    .query(() => ({
      userRoles: ['customer', 'agent', 'admin'],
      ticketCategories: ['network_outage', 'billing_issue', 'technical_support', 'service_upgrade', 'rfo'],
      ticketPriorities: ['low', 'medium', 'high', 'urgent'],
      ticketStatuses: ['open', 'in_progress', 'on_hold', 'resolved', 'closed']
    }))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`ISP Helpdesk TRPC server listening at port: ${port}`);
}

start();