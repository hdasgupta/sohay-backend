import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticateRole } from './middleware/auth.js';
import { addDoctor, rescheduleAppointment, getAllDoctors, fetchUpcomingAppointment } from './controllers/adminController.js';
import { createFamily, inviteFamilyMember, respondFamilyInvite, getFamilyMembers, bookAppointment, getPatientAppointments, cancelAppointment } from './controllers/patientController.js';
import { getDoctorAppointments, getTodaysAppointments, searchMedicines, generatePrescription, getPrescriptionById } from './controllers/doctorController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Verification Check Endpoint
app.get('/health', (req, res) => res.status(200).json({ status: 'HEALTHY', timestamp: new Date() }));

// Administrative Endpoints
app.post('/api/admin/doctors', authenticateRole(['admin']), addDoctor);
app.get('/api/admin/doctors', getAllDoctors);
app.get('/api/admin/upcoming-appointment', authenticateRole(['admin']), fetchUpcomingAppointment);
app.post('/api/admin/reschedule', authenticateRole(['admin']), rescheduleAppointment);

// Patient Endpoints
app.post('/api/patient/family', authenticateRole(['patient']), createFamily);
app.post('/api/patient/family/invite', authenticateRole(['patient']), inviteFamilyMember);
app.post('/api/patient/family/respond', authenticateRole(['patient']), respondFamilyInvite);
app.get('/api/patient/family/members', authenticateRole(['patient']), getFamilyMembers);
app.post('/api/patient/appointments', authenticateRole(['patient']), bookAppointment);
app.get('/api/patient/appointments', authenticateRole(['patient']), getPatientAppointments);
app.patch('/api/patient/appointments/:id/cancel', authenticateRole(['patient']), cancelAppointment);

// Doctor Endpoints
app.get('/api/doctor/appointments', authenticateRole(['doctor']), getDoctorAppointments);
app.get('/api/doctor/todays-appointments', authenticateRole(['doctor']), getTodaysAppointments);
app.get('/api/doctor/medicines/search', authenticateRole(['doctor']), searchMedicines);
app.post('/api/doctor/prescription/generate', authenticateRole(['doctor']), generatePrescription);
app.get('/api/doctor/prescription/:id', getPrescriptionById);

// Centralized Runtime Error Interceptor
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Express engine listening on port ${PORT}`);
});
