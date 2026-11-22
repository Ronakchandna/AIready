// Demo data: a ready-made demo account ("Try the demo" button) and sample leaderboard users.
// Demo users get random passwords, so nobody can sign in as them with a password; the demo
// account is entered only through POST /api/auth/demo, which also resets its data each time.
// Disable everything here with DEMO_MODE=false.
const crypto = require('crypto');
const db = require('./db');
const User = require('./models/User');

const enabled = () => process.env.DEMO_MODE !== 'false';
const DEMO_EMAIL = 'demo@aiready.app';
const randomPassword = () => crypto.randomBytes(24).toString('base64url');
const tierFor = (score) => (score >= 850 ? 'Diamond' : score >= 700 ? 'Platinum' : score >= 500 ? 'Gold'
    : score >= 300 ? 'Silver' : score > 0 ? 'Bronze' : 'Unranked');
const avatar = (seed) => `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`;

const LEADERBOARD = [
    ['Ananya Iyer', 'Data Science', 912],
    ['Rohan Malhotra', 'Software Engineering', 884],
    ['Sarah Chen', 'Data Science', 861],
    ['Kabir Singh', 'Software Engineering', 803],
    ['Meera Nair', 'Design', 768],
    ['Arjun Reddy', 'Software Engineering', 731],
    ['Elena Rodriguez', 'Product Management', 694],
    ['Ishaan Gupta', 'Software Engineering', 612],
    ['Priya Deshmukh', 'Marketing', 548],
    ['David Kim', 'Design', 487],
    ['Neha Joshi', 'Data Science', 402],
    ['Vikram Rao', 'Product Management', 318],
];

// Old seed script used these addresses with a shared, known password - remove them
const LEGACY_DEMO_EMAILS = ['alex', 'sarah', 'marcus', 'elena', 'david'].map((n) => `${n}@demo.airesume`);

