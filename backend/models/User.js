// User model (PostgreSQL). Returns objects shaped like the old Mongoose documents (_id, camelCase).
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { isId, buildSet } = require('./helpers');

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say', ''];
const TIERS = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
const CATEGORIES = ['Software Engineering', 'Data Science', 'Design', 'Product Management', 'Marketing', 'Other'];

const COLUMNS = {
    name: { name: 'name' },
    phone: { name: 'phone' },
    gender: { name: 'gender' },
    age: { name: 'age' },
    profilePhoto: { name: 'profile_photo' },
    globalRankScore: { name: 'global_rank_score' },
    tier: { name: 'tier' },
    categoryTrack: { name: 'category_track' },
    leaderboardOptIn: { name: 'leaderboard_opt_in' },
    storedResumes: { name: 'stored_resumes', json: true },
    password: { name: 'password' },
    resetOtp: { name: 'reset_otp' },
    resetOtpExpires: { name: 'reset_otp_expires' },
};

// Public shape (never includes password / OTP)
const toPublic = (row) => row && ({
    _id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    gender: row.gender,
    age: row.age,
    profilePhoto: row.profile_photo,
    globalRankScore: row.global_rank_score,
    tier: row.tier,
    categoryTrack: row.category_track,
    leaderboardOptIn: row.leaderboard_opt_in,
    storedResumes: row.stored_resumes || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

// Internal shape (includes secrets; used by auth flows only)
const toInternal = (row) => row && ({
    ...toPublic(row),
    password: row.password,
    resetOtp: row.reset_otp,
    resetOtpExpires: row.reset_otp_expires,
});

const hash = async (plain) => bcrypt.hash(plain, await bcrypt.genSalt(10));
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Stored resume links keep an _id like Mongoose sub-documents did (the frontend uses it)
const withIds = (list) => (Array.isArray(list) ? list : [])
    .filter((r) => r && r.title && r.url)
    .map((r) => ({ _id: r._id || crypto.randomUUID(), title: String(r.title), url: String(r.url) }));

const User = {
    GENDERS, TIERS, CATEGORIES,

    async findById(id) {
        if (!isId(id)) return null;
        return toInternal(await db.one('SELECT * FROM users WHERE id = $1', [id]));
    },

    async findByEmail(email) {
        return toInternal(await db.one('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]));
    },

    async create({ name, email, password, ...rest }) {
        const row = await db.one(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
            [String(name).trim(), normalizeEmail(email), await hash(password)]
        );
        if (Object.keys(rest).length) return User.update(row.id, rest);
        return toInternal(row);
    },

    // Partial update. A plain-text `password` is hashed here.
    async update(id, fields) {
        if (!isId(id)) return null;
        const data = { ...fields };
        if (data.password) data.password = await hash(data.password);
        if (data.storedResumes !== undefined) data.storedResumes = withIds(data.storedResumes);
        const { sets, values } = buildSet(data, COLUMNS, 2);
        if (!sets.length) return User.findById(id);
        const row = await db.one(
            `UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return toInternal(row);
    },

    async addStoredResume(id, resume) {
        const row = await db.one(
            `UPDATE users SET stored_resumes = stored_resumes || $2::jsonb, updated_at = now()
             WHERE id = $1 RETURNING *`,
            [id, JSON.stringify(withIds([resume]))]
        );
        return toInternal(row);
    },

    matchPassword: (user, plain) => bcrypt.compare(String(plain), user.password),

    // Deletes the account; resumes, versions, jobs, interviews and uploaded files go with it (ON DELETE CASCADE)
    async delete(id) {
        if (!isId(id)) return false;
        const rows = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        return rows.length > 0;
    },

    async leaderboard(category) {
        const params = [];
        let where = 'leaderboard_opt_in AND global_rank_score > 0';
        if (category && category !== 'All') {
            params.push(category);
            where += ' AND category_track = $1';
        }
        const rows = await db.query(
            `SELECT id, name, profile_photo, global_rank_score, tier, category_track, updated_at
             FROM users WHERE ${where} ORDER BY global_rank_score DESC LIMIT 100`,
            params
        );
        return rows.map((r) => ({
            _id: r.id,
            name: r.name,
            profilePhoto: r.profile_photo,
            globalRankScore: r.global_rank_score,
            tier: r.tier,
            categoryTrack: r.category_track,
            updatedAt: r.updated_at,
        }));
    },

    toPublic,
};

module.exports = User;
