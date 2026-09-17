import express from 'express';
import { authenticateRole } from '../middleware/auth.js';
import { 
    createFamily, 
    inviteFamilyMember, 
    respondFamilyInvite, 
    getFamilyMembers, 
    bookAppointment, 
    getPatientAppointments, 
    cancelAppointment 
} from '../controllers/patientController.js';

const router = express.Router();

router.post('/family', authenticateRole(['patient']), createFamily);
router.post('/family/invite', authenticateRole(['patient']), inviteFamilyMember);
router.post('/family/respond', authenticateRole(['patient']), respondFamilyInvite);
router.get('/family/members', authenticateRole(['patient']), getFamilyMembers);
router.post('/appointments', authenticateRole(['patient']), bookAppointment);
router.get('/appointments', authenticateRole(['patient']), getPatientAppointments);
router.patch('/appointments/:id/cancel', authenticateRole(['patient']), cancelAppointment);

export default router;
