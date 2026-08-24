import { Router } from 'express';
import { register, login, refresh, me } from '../controllers/auth';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', requireAuth, me);
export default router;
