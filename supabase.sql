-- ============================================================================
-- BloodConnect – Blood Donation Network
-- Database Schema & Row Level Security (RLS) Setup for Supabase (PostgreSQL)
-- Developed by Noeline Gaikwad
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean up existing tables if re-running script (in proper dependency order)
DROP TABLE IF EXISTS request_responses CASCADE;
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS blood_requests CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 3. PROFILES Table
-- Stores user profile, blood group, contact, role, and donor availability
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    location TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'donor' CHECK (role IN ('donor', 'admin')),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for rapid donor search by blood group and location
CREATE INDEX idx_profiles_blood_location ON profiles (blood_group, location);
CREATE INDEX idx_profiles_available ON profiles (is_available);

-- 4. BLOOD REQUESTS Table
-- Stores blood donation requests submitted by patients or hospitals
CREATE TABLE blood_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    units_required INTEGER NOT NULL DEFAULT 1 CHECK (units_required > 0),
    hospital TEXT NOT NULL,
    location TEXT NOT NULL,
    required_date DATE NOT NULL,
    notes TEXT,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'fulfilled', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_blood_requests_status ON blood_requests (status);
CREATE INDEX idx_blood_requests_blood_group ON blood_requests (blood_group);
CREATE INDEX idx_blood_requests_priority ON blood_requests (priority);

-- 5. REQUEST RESPONSES Table
-- Tracks voluntary donor responses ("I Can Help") for verified requests
CREATE TABLE request_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- Prevent duplicate responses by the same donor for the same request
    CONSTRAINT unique_request_donor UNIQUE (request_id, donor_id)
);

CREATE INDEX idx_request_responses_request ON request_responses (request_id);
CREATE INDEX idx_request_responses_donor ON request_responses (donor_id);

-- 6. DONATIONS Table
-- Tracks completed blood donations by donors
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_donations_donor ON donations (donor_id);

-- ============================================================================
-- 7. SECURE DATABASE HELPER FUNCTIONS
-- ============================================================================

-- Check current authenticated user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM profiles WHERE id = auth.uid()), FALSE);
$$;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------

-- Public read: Anyone (authenticated or anonymous) can view donor profiles for search
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

-- Users can insert their own profile on signup
CREATE POLICY "Users can create their own profile" 
ON profiles FOR INSERT 
WITH CHECK (
    auth.uid() = id AND 
    (role = 'donor' OR is_admin())
);

-- Users can update their own profile (cannot change role unless admin)
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (
    auth.uid() = id OR is_admin()
)
WITH CHECK (
    (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid())) 
    OR is_admin()
);

-- ----------------------------------------------------------------------------
-- BLOOD REQUESTS POLICIES
-- ----------------------------------------------------------------------------

-- Public can view verified or fulfilled requests; requesters & admins can view all
CREATE POLICY "Public can view verified requests" 
ON blood_requests FOR SELECT 
USING (
    status IN ('verified', 'fulfilled') 
    OR requester_id = auth.uid() 
    OR is_admin()
);

-- Authenticated users can create blood requests (initial status must be 'pending')
CREATE POLICY "Authenticated users can create blood requests" 
ON blood_requests FOR INSERT 
WITH CHECK (
    auth.uid() = requester_id 
    AND (status = 'pending' OR is_admin())
);

-- Requesters can update their own pending requests, or admins can update any
CREATE POLICY "Requesters and admins can update requests" 
ON blood_requests FOR UPDATE 
USING (
    requester_id = auth.uid() OR is_admin()
);

-- Admins or requesters can delete requests
CREATE POLICY "Admins or requesters can delete requests" 
ON blood_requests FOR DELETE 
USING (
    requester_id = auth.uid() OR is_admin()
);

-- ----------------------------------------------------------------------------
-- REQUEST RESPONSES POLICIES
-- ----------------------------------------------------------------------------

-- Donors, Requesters, and Admins can view responses
CREATE POLICY "View responses" 
ON request_responses FOR SELECT 
USING (
    donor_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM blood_requests 
        WHERE blood_requests.id = request_responses.request_id 
        AND blood_requests.requester_id = auth.uid()
    ) 
    OR is_admin()
);

-- Authenticated donors can respond to verified requests
CREATE POLICY "Donors can respond to requests" 
ON request_responses FOR INSERT 
WITH CHECK (
    auth.uid() = donor_id 
    AND EXISTS (
        SELECT 1 FROM blood_requests 
        WHERE blood_requests.id = request_id 
        AND (blood_requests.status = 'verified' OR is_admin())
    )
);

-- Donors or admins can update response status
CREATE POLICY "Donors or admins can update responses" 
ON request_responses FOR UPDATE 
USING (
    donor_id = auth.uid() OR is_admin()
);

-- ----------------------------------------------------------------------------
-- DONATIONS POLICIES
-- ----------------------------------------------------------------------------

-- Users can view their own donation history, admins can view all
CREATE POLICY "Users can view own donations" 
ON donations FOR SELECT 
USING (
    donor_id = auth.uid() OR is_admin()
);

-- Donors can record their own donation, admins can record for anyone
CREATE POLICY "Donors and admins can record donations" 
ON donations FOR INSERT 
WITH CHECK (
    donor_id = auth.uid() OR is_admin()
);

-- ============================================================================
-- 9. AUTHENTICATION TRIGGER
-- Automatically creates a profile when a new user registers via Supabase Auth
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, blood_group, location, role, is_available)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Volunteer Donor'),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'blood_group', 'O+'),
    COALESCE(NEW.raw_user_meta_data->>'location', 'City General'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'donor'),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- 10. OPTIONAL SEED DATA (For development & demo demonstration)
-- Note: Replace UUIDs with actual auth user IDs when testing real auth accounts.
-- ============================================================================
-- To make a user an admin, run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your_admin_email@example.com';
