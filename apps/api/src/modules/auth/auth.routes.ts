import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

export const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/logout', authController.logout);
