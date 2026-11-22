// Resume model (PostgreSQL). `content` and `analysisAnalysis` are stored as JSONB.
const db = require('../db');
const { isId } = require('./helpers');

const toApi = (row) => row && ({
    _id: row.id,
    user: row.user_id,
    title: row.title,
    content: row.content || {},
    analysisAnalysis: row.analysis || { score: 0, missingKeywords: [] },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const Resume = {
    async findLatest(userId) {
        return toApi(await db.one(
            'SELECT * FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [userId]));
    },

    async findAllByUser(userId) {
        const rows = await db.query('SELECT * FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
        return rows.map(toApi);
    },

    async findOwned(id, userId) {
        if (!isId(id)) return null;
        return toApi(await db.one('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]));
    },

    async create(userId, { title, content }) {
        return toApi(await db.one(
            'INSERT INTO resumes (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, title || 'My Resume', JSON.stringify(content || {})]
        ));
    },

    async update(id, userId, { title, content }) {
        if (!isId(id)) return null;
        return toApi(await db.one(
            `UPDATE resumes SET title = COALESCE($3, title), content = $4, updated_at = now()
             WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId, title || null, JSON.stringify(content || {})]
        ));
    },

    async setAnalysis(id, analysis) {
        return toApi(await db.one(
            'UPDATE resumes SET analysis = $2, updated_at = now() WHERE id = $1 RETURNING *',
            [id, JSON.stringify(analysis)]
        ));
    },

    async deleteOwned(id, userId) {
        if (!isId(id)) return false;
        const rows = await db.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
        return rows.length > 0;
    },
};

module.exports = Resume;
