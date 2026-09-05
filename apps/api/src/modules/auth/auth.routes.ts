import { Router } from 'express';
import { loginHandler, meHandler, logoutHandler } from './auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

export const authRouter = Router();

authRouter.post('/login', loginHandler);
authRouter.get('/me', authenticate, meHandler);
authRouter.post('/logout', logoutHandler);
