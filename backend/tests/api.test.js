// End-to-end API tests against a real (in-memory) PostgreSQL engine.  Run: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_MAX = '100000';
process.env.AI_SERVICE_URL = 'http://127.0.0.1:9'; // nothing listens here: the engine is "asleep"

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
    // a text file renamed to .pdf is rejected by its content
    const fake = new FormData();
    fake.append('resume', new Blob(['hello'], { type: 'application/pdf' }), 'fake.pdf');
    const fakeRes = await fetch(`${base}/auth/profile/resume`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fake });
    assert.equal(fakeRes.status, 400);
    // phones may send a PDF without extension as application/octet-stream
    const noExt = await upload('document', 'application/octet-stream');
    assert.equal(noExt.status, 200, JSON.stringify(noExt.data));
    assert.equal((await call('DELETE', '/auth/profile/resume/0', undefined, token)).status, 200);

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

test('AI upload routes validate input before calling the engine; status reports a sleeping engine', async () => {
    const { token } = await register('aiupload@example.com');
    const post = async (path, field, bytes, name, extra = {}) => {
        const form = new FormData();
        if (bytes) form.append(field, new Blob([bytes], { type: 'application/pdf' }), name);
        for (const [k, v] of Object.entries(extra)) form.append(k, v);
        const res = await fetch(`${base}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
        return { status: res.status, data: await res.json() };
    };
    const notPdf = await post('/ai/parse-resume', 'file', 'hello', 'cv.pdf');
    assert.equal(notPdf.status, 400);
    assert.match(notPdf.data.message, /not a PDF/);
    assert.equal((await post('/ai/parse-linkedin', 'file', null)).status, 400);
    assert.equal((await post('/ai/analyze-resume', 'resume_file', 'hello', 'cv.pdf', { job_description: 'React developer' })).status, 400);
    assert.equal((await post('/ai/analyze-resume', 'resume_file', null, null, { job_description: 'React developer' })).status, 400);
    assert.equal((await post('/ai/analyze-resume', 'resume_file', '%PDF-1.4 x', 'cv.pdf', { job_description: '  ' })).status, 400);

    const s = await call('GET', '/ai/status', undefined, token);
    assert.equal(s.status, 200);
    assert.equal(s.data.ready, false); // no engine running in tests
    assert.equal((await call('GET', '/ai/status')).status, 401);
});

test('delete account needs the password and removes all the user data', async () => {
    const { token } = await register('leaving@example.com');
    const r = await call('POST', '/resume', { title: 'CV', content: { skills: ['Go'] } }, token);
    const resumeId = r.data.data._id;
    assert.equal((await call('DELETE', '/auth/profile', {}, token)).status, 400);
    assert.equal((await call('DELETE', '/auth/profile', { password: 'wrong-pass' }, token)).status, 401);
    const ok = await call('DELETE', '/auth/profile', { password: 'secret123' }, token);
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal((await call('POST', '/auth/login', { email: 'leaving@example.com', password: 'secret123' })).status, 401);
    const rows = await db.query('SELECT id FROM resumes WHERE id = $1', [resumeId]);
    assert.equal(rows.length, 0); // cascaded
    assert.equal((await call('GET', '/auth/profile', undefined, token)).status, 401); // old token no longer works
});

test('keep-awake window is 09:30-21:30 India time', () => {
    const { inWindow, istHour } = require('../utils/keepAwake');
    assert.equal(istHour(new Date('2026-11-25T00:00:00Z')), 5.5);
    assert.equal(inWindow(new Date('2026-11-25T03:59:00Z')), false); // 09:29 IST
    assert.equal(inWindow(new Date('2026-11-25T04:00:00Z')), true);  // 09:30 IST
    assert.equal(inWindow(new Date('2026-11-25T15:59:00Z')), true);  // 21:29 IST
    assert.equal(inWindow(new Date('2026-11-25T16:00:00Z')), false); // 21:30 IST
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

    // rename only: content must be kept (My Resumes panel)
    const renamed = await call('POST', '/resume', { id, title: 'Backend roles' }, a.token);
    assert.equal(renamed.data.data.title, 'Backend roles');
    assert.deepEqual(renamed.data.data.content.skills, ['Go']);

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

test('demo login creates a filled demo account and demo leaderboard', async () => {
    const demo = require('../demo');
    await demo.ensureDemoData();
    await demo.ensureDemoData(); // idempotent

    const first = await call('POST', '/auth/demo');
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.ok(first.data.token);
    assert.equal(first.data.email, demo.DEMO_EMAIL);
    const t = first.data.token;

    const stats = await call('GET', '/user/dashboard-stats', undefined, t);
    assert.equal(stats.data.data.topStats.interviews, 3);
    assert.equal(stats.data.data.topStats.avgScore, 82);
    assert.equal((await call('GET', '/jobs', undefined, t)).data.data.length, 6);
    const resume = (await call('GET', '/resume', undefined, t)).data.data;
    assert.equal(resume.content.contact.fullName, 'Aarav Mehta');
    const versions = (await call('GET', `/resume/${resume._id}/versions`, undefined, t)).data.data;
    assert.deepEqual(versions.map((v) => v.score), [82, 68, 54]);

    // demo users cannot be used with a password, and the demo resets on the next demo login
    assert.equal((await call('POST', '/auth/login', { email: demo.DEMO_EMAIL, password: 'password123' })).status, 401);
    await call('DELETE', `/resume/${resume._id}`, undefined, t);
    const again = await call('POST', '/auth/demo');
    assert.equal((await call('GET', '/resume/all', undefined, again.data.token)).data.data.length, 1);

    const lb = (await call('GET', '/leaderboard')).data.data;
    assert.ok(lb.length >= 12);
    assert.ok(lb.every((u, i) => i === 0 || lb[i - 1].globalRankScore >= u.globalRankScore));
    assert.ok(lb.every((u) => u.tier === demo.tierFor(u.globalRankScore)));
});

test('resume version history: save, list, restore, delete, ownership', async () => {
    const a = await register('versions-a@example.com');
    const b = await register('versions-b@example.com');
    const created = await call('POST', '/resume', { title: 'CV', content: { skills: ['Go'] } }, a.token);
    const id = created.data.data._id;
    await call('POST', '/user/resume-analysis', { score: 61 }, a.token);

    const v1 = await call('POST', `/resume/${id}/versions`, { label: 'Go only' }, a.token);
    assert.equal(v1.status, 201);
    assert.equal(v1.data.data.score, 61);
    assert.equal(v1.data.data.label, 'Go only');
    assert.equal(v1.data.data.skillCount, 1);

    await call('POST', '/resume', { id, content: { skills: ['Go', 'Rust'] } }, a.token);
    const restored = await call('POST', `/resume/${id}/versions/${v1.data.data._id}/restore`, {}, a.token);
    assert.equal(restored.status, 200);
    assert.deepEqual(restored.data.data.content.skills, ['Go']);

    const list = (await call('GET', `/resume/${id}/versions`, undefined, a.token)).data.data;
    assert.deepEqual(list.map((v) => v.label), ['Before restore', 'Go only']);
    assert.deepEqual(list[0].content.skills, ['Go', 'Rust']); // the undo point

    assert.equal((await call('GET', `/resume/${id}/versions`, undefined, b.token)).status, 404);
    assert.equal((await call('POST', `/resume/${id}/versions/${v1.data.data._id}/restore`, {}, b.token)).status, 404);
    assert.equal((await call('DELETE', `/resume/${id}/versions/${v1.data.data._id}`, undefined, b.token)).status, 404);
    assert.equal((await call('DELETE', `/resume/${id}/versions/${v1.data.data._id}`, undefined, a.token)).status, 200);
    assert.equal((await call('GET', `/resume/${id}/versions`, undefined, a.token)).data.data.length, 1);
});

test('unknown API route and malformed JSON', async () => {
    assert.equal((await call('GET', '/does-not-exist')).status, 404);
    const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
});
