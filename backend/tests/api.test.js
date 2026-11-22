// End-to-end API tests against a real (in-memory) PostgreSQL engine.  Run: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_MAX = '100000';

const db = require('../db');
const User = require('../models/User');

let server;
let base;

before(async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const pg = new PGlite();
    db.setClient({ query: (text, params) => pg.query(text, params) });
    await db.migrate();
    await db.migrate(); // must be idempotent (runs on every boot)
    const app = require('../app');
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server && server.close());

const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
        method,
        headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
};

const register = async (email, password = 'secret123', name = 'Test User') => {
    const r = await call('POST', '/auth/register', { name, email, password });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data;
};

test('health check reports the database', async () => {
    const r = await call('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.db, 'connected');
});

test('register, duplicate, validation and login', async () => {
    const u = await register('Jane@Example.com');
    assert.ok(u._id && u.token);
    assert.equal(u.email, 'jane@example.com'); // normalised

    assert.equal((await call('POST', '/auth/register', { name: 'x', email: 'jane@example.com', password: 'secret123' })).status, 400);
    assert.equal((await call('POST', '/auth/register', { name: 'x', email: 'bad', password: 'secret123' })).status, 400);
    assert.equal((await call('POST', '/auth/register', { name: 'x', email: 'a@b.co', password: '123' })).status, 400);

    const ok = await call('POST', '/auth/login', { email: 'JANE@example.com', password: 'secret123' });
    assert.equal(ok.status, 200);
    assert.ok(ok.data.token);
    assert.equal((await call('POST', '/auth/login', { email: 'jane@example.com', password: 'wrong!!' })).status, 401);
    assert.equal((await call('POST', '/auth/login', { email: { $ne: 1 }, password: 'x' })).status, 400);
});

test('protected routes need a valid token', async () => {
    assert.equal((await call('GET', '/auth/profile')).status, 401);
    assert.equal((await call('GET', '/auth/profile', undefined, 'garbage')).status, 401);
});

test('profile read/update, stored resumes and password change', async () => {
    const { token } = await register('profile@example.com');

    const p = await call('GET', '/auth/profile', undefined, token);
    assert.equal(p.status, 200);
    assert.equal(p.data.password, undefined);
    assert.equal(p.data.resetOtp, undefined);
    assert.deepEqual(p.data.storedResumes, []);
    assert.equal(p.data.tier, 'Unranked');

    const u = await call('PUT', '/auth/profile', {
        name: 'New Name', age: '21', gender: 'Female', categoryTrack: 'Data Science',
        leaderboardOptIn: true, phone: '123', storedResumes: [{ title: 'CV', url: 'https://x.test/cv.pdf' }],
    }, token);
    assert.equal(u.status, 200, JSON.stringify(u.data));
    assert.equal(u.data.name, 'New Name');
    assert.equal(u.data.age, 21);
    assert.equal(u.data.gender, 'Female');
    assert.equal(u.data.categoryTrack, 'Data Science');
    assert.equal(u.data.leaderboardOptIn, true);
    assert.equal(u.data.storedResumes.length, 1);
    assert.ok(u.data.storedResumes[0]._id, 'stored resume needs an _id for the frontend');
    assert.ok(u.data.token);

    assert.equal((await call('PUT', '/auth/profile', { password: 'newpass1' }, token)).status, 400);
    assert.equal((await call('PUT', '/auth/profile', { password: 'newpass1', oldPassword: 'nope' }, token)).status, 401);
    assert.equal((await call('PUT', '/auth/profile', { password: 'newpass1', oldPassword: 'secret123' }, token)).status, 200);
    assert.equal((await call('POST', '/auth/login', { email: 'profile@example.com', password: 'newpass1' })).status, 200);

    assert.equal((await call('DELETE', '/auth/profile/resume/5', undefined, token)).status, 400);
    const d = await call('DELETE', '/auth/profile/resume/0', undefined, token);
    assert.equal(d.status, 200);
    assert.deepEqual(d.data.storedResumes, []);
});

test('profile PDF upload is stored in the database and downloadable', async () => {
    const { token } = await register('upload@example.com');
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
    const upload = async (name, type) => {
        const form = new FormData();
        form.append('resume', new Blob([pdfBytes], { type }), name);
        const res = await fetch(`${base}/auth/profile/resume`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
        return { status: res.status, data: await res.json() };
    };

    assert.equal((await upload('cv.txt', 'text/plain')).status, 400);
    const up = await upload('My CV.pdf', 'application/pdf');
    assert.equal(up.status, 200, JSON.stringify(up.data));
    const stored = up.data.storedResumes[0];
    assert.equal(stored.title, 'My CV');
    assert.match(stored.url, /\/api\/files\/[0-9a-f-]{36}$/);

    const dl = await fetch(stored.url);
    assert.equal(dl.status, 200);
    assert.equal(dl.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await dl.arrayBuffer()), pdfBytes);

    assert.equal((await call('DELETE', '/auth/profile/resume/0', undefined, token)).status, 200);
    assert.equal((await fetch(stored.url)).status, 404); // file removed with the link
    assert.equal((await fetch(`${base}/files/not-an-id`)).status, 404);
});

test('resume builder CRUD is scoped to the owner', async () => {
    const a = await register('resume-a@example.com');
    const b = await register('resume-b@example.com');

    assert.equal((await call('GET', '/resume', undefined, a.token)).data.data, null);

    const content = { contact: { fullName: 'A' }, skills: ['Python', 'SQL'], experience: [{ id: 'exp-1', company: 'X' }] };
    const created = await call('POST', '/resume', { title: 'Main', content }, a.token);
    assert.equal(created.status, 200);
    const id = created.data.data._id;
    assert.deepEqual(created.data.data.content, content);
    assert.equal(created.data.data.user, a._id);

    const updated = await call('POST', '/resume', { id, content: { ...content, skills: ['Go'] } }, a.token);
    assert.equal(updated.status, 200);
    assert.equal(updated.data.data.title, 'Main'); // title kept when omitted
    assert.deepEqual(updated.data.data.content.skills, ['Go']);

    assert.equal((await call('GET', '/resume', undefined, a.token)).data.data._id, id);
    assert.equal((await call('GET', '/resume/all', undefined, a.token)).data.data.length, 1);

    // other user / malformed id cannot touch it
    assert.equal((await call('POST', '/resume', { id, content }, b.token)).status, 404);
    assert.equal((await call('POST', '/resume', { id: 'not-a-uuid', content }, a.token)).status, 404);
    assert.equal((await call('DELETE', `/resume/${id}`, undefined, b.token)).status, 404);

    assert.equal((await call('DELETE', `/resume/${id}`, undefined, a.token)).status, 200);
    assert.equal((await call('DELETE', `/resume/${id}`, undefined, a.token)).status, 404);
});

test('job tracker CRUD with validation and ownership', async () => {
    const a = await register('jobs-a@example.com');
    const b = await register('jobs-b@example.com');

    assert.equal((await call('POST', '/jobs', { company: 'Acme' }, a.token)).status, 400);
    assert.equal((await call('POST', '/jobs', { company: 'Acme', role: 'Dev', status: 'bogus' }, a.token)).status, 400);

    const c = await call('POST', '/jobs', { company: ' Acme ', role: 'Dev', location: 'Remote' }, a.token);
    assert.equal(c.status, 201);
    assert.equal(c.data.data.status, 'saved');
    assert.equal(c.data.data.company, 'Acme');
    assert.ok(c.data.data.createdAt);
    const id = c.data.data._id;

    const u = await call('PUT', `/jobs/${id}`, { status: 'applied', user: b._id }, a.token);
    assert.equal(u.status, 200);
    assert.equal(u.data.data.status, 'applied');
    assert.equal(u.data.data.user, a._id); // mass assignment blocked
    assert.equal((await call('PUT', `/jobs/${id}`, { status: 'nope' }, a.token)).status, 400);
    assert.equal((await call('PUT', `/jobs/${id}`, { status: 'offer' }, b.token)).status, 401);
    assert.equal((await call('PUT', '/jobs/xyz', { status: 'offer' }, a.token)).status, 404);

    assert.equal((await call('GET', '/jobs', undefined, a.token)).data.data.length, 1);
    assert.equal((await call('GET', '/jobs', undefined, b.token)).data.data.length, 0);

    assert.equal((await call('DELETE', `/jobs/${id}`, undefined, b.token)).status, 401);
    assert.equal((await call('DELETE', `/jobs/${id}`, undefined, a.token)).status, 200);
    assert.equal((await call('DELETE', `/jobs/${id}`, undefined, a.token)).status, 404);
});

test('interviews, resume analysis and dashboard stats', async () => {
    const a = await register('stats@example.com');

    assert.equal((await call('POST', '/user/interviews', { jobRole: 'Dev' }, a.token)).status, 400);
    const i = await call('POST', '/user/interviews', {
        jobRole: 'Backend Dev', overallScore: 77.6, overallFeedback: 'Good',
        results: [{ question: 'Q1', answer: 'A1', feedback: 'F1', score: 80 }],
    }, a.token);
    assert.equal(i.status, 201);
    assert.equal(i.data.data.overallScore, 78);
    assert.equal(i.data.data.questions[0].questionText, 'Q1');

    assert.equal((await call('POST', '/user/resume-analysis', { score: 70 }, a.token)).status, 404);
    await call('POST', '/resume', { title: 'R', content: { skills: ['Python', 'React', 'SQL'] } }, a.token);
    const an = await call('POST', '/user/resume-analysis', { score: 70, missingKeywords: ['Docker'] }, a.token);
    assert.equal(an.status, 200);
    assert.equal(an.data.data.analysisAnalysis.score, 70);

    const s = await call('GET', '/user/dashboard-stats', undefined, a.token);
    assert.equal(s.status, 200);
    assert.equal(s.data.data.topStats.interviews, 1);
    assert.equal(s.data.data.topStats.avgScore, 70);
    assert.equal(s.data.data.activityChart.length, 7);
    assert.equal(s.data.data.activityChart[6].interviews, 1);
    assert.ok(s.data.data.recentActivity.length >= 2);
});

test('leaderboard shows only opted-in users with a score', async () => {
    const a = await register('lb-a@example.com', 'secret123', 'Alice');
    const b = await register('lb-b@example.com', 'secret123', 'Bob');
    await User.update(a._id, { leaderboardOptIn: true, globalRankScore: 900, tier: 'Diamond', categoryTrack: 'Design' });
    await User.update(b._id, { leaderboardOptIn: false, globalRankScore: 950 });

    const all = await call('GET', '/leaderboard');
    assert.equal(all.status, 200);
    const names = all.data.data.map((u) => u.name);
    assert.ok(names.includes('Alice'));
    assert.ok(!names.includes('Bob'));
    assert.equal(all.data.data[0].email, undefined);

    const design = await call('GET', '/leaderboard?category=Design');
    assert.ok(design.data.data.every((u) => u.categoryTrack === 'Design'));
    const other = await call('GET', '/leaderboard?category=Marketing');
    assert.equal(other.data.data.length, 0);
});

test('public profile hides private fields and handles bad ids', async () => {
    const a = await register('public@example.com');
    const r = await call('GET', `/public/profile/${a._id}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.data.email, undefined);
    assert.equal(r.data.data.phone, undefined);
    assert.equal((await call('GET', '/public/profile/abc')).status, 404);
    assert.equal((await call('GET', '/public/profile/00000000-0000-4000-8000-000000000000')).status, 404);
});

test('password reset rejects missing/invalid OTP', async () => {
    await register('reset@example.com');
    assert.equal((await call('POST', '/auth/reset-password', { email: 'reset@example.com', otp: '123456', newPassword: 'abcdef' })).status, 400);
    assert.equal((await call('POST', '/auth/reset-password', { email: 'reset@example.com' })).status, 400);
});

test('unknown API route and malformed JSON', async () => {
    assert.equal((await call('GET', '/does-not-exist')).status, 404);
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
});
