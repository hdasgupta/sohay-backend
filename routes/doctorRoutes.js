import express from 'express';
import { authenticateRole } from '../middleware/auth.js';
import { 
    getDoctorAppointments, 
    getTodaysAppointments, 
    searchMedicines, 
    generatePrescription, 
    getPrescriptionById 
} from '../controllers/doctorController.js';

const router = express.Router();

router.get('/appointments', authenticateRole(['doctor']), getDoctorAppointments);
router.get('/todays-appointments', authenticateRole(['doctor']), getTodaysAppointments);
router.get('/medicines/search', authenticateRole(['doctor']), searchMedicines);
router.post('/prescription/generate', authenticateRole(['doctor']), generatePrescription);
router.get('/prescription/:id', getPrescriptionById);

export default router;
