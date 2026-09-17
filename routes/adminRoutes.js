import express from 'express';
import { authenticateRole } from '../middleware/auth.js';
import { 
    addDoctor, 
    rescheduleAppointment, 
    getAllDoctors, 
    fetchUpcomingAppointment 
} from '../controllers/adminController.js';

const router = express.Router();

router.post('/doctors', authenticateRole(['admin']), addDoctor);
router.get('/doctors', getAllDoctors);
router.get('/upcoming-appointment', authenticateRole(['admin']), fetchUpcomingAppointment);
router.post('/reschedule', authenticateRole(['admin']), rescheduleAppointment);

export default router;
