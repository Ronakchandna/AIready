// PostgreSQL (Supabase) connection + automatic schema setup.
const { Pool } = require('pg');

let client = null; // anything with query(text, params) -> { rows }

const connect = (url = process.env.DATABASE_URL) => {
    if (!url) throw new Error('DATABASE_URL is not set');
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const pool = new Pool({
        connectionString: url,
        ssl: isLocal ? false : { rejectUnauthorized: false }, // Supabase requires SSL
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
    });
    pool.on('error', (err) => console.error('Postgres pool error:', err.message));
    client = pool;
    return pool;
};

// Tests inject an in-memory Postgres (PGlite) here
const setClient = (c) => { client = c; };

const query = async (text, params = []) => {
    if (!client) throw new Error('Database not connected');
    const res = await client.query(text, params);
    return res.rows;
};

const one = async (text, params) => (await query(text, params))[0] || null;

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        password text NOT NULL,
        phone text NOT NULL DEFAULT '',
        gender text NOT NULL DEFAULT '',
        age integer,
        profile_photo text NOT NULL DEFAULT '',
        global_rank_score integer NOT NULL DEFAULT 0,
        tier text NOT NULL DEFAULT 'Unranked',
        category_track text NOT NULL DEFAULT 'Software Engineering',
        leaderboard_opt_in boolean NOT NULL DEFAULT false,
        stored_resumes jsonb NOT NULL DEFAULT '[]'::jsonb,
        reset_otp text,
        reset_otp_expires timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS resumes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title text NOT NULL DEFAULT 'My Resume',
        content jsonb NOT NULL DEFAULT '{}'::jsonb,
        analysis jsonb NOT NULL DEFAULT '{"score": 0, "missingKeywords": []}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS job_applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company text NOT NULL,
        role text NOT NULL,
        status text NOT NULL DEFAULT 'saved'
            CHECK (status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
        url text,
        location text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS interviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_role text NOT NULL,
        questions jsonb NOT NULL DEFAULT '[]'::jsonb,
        overall_score integer NOT NULL DEFAULT 0,
        overall_feedback text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    // Uploaded resume PDFs (max 5 MB each), served by GET /api/files/:id
    `CREATE TABLE IF NOT EXISTS files (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename text NOT NULL,
        mime_type text NOT NULL DEFAULT 'application/pdf',
        size integer NOT NULL,
        data bytea NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    )`,
    'CREATE INDEX IF NOT EXISTS files_user_idx ON files (user_id)',
    'CREATE INDEX IF NOT EXISTS resumes_user_idx ON resumes (user_id, updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS jobs_user_idx ON job_applications (user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS interviews_user_idx ON interviews (user_id, updated_at DESC)',
    'CREATE INDEX IF NOT EXISTS users_leaderboard_idx ON users (global_rank_score DESC) WHERE leaderboard_opt_in',
    // Supabase exposes the public schema over its REST API. RLS with no policies blocks that
    // path completely; this backend connects as the table owner and is not affected.
    'ALTER TABLE users ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE resumes ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE interviews ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE files ENABLE ROW LEVEL SECURITY',
];

const migrate = async () => {
    for (const statement of SCHEMA) await query(statement);
};

const ping = async () => {
    try {
        await query('SELECT 1');
        return true;
    } catch {
        return false;
    }
};

module.exports = { connect, setClient, query, one, migrate, ping };
