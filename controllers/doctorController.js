// File: controllers/doctorController.js
import pool from '../config/db.js';

export const getDoctorAppointments = async (req, res, next) => {
    try {
        const doctor_id = req.user.id;
        const result = await pool.query(
            `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status,
                    p.id AS patient_id, p.name AS patient_name, p.email AS patient_email
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             WHERE a.doctor_id = $1
             ORDER BY a.appointment_date DESC, a.start_time DESC`,
            [doctor_id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};

export const getTodaysAppointments = async (req, res, next) => {
    try {
        const doctor_id = req.user.id;
        const result = await pool.query(
            `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status,
                    p.id AS patient_id, p.name AS patient_name
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             WHERE a.doctor_id = $1 AND a.appointment_date = CURRENT_DATE AND a.status IN ('scheduled', 'rescheduled')
             ORDER BY a.start_time ASC`,
            [doctor_id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};

export const searchMedicines = async (req, res, next) => {
    try {
        const { query } = req.query;
        const result = await pool.query(
            `SELECT * FROM medicines WHERE name ILIKE $1 ORDER BY name ASC LIMIT 10`,
            [`%${query || ''}%`]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        next(error);
    }
};

export const generatePrescription = async (req, res, next) => {
    const client = await pool.connect();
    try {
        const doctor_id = req.user.id;
        const { appointment_id, patient_id, patient_age, items } = req.body;

        if (!appointment_id || !patient_id || !patient_age || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Missing mandatory prescription metadata or medicine line entries.' });
        }

        await client.query('BEGIN');

        const prescriptionRes = await client.query(
            `INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, patient_age)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [appointment_id, doctor_id, patient_id, patient_age]
        );

        const prescriptionId = prescriptionRes.rows[0].id;

        for (const item of items) {
            await client.query(
                `INSERT INTO prescription_items 
                 (prescription_id, medicine_name, dose, condition_notes, take_morning, take_afternoon, take_evening, take_night, is_sos, food_timing)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    prescriptionId,
                    item.medicine_name,
                    item.dose,
                    item.condition_notes || '',
                    item.take_morning || false,
                    item.take_afternoon || false,
                    item.take_evening || false,
                    item.take_night || false,
                    item.is_sos || false,
                    item.food_timing
                ]
            );
        }

        // Mark appointment status as completed
        await client.query(`UPDATE appointments SET status = 'completed' WHERE id = $1`, [appointment_id]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Prescription generated successfully', prescription_id: prescriptionId });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

export const getPrescriptionById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const headerRes = await pool.query(
            `SELECT pr.id, pr.patient_age, pr.created_at,
                    d.name AS doctor_name, d.speciality, d.signature_url,
                    p.name AS patient_name
             FROM prescriptions pr
             JOIN doctors d ON pr.doctor_id = d.id
             JOIN patients p ON pr.patient_id = p.id
             WHERE pr.id = $1`,
            [id]
        );

        if (headerRes.rows.length === 0) {
            return res.status(404).json({ message: 'Prescription document record not found.' });
        }

        const itemsRes = await pool.query(
            `SELECT * FROM prescription_items WHERE prescription_id = $1`,
            [id]
        );

        res.status(200).json({
            header: headerRes.rows[0],
            items: itemsRes.rows
        });
    } catch (error) {
        next(error);
    }
};
