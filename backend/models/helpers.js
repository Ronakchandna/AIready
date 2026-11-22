// Small helpers shared by the Postgres models.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Invalid ids are treated as "not found" (Postgres would throw on a malformed uuid)
const isId = (id) => typeof id === 'string' && UUID_RE.test(id);

// Build "col1 = $2, col2 = $3" from { apiField: value } using a field -> column map
const buildSet = (fields, columns, startIndex = 1) => {
    const sets = [];
    const values = [];
    for (const [field, value] of Object.entries(fields)) {
        const column = columns[field];
        if (!column || value === undefined) continue;
        values.push(column.json ? JSON.stringify(value) : value);
        sets.push(`${column.name} = $${startIndex + values.length - 1}`);
    }
    return { sets, values };
};

module.exports = { isId, buildSet };
