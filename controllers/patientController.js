// File: controllers/patientController.js
import pool from '../config/db.js';

export const createFamily = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { family_name } = req.body;
        const patient_id = req.user.id;

        await client.query('BEGIN');

        const familyRes = await client.query(
            `INSERT INTO families (family_name, created_by) VALUES ($1, $2) RETURNING *`,
            [family_name, patient_id]
        );

        const family = familyRes.rows[0];

        await client.query(`UPDATE patients SET family_id = $1 WHERE id = $2`, [family.id, patient_id]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Family created successfully', family });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

export const inviteFamilyMember = async (req, res, next) => {
    try {
        const { invitee_email } = req.body;
        const patient_id = req.user.id;

        const patRes = await pool.query(`SELECT family_id FROM patients WHERE id = $1`, [patient_id]);
        const family_id = patRes.rows[0]?.family_id;

        if (!family_id) {
            return res.status(400).json({ message: 'User must create a family unit prior to issuing invitations.' });
        }

        const inviteeRes = await pool.query(`SELECT id FROM patients WHERE email = $1`, [invitee_email]);
        if (inviteeRes.rows.length === 0) {
            return res.status(404).json({ message: 'Target email address is not registered in patient system.' });
        }

        const invitee_id = inviteeRes.rows[0].id;

        const invite = await pool.query(
            `INSERT INTO family_invites (family_id, invited_patient_id) VALUES ($1, $2) RETURNING *`,
            [family_id, invitee_id]
        );

        res.status(201).json({ message: 'Family invitation dispatched', invite: invite.rows[0] });
    } catch (error) {
        next(error);
    }
};

export const respondFamilyInvite = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { invite_id, action } = req.body; // action: 'accepted' or 'rejected'
        const patient_id = req.user.id;

        const inviteRes = await client.query(
            `SELECT * FROM family_invites WHERE id = $1 AND invited_patient_id = $2 AND status = 'pending'`,
            [invite_id, patient_id]
        );

        if (inviteRes.rows.length === 0) {
            return res.status(404).json({ message: 'Pending invitation record not found.' });
        }

        const invite = inviteRes.rows[0];

        await client.query('BEGIN');

        await client.query(`UPDATE family_invites SET status = $1 WHERE id = $2`, [action, invite_id]);

        if (action === 'accepted') {
            await client.query(`UPDATE patients SET family_id = $1 WHERE id = $2`, [invite.family_id, patient_id]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: `Invitation ${action} successfully.` });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

export const getFamilyMembers = async (req, res, next) => {
    try {
        const patient_id = req.user.id;
        const patRes = await pool.query(`SELECT family_id FROM patients WHERE id = $1`, [patient_id]);
        const family_id = patRes.rows[0]?.family_id;

        if (!family_id) {
            return res.status(200).json([]);
        }

        const members = await pool.query(
            `SELECT id, name, email FROM patients WHERE family_id = $1`,
            [family_id]
        );

        res.status(200).json(members.rows);
    } catch (error) {
        next(error);
    }
};

export const bookAppointment = async (req, res, next) => {
    try {
        const booked_by_patient_id = req.user.id;
        const { target_patient_id, doctor_id, appointment_date, start_time } = req.body;

        const patientToBook = target_patient_id || booked_by_patient_id;

        // Family membership verification
        if (target_patient_id && target_patient_id !== booked_by_patient_id) {
            const familyCheck = await pool.query(
                `SELECT p1.family_id 
                 FROM patients p1 
                 JOIN patients p2 ON p1.family_id = p2.family_id 
                 WHERE p1.id = $1 AND p2.id = $2 AND p1.family_id IS NOT NULL`,
                [booked_by_patient_id, target_patient_id]
            );
            if (familyCheck.rows.length === 0) {
                return res.status(403).json({ message: 'Unauthorized: Cannot book appointments for non-family members.' });
            }
        }

        // Calculate 30-minute window
        const [hours, mins] = start_time.split(':').map(Number);
        const startTimeObj = new Date();
        startTimeObj.setHours(hours, mins, 0, 0);
        const endTimeObj = new Date(startTimeObj.getTime() + 30 * 60000);
        const end_time = endTimeObj.toTimeString().split(' ')[0];

        // Doctor conflict validation
        const docCheck = await pool.query(
            `SELECT id FROM appointments 
             WHERE doctor_id = $1 AND appointment_date = $2 AND start_time = $3 
             AND status IN ('scheduled', 'rescheduled')`,
            [doctor_id, appointment_date, start_time]
        );
        if (docCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Conflict: Doctor is unavailable at the selected time slot.' });
        }

        // Patient conflict validation
        const patCheck = await pool.query(
            `SELECT id FROM appointments 
             WHERE patient_id = $1 AND appointment_date = $2 AND start_time = $3 
             AND status IN ('scheduled', 'rescheduled')`,
            [patientToBook, appointment_date, start_time]
        );
        if (patCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Conflict: Patient already has an active appointment at this time slot.' });
        }

        const newAppt = await pool.query(
            `INSERT INTO appointments (patient_id, doctor_id, booked_by_patient_id, appointment_date, start_time, end_time)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [patientToBook, doctor_id, booked_by_patient_id, appointment_date, start_time, end_time]
        );

        res.status(201).json({ message: 'Appointment booked successfully', appointment: newAppt.rows[0] });
    } catch (error) {
        next(error);
    }
};

export const getPatientAppointments = async (req, res, next) => {
    try {
        const patient_id = req.user.id;

        const result = await pool.query(
            `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status,
                    d.name AS doctor_name, d.speciality,
                    p.name AS patient_name,
                    pr.id AS prescription_id
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             JOIN patients p ON a.patient_id = p.id
             LEFT JOIN prescriptions pr ON a.id = pr.appointment_id
             WHERE a.patient_id = $1 OR a.patient_id IN (
                 SELECT id FROM patients WHERE family_id = (SELECT family_id FROM patients WHERE id = $1) AND family_id IS NOT NULL
             )
             ORDER BY a.appointment_date DESC, a.start_time DESC`,
            [patient_id]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};

export const cancelAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const patient_id = req.user.id;

        const apptRes = await pool.query(
            `SELECT * FROM appointments WHERE id = $1 AND (patient_id = $2 OR booked_by_patient_id = $2)`,
            [id, patient_id]
        );

        if (apptRes.rows.length === 0) {
            return res.status(404).json({ message: 'Appointment record not found or access unauthorized.' });
        }

        await pool.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [id]);

        res.status(200).json({ message: 'Appointment status updated to cancelled.' });
    } catch (error) {
        next(error);
    }
};
