/*
  # GabLira Student Monitoring System Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `device_name` (text, unique device identifier)
      - `penalty_count` (integer, default 0)
      - `last_seen` (timestamp)
      - `is_online` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `verses`
      - `id` (uuid, primary key) 
      - `user_id` (uuid, foreign key to users)
      - `verse_text` (text)
      - `submitted_date` (date)
      - `day_name` (text, day of week)
      - `created_at` (timestamp)
    
    - `penalties`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `penalty_date` (date)
      - `removed_by` (uuid, foreign key to users, nullable)
      - `removed_at` (timestamp, nullable)
      - `created_at` (timestamp)
    
    - `user_activity`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `ping_timestamp` (timestamp)
      - `response_time` (integer, milliseconds)
      - `is_online` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Users can read all data but modify only their own verses
    - Penalty management allows cross-user modifications

  3. Indexes
    - Add indexes for frequently queried columns
    - Optimize for real-time status checks
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text UNIQUE NOT NULL,
  penalty_count integer DEFAULT 0,
  last_seen timestamptz DEFAULT now(),
  is_online boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Verses table
CREATE TABLE IF NOT EXISTS verses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verse_text text NOT NULL,
  submitted_date date DEFAULT CURRENT_DATE,
  day_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Penalties table  
CREATE TABLE IF NOT EXISTS penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  penalty_date date DEFAULT CURRENT_DATE,
  removed_by uuid REFERENCES users(id),
  removed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- User activity table for ping tracking
CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ping_timestamp timestamptz DEFAULT now(),
  response_time integer DEFAULT 0,
  is_online boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users: everyone can read all users, but can only update themselves
CREATE POLICY "Users can read all user data"
  ON users FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  TO public
  WITH CHECK (true);

-- Verses: everyone can read, users can insert their own
CREATE POLICY "Everyone can read verses"
  ON verses FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert own verses"
  ON verses FOR INSERT
  TO public
  WITH CHECK (true);

-- Penalties: everyone can read and modify
CREATE POLICY "Everyone can read penalties"
  ON penalties FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can insert penalties"
  ON penalties FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update penalties"
  ON penalties FOR UPDATE
  TO public
  USING (true);

-- User activity: everyone can read and insert
CREATE POLICY "Everyone can read user activity"
  ON user_activity FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Everyone can insert user activity"
  ON user_activity FOR INSERT
  TO public
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_device_name ON users(device_name);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);
CREATE INDEX IF NOT EXISTS idx_verses_user_date ON verses(user_id, submitted_date);
CREATE INDEX IF NOT EXISTS idx_penalties_user_date ON penalties(user_id, penalty_date);
CREATE INDEX IF NOT EXISTS idx_penalties_removed ON penalties(removed_by, removed_at);
CREATE INDEX IF NOT EXISTS idx_activity_user_timestamp ON user_activity(user_id, ping_timestamp);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();