// Mock interview model (PostgreSQL). `questions` is stored as JSONB.
const db = require('../db');

const toApi = (row) => row && ({
    _id: row.id,
    user: row.user_id,
    jobRole: row.job_role,
    questions: row.questions || [],
    overallScore: row.overall_score,
    overallFeedback: row.overall_feedback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

const Interview = {
    async create(userId, { jobRole, questions, overallScore, overallFeedback }) {
        return toApi(await db.one(
            `INSERT INTO interviews (user_id, job_role, questions, overall_score, overall_feedback)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, jobRole, JSON.stringify(questions || []), Math.round(Number(overallScore) || 0), overallFeedback || null]
        ));
    },

    async findAllByUser(userId) {
        const rows = await db.query('SELECT * FROM interviews WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
        return rows.map(toApi);
    },
};

module.exports = Interview;
