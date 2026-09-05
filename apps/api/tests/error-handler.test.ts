import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { AppError } from '../src/errors/app-error.js';
import { errorHandler } from '../src/errors/error-handler.js';

describe('Error Handling Middleware & Routing', () => {
  const app = createApp();

  it('should return 404 for unknown endpoints in standard response format', async () => {
    const response = await request(app).get('/api/v1/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource or endpoint not found',
      },
    });
  });

  it('should format AppError correctly', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/test-app-error', (_req, _res, next) => {
      next(new AppError(400, 'INVALID_INPUT', 'Field email is required', { field: 'email' }));
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-app-error');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      data: null,
      error: {
        code: 'INVALID_INPUT',
        message: 'Field email is required',
        details: { field: 'email' },
      },
    });
  });

  it('should format unexpected generic errors as 500 without leaking stack traces', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/test-500', (_req, _res, next) => {
      next(new Error('Internal database connection dropped unexpectedly'));
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-500');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      data: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('Internal database connection dropped');
  });
});
