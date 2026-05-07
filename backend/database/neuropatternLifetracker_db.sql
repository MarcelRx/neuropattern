-- 1. Enable UUID support (for secure, non-sequential IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE: Stores profile and login credentials
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT DEFAULT 'https://picsum.photos/100/100',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. LOGS TABLE: Stores voice check-ins and AI analysis results
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    mood VARCHAR(50),
    summary TEXT,
    sentiment VARCHAR(20), -- e.g., 'positive', 'neutral', 'negative'
    mood_image_url TEXT,   -- URL to AI-generated artwork
    audio_path TEXT        -- Path to the stored audio file
);

-- 4. HABITS TABLE: Stores habit progress and history
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),      -- Material Symbols icon name
    goal VARCHAR(100),     -- e.g., '20 mins'
    color VARCHAR(30),     -- e.g., 'primary', 'secondary'
    history JSONB DEFAULT '[]'::jsonb, -- Array of booleans: [true, false, true...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 5. INDEXES: Speed up data retrieval for the frontend
CREATE INDEX idx_logs_user ON logs(user_id);
CREATE INDEX idx_habits_user ON habits(user_id);
CREATE INDEX idx_users_email ON users(email);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);