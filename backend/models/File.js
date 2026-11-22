// Uploaded PDF files stored in Postgres (bytea). Small (<= 5 MB) and few per user,
// so this avoids depending on an external storage service.
const db = require('../db');
const { isId } = require('./helpers');

const create = async (userId, { filename, mimeType, buffer }) =>
    db.one(
        `INSERT INTO files (user_id, filename, mime_type, size, data)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, filename, size`,
        [userId, filename, mimeType || 'application/pdf', buffer.length, buffer]
    );

const findById = async (id) =>
    isId(id) ? db.one('SELECT id, user_id, filename, mime_type, data FROM files WHERE id = $1', [id]) : null;

const deleteOwned = async (id, userId) => {
    if (!isId(id)) return;
    await db.query('DELETE FROM files WHERE id = $1 AND user_id = $2', [id, userId]);
};

// Pull the file id out of a URL produced by fileUrl() below
const idFromUrl = (url) => {
    const m = /\/api\/files\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(url || '');
    return m ? m[1] : null;
};

module.exports = { create, findById, deleteOwned, idFromUrl };
