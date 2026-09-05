import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as healthService from '../src/services/health.service.js';

describe('GET /api/v1/health', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 and health status when database is reachable', async () => {
    vi.spyOn(healthService, 'checkDatabaseHealth').mockResolvedValue(true);

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        status: 'ok',
        database: 'ok',
      },
      error: null,
    });
  });

  it('should return 503 and error object when database is unavailable', async () => {
    vi.spyOn(healthService, 'checkDatabaseHealth').mockResolvedValue(false);

    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      data: null,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable',
      },
    });
  });
});
