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

    // ---- version history ------------------------------------------------------------
    // Snapshot the resume's current content (and its latest analysis score)
    async saveVersion(resume, label) {
        const score = Number(resume.analysisAnalysis?.score) || null;
        return versionToApi(await db.one(
            `INSERT INTO resume_versions (resume_id, user_id, label, content, score)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [resume._id, resume.user, String(label || '').trim().slice(0, 80), JSON.stringify(resume.content || {}),
                score === null ? null : Math.round(score)]
        ));
    },

    async listVersions(resumeId, userId) {
        if (!isId(resumeId)) return [];
        const rows = await db.query(
            'SELECT * FROM resume_versions WHERE resume_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50',
            [resumeId, userId]);
        return rows.map(versionToApi);
    },

    async findVersion(versionId, resumeId, userId) {
        if (!isId(versionId) || !isId(resumeId)) return null;
        return versionToApi(await db.one(
            'SELECT * FROM resume_versions WHERE id = $1 AND resume_id = $2 AND user_id = $3',
            [versionId, resumeId, userId]));
    },

    async deleteVersion(versionId, resumeId, userId) {
        if (!isId(versionId) || !isId(resumeId)) return false;
        const rows = await db.query(
            'DELETE FROM resume_versions WHERE id = $1 AND resume_id = $2 AND user_id = $3 RETURNING id',
            [versionId, resumeId, userId]);
        return rows.length > 0;
    },
};

const versionToApi = (row) => row && ({
    _id: row.id,
    resume: row.resume_id,
    label: row.label,
    content: row.content || {},
    score: row.score,
    skillCount: Array.isArray(row.content?.skills) ? row.content.skills.length : 0,
    createdAt: row.created_at,
});

module.exports = Resume;
