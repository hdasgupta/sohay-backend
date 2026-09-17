-- PostgreSQL Database Schema Definition for Neon Environment

-- Enable UUID extension for robust entity identification
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Domain Entity 1: System Administrators
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Domain Entity 2: Medical Doctors
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    speciality VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    signature_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Domain Entity 3: Registered Patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    family_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Domain Entity 4: Patient Family Units
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_name VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Foreign Key constraint linking patients back to families table
ALTER TABLE patients 
ADD CONSTRAINT fk_patient_family 
FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;

-- Domain Entity 5: Family Association Invitations
CREATE TABLE family_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    invited_patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Domain Entity 6: Doctor Weekly Availability Schedules
CREATE TABLE doctor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT check_valid_time_range CHECK (end_time > start_time)
);

-- Domain Entity 7: Patient-Doctor Appointments
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    booked_by_patient_id UUID NOT NULL REFERENCES patients(id),
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'rescheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_appointment_time_range CHECK (end_time > start_time)
);

-- Partial Unique Index: Guarantees zero schedule overlap for doctors across non-cancelled appointments
CREATE UNIQUE INDEX idx_unique_doctor_schedule_slot 
ON appointments (doctor_id, appointment_date, start_time) 
WHERE status IN ('scheduled', 'rescheduled');

-- Partial Unique Index: Guarantees zero schedule overlap for patients across non-cancelled appointments
CREATE UNIQUE INDEX idx_unique_patient_schedule_slot 
ON appointments (patient_id, appointment_date, start_time) 
WHERE status IN ('scheduled', 'rescheduled');

-- Domain Entity 8: Master Medicine Catalog
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL
);

-- Domain Entity 9: Medical Prescriptions Header
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    patient_age INT NOT NULL CHECK (patient_age > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Domain Entity 10: Medical Prescription Items Detail
CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_name VARCHAR(255) NOT NULL,
    dose VARCHAR(255) NOT NULL,
    condition_notes TEXT,
    take_morning BOOLEAN DEFAULT FALSE,
    take_afternoon BOOLEAN DEFAULT FALSE,
    take_evening BOOLEAN DEFAULT FALSE,
    take_night BOOLEAN DEFAULT FALSE,
    is_sos BOOLEAN DEFAULT FALSE,
    food_timing VARCHAR(50) CHECK (food_timing IN ('Before food', 'With food', 'After food'))
);

-- Seed Initial Medicine Master Records for Auto-Complete Search
INSERT INTO medicines (name, category) VALUES
('Amoxicillin 500mg Capsule', 'Capsule'),
('Paracetamol 650mg Tablet', 'Tablet'),
('Azithromycin 250mg Tablet', 'Tablet'),
('Cough Relief Active Syrup', 'Syrup'),
('Multivitamin B-Complex Syrup', 'Syrup'),
('Ibuprofen 400mg Tablet', 'Tablet');