const ensureLeaderboard = async () => {
    await db.query('DELETE FROM users WHERE email = ANY($1)', [LEGACY_DEMO_EMAILS]);
    for (const [name, track, score] of LEADERBOARD) {
        const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@demo.aiready.app`;
        const fields = { globalRankScore: score, tier: tierFor(score), categoryTrack: track, leaderboardOptIn: true, profilePhoto: avatar(email) };
        const existing = await User.findByEmail(email);
        if (existing) await User.update(existing._id, fields);
        else await User.create({ name, email, password: randomPassword(), ...fields });
    }
};

const RESUME = {
    contact: {
        fullName: 'Aarav Mehta', email: 'aarav.mehta@example.com', phone: '+91 98765 43210',
        linkedin: 'https://linkedin.com/in/aarav-mehta', portfolio: 'https://github.com/aarav-mehta',
    },
    summary: 'Full-stack developer with 2+ years of experience building scalable web applications with React, Node.js and Python. Passionate about clean APIs, performance and shipping features that users love.',
    experience: [
        {
            id: 'exp-1', company: 'Infosys', role: 'Software Engineer', startDate: 'Jul 2023', endDate: 'Present',
            description: '- Built REST APIs in Node.js and Express serving 50,000+ daily users\n- Cut dashboard load time by 40% by moving to React with code splitting and caching\n- Led a team of 4 to deliver a payments module 2 weeks ahead of schedule\n- Added automated tests that raised coverage from 35% to 80%',
        },
        {
            id: 'exp-2', company: 'Tata Consultancy Services', role: 'Software Engineering Intern', startDate: 'Jan 2023', endDate: 'Jun 2023',
            description: '- Automated weekly test reports with Python and Pandas, saving 10 hours per week\n- Fixed 30+ production bugs in a Java Spring Boot service',
        },
    ],
    education: [{ id: 'edu-1', institution: 'Vellore Institute of Technology', degree: 'B.Tech in Computer Science', year: '2019 - 2023' }],
    projects: [
        { id: 'proj-1', title: 'AI Resume Analyzer', link: 'https://github.com/aarav-mehta/resume-analyzer', description: 'Python, FastAPI and spaCy service that scores resumes against job descriptions.' },
        { id: 'proj-2', title: 'Real-time Chat App', link: '', description: 'React, Socket.io and PostgreSQL chat with 1,000+ concurrent users in load tests.' },
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'Python', 'FastAPI', 'SQL', 'PostgreSQL', 'Docker', 'Git', 'AWS'],
};

// Earlier, weaker drafts - shown in version history to demonstrate improvement
const DRAFT_1 = {
    ...RESUME,
    summary: 'Software developer looking for opportunities.',
    experience: [{ ...RESUME.experience[0], description: '- Worked on APIs\n- Worked on the dashboard' }, RESUME.experience[1]],
    projects: [],
    skills: ['JavaScript', 'React', 'Node.js', 'SQL'],
};
const DRAFT_2 = {
    ...RESUME,
    experience: [{ ...RESUME.experience[0], description: '- Built REST APIs in Node.js serving 50,000+ daily users\n- Improved dashboard performance with React' }, RESUME.experience[1]],
    projects: [RESUME.projects[0]],
    skills: ['JavaScript', 'React', 'Node.js', 'Express', 'Python', 'SQL', 'Git'],
};

const daysAgo = (d, h = 11) => {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(h, 15, 0, 0);
    return t;
};

const JOBS = [
    ['Google', 'Software Engineer II', 'interviewing', 'Bengaluru', 1],
    ['Microsoft', 'Full Stack Developer', 'applied', 'Hyderabad', 2],
    ['Flipkart', 'SDE-1', 'offer', 'Bengaluru', 3],
    ['Razorpay', 'Backend Engineer', 'applied', 'Remote', 4],
    ['Swiggy', 'Frontend Engineer', 'rejected', 'Bengaluru', 6],
    ['Atlassian', 'Software Engineer', 'saved', 'Remote', 0],
];

const INTERVIEWS = [
    ['Backend Developer', 62, 'Good technical depth; add measurable outcomes and use the STAR structure.', 5],
    ['Full Stack Developer', 74, 'Clear answers with good examples. Explain trade-offs in system design more.', 3],
    ['Software Engineer', 85, 'Strong, structured answers with concrete results. Ready for real interviews!', 1],
];

// (Re)create the demo account with fresh sample data and return it
const resetDemoAccount = async () => {
    let user = await User.findByEmail(DEMO_EMAIL);
    const profile = {
        name: 'Aarav Mehta', phone: '+91 98765 43210', gender: 'Male', age: 24,
        categoryTrack: 'Software Engineering', leaderboardOptIn: true,
        globalRankScore: 642, tier: tierFor(642), profilePhoto: avatar(DEMO_EMAIL), storedResumes: [],
        password: randomPassword(),
    };
    user = user ? await User.update(user._id, profile) : await User.create({ email: DEMO_EMAIL, ...profile });
    const uid = user._id;

    // wipe previous demo activity (cascades to versions)
    await db.query('DELETE FROM resumes WHERE user_id = $1', [uid]);
    await db.query('DELETE FROM job_applications WHERE user_id = $1', [uid]);
    await db.query('DELETE FROM interviews WHERE user_id = $1', [uid]);
    await db.query('DELETE FROM files WHERE user_id = $1', [uid]);

    const analysis = { score: 82, missingKeywords: ['Kubernetes', 'CI/CD'], feedback: 'Strong match! Your resume covers the core skills and responsibilities this role asks for.' };
    const resume = await db.one(
        `INSERT INTO resumes (user_id, title, content, analysis, created_at, updated_at)
         VALUES ($1, 'Aarav Mehta - Full Stack', $2, $3, $4, $5) RETURNING id`,
        [uid, JSON.stringify(RESUME), JSON.stringify(analysis), daysAgo(6), daysAgo(0, 9)]);

    const versions = [['First draft', DRAFT_1, 54, 6], ['Added metrics and projects', DRAFT_2, 68, 4], ['Tailored for full-stack roles', RESUME, 82, 1]];
    for (const [label, content, score, d] of versions) {
        await db.query(
            `INSERT INTO resume_versions (resume_id, user_id, label, content, score, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
            [resume.id, uid, label, JSON.stringify(content), score, daysAgo(d)]);
    }

    for (const [company, role, status, location, d] of JOBS) {
        await db.query(
            `INSERT INTO job_applications (user_id, company, role, status, location, url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, '', $6, $6)`,
            [uid, company, role, status, location, daysAgo(d, 15)]);
    }

    for (const [jobRole, score, feedback, d] of INTERVIEWS) {
        const questions = [
            { questionText: `Tell me about a project where you used your core skills as a ${jobRole}.`, userAnswer: 'At Infosys I built REST APIs in Node.js serving 50,000 daily users...', aiFeedback: feedback, score },
            { questionText: 'Describe a time you improved the performance of an application.', userAnswer: 'I cut dashboard load time by 40% using code splitting and caching...', aiFeedback: 'Good use of a measurable result.', score: Math.min(100, score + 5) },
        ];
        await db.query(
            `INSERT INTO interviews (user_id, job_role, questions, overall_score, overall_feedback, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [uid, jobRole, JSON.stringify(questions), score, feedback, daysAgo(d, 18)]);
    }

    return User.findById(uid);
};

const ensureDemoData = async () => {
    if (!enabled()) return;
    try {
        await ensureLeaderboard();
        console.log('Demo leaderboard ready');
    } catch (err) {
        console.error('Demo data setup failed:', err.message);
    }
};

module.exports = { enabled, ensureDemoData, resetDemoAccount, DEMO_EMAIL, tierFor };
