import { Router } from 'express';
import { submitSymptomForm, getPreVisitSummary } from '../controllers/symptoms';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.post('/:appointmentId/symptoms', requireAuth, submitSymptomForm);
router.get('/:appointmentId/pre-visit', requireAuth, getPreVisitSummary);
export default router;
