import { Router } from 'express';
import { initiateOAuth, oauthCallback, getCalendarStatus } from '../controllers/calendar';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.get('/auth', requireAuth, initiateOAuth);
router.get('/oauth/callback', oauthCallback);
router.get('/status', requireAuth, getCalendarStatus);
export default router;
