import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { createSessionMiddleware } from './lib/session.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './errors/error-handler.js';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(createSessionMiddleware());

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
