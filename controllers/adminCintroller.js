// File: controllers/adminController.js
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export const addDoctor = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { name, speciality, email, password, confirmPassword, availability } = req.body;

        if (!name || !speciality || !email || !password || !confirmPassword || !availability) {
            return res.status(400).json({ message: 'All input parameters are mandatory.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Password and confirm password entries do not match.' });
        }

        if (!Array.isArray(availability) || availability.length === 0) {
            return res.status(400).json({ message: 'A doctor must have at least one availability time slot across the week.' });
        }

        await client.query('BEGIN');

        const hashedPassword = await bcrypt.hash(password, 10);
        const doctorInsertResult = await client.query(
            `INSERT INTO doctors (name, speciality, email, password_hash)
             VALUES ($1, $2, $3, $4) RETURNING id, name, email, speciality`,
            [name, speciality, email, hashedPassword]
        );

        const doctorId = doctorInsertResult.rows[0].id;

        for (const slot of availability) {
            // slot format: { day_of_week: 1, start_time: '09:00', end_time: '09:30' }
            await client.query(
                `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time)
                 VALUES ($1, $2, $3, $4)`,
                [doctorId, slot.day_of_week, slot.start_time, slot.end_time]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Doctor successfully onboarded', doctor: doctorInsertResult.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

export const fetchUpcomingAppointment = async (req, res, next) => {
    try {
        const { patient_id, doctor_id } = req.query;

        const apptQuery = await pool.query(
            `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status,
                    p.name AS patient_name, d.name AS doctor_name
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             JOIN doctors d ON a.doctor_id = d.id
             WHERE a.patient_id = $1 AND a.doctor_id = $2 AND a.status IN ('scheduled', 'rescheduled')
             AND (a.appointment_date > CURRENT_DATE OR (a.appointment_date = CURRENT_DATE AND a.start_time > CURRENT_TIME))
             ORDER BY a.appointment_date ASC, a.start_time ASC LIMIT 1`,
            [patient_id, doctor_id]
        );

        if (apptQuery.rows.length === 0) {
            return res.status(404).json({ message: 'No upcoming appointment available' });
        }

        res.status(200).json(apptQuery.rows[0]);
    } catch (error) {
        next(error);
    }
};

export const rescheduleAppointment = async (req, res, next) => {
    try {
        const { appointment_id, new_date, new_start_time } = req.body;

        const apptRes = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [appointment_id]);
        if (apptRes.rows.length === 0) {
            return res.status(404).json({ message: 'Target appointment record not found' });
        }

        const appt = apptRes.rows[0];

        // Compute 30-minute block window
        const [hours, mins] = new_start_time.split(':').map(Number);
        const startTimeObj = new Date();
        startTimeObj.setHours(hours, mins, 0, 0);
        const endTimeObj = new Date(startTimeObj.getTime() + 30 * 60000);
        const new_end_time = endTimeObj.toTimeString().split(' ')[0];

        // Doctor slot conflict check
        const docConflict = await pool.query(
            `SELECT id FROM appointments 
             WHERE doctor_id = $1 AND appointment_date = $2 AND start_time = $3 AND id != $4 
             AND status IN ('scheduled', 'rescheduled')`,
            [appt.doctor_id, new_date, new_start_time, appointment_id]
        );
        if (docConflict.rows.length > 0) {
            return res.status(409).json({ message: 'Schedule Conflict: Doctor is already assigned to an appointment at this time slot.' });
        }

        // Patient slot conflict check
        const patientConflict = await pool.query(
            `SELECT id FROM appointments 
             WHERE patient_id = $1 AND appointment_date = $2 AND start_time = $3 AND id != $4 
             AND status IN ('scheduled', 'rescheduled')`,
            [appt.patient_id, new_date, new_start_time, appointment_id]
        );
        if (patientConflict.rows.length > 0) {
            return res.status(409).json({ message: 'Schedule Conflict: Patient already has an appointment booked at this time slot.' });
        }

        const updateResult = await pool.query(
            `UPDATE appointments 
             SET appointment_date = $1, start_time = $2, end_time = $3, status = 'rescheduled'
             WHERE id = $4 RETURNING *`,
            [new_date, new_start_time, new_end_time, appointment_id]
        );

        res.status(200).json({ message: 'Appointment rescheduled successfully', appointment: updateResult.rows[0] });
    } catch (error) {
        next(error);
    }
};

export const getAllDoctors = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT d.id, d.name, d.speciality, d.email,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT('day', da.day_of_week, 'start', da.start_time, 'end', da.end_time)
                        ) FILTER (WHERE da.id IS NOT NULL), '[]'
                    ) AS availability
             FROM doctors d
             LEFT JOIN doctor_availability da ON d.id = da.doctor_id
             GROUP BY d.id
             ORDER BY d.name ASC`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};
