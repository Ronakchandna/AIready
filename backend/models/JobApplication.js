// Job application model (PostgreSQL).
const db = require('../db');
const { isId, buildSet } = require('./helpers');

const STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected'];
const COLUMNS = {
    company: { name: 'company' },
    role: { name: 'role' },
    status: { name: 'status' },
    url: { name: 'url' },
    location: { name: 'location' },
    notes: { name: 'notes' },
};

const toApi = (row) => row && ({
    _id: row.id,
    user: row.user_id,
    company: row.company,
    role: row.role,
    status: row.status,
    url: row.url,
    location: row.location,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const trim = (v) => (typeof v === 'string' ? v.trim() : v);

const JobApplication = {
    STATUSES,

    async create(userId, { company, role, status, url, location, notes }) {
        return toApi(await db.one(
            `INSERT INTO job_applications (user_id, company, role, status, url, location, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, trim(company), trim(role), status || 'saved', trim(url) || null, trim(location) || null, notes || null]
        ));
    },

    async findAllByUser(userId) {
        const rows = await db.query(
            'SELECT * FROM job_applications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return rows.map(toApi);
    },

    async findById(id) {
        if (!isId(id)) return null;
        return toApi(await db.one('SELECT * FROM job_applications WHERE id = $1', [id]));
    },

    async update(id, fields) {
        const clean = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, trim(v)]));
        const { sets, values } = buildSet(clean, COLUMNS, 2);
        if (!sets.length) return JobApplication.findById(id);
        return toApi(await db.one(
            `UPDATE job_applications SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
            [id, ...values]
        ));
    },

    async delete(id) {
        await db.query('DELETE FROM job_applications WHERE id = $1', [id]);
    },
};

module.exports = JobApplication;
