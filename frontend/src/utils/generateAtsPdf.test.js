import { clean, generateAtsPdf } from './generateAtsPdf';

const sample = {
    contact: { fullName: 'Priya Sharma', email: 'priya@example.com', phone: '+91 98765 43210', linkedin: 'https://linkedin.com/in/priya/' },
    summary: 'Full‑stack developer — 3+ years’ experience…',
    experience: [{
        role: 'Senior Software Engineer – Payments Platform and Developer Experience Infrastructure Team',
        company: 'Infosys', startDate: 'Jun 2022', endDate: 'Present',
        description: '- Built APIs for 50,000 users\n• Cut load time by 40%\n* Saved ₹15 lakh',
    }],
    projects: [{ title: 'AI Resume Analyzer', link: 'https://github.com/p/x', description: 'FastAPI + spaCy' }],
    education: [{ degree: 'B.Tech CSE', institution: 'VIT', year: '2022' }],
    skills: ['React', 'Node.js', 'C++', 'C#'],
};

const pdfText = (doc) => doc.output(); // raw PDF source (text is stored uncompressed by jsPDF)

describe('clean()', () => {
    test('maps typographic characters the PDF font cannot draw', () => {
        expect(clean('Full‑stack — it’s “great”…')).toBe('Full-stack - it\'s "great"...');
        expect(clean('₹500 → done ✓')).toBe('Rs.500 -> done');
        expect(clean('a b c​d')).toBe('a b cd'); // special spaces -> space, zero-width removed
    });

    test('keeps Latin-1 text and removes characters outside it', () => {
        expect(clean('Café résumé – naïve 😀 漢字')).toBe('Café résumé - naïve');
        expect(clean(null)).toBe('');
        expect(clean(undefined)).toBe('');
        expect(clean(42)).toBe('42');
    });
});

describe('generateAtsPdf()', () => {
    test('builds a one-page PDF with all sections and clean text', () => {
        const doc = generateAtsPdf(sample, { save: false });
        expect(doc.getNumberOfPages()).toBe(1);
        const src = pdfText(doc);
        ['Priya Sharma', 'PROFESSIONAL SUMMARY', 'WORK EXPERIENCE', 'PROJECTS', 'EDUCATION', 'TECHNICAL SKILLS',
            'Full-stack developer', 'Saved Rs.15 lakh', 'linkedin.com/in/priya', 'C++, C#'].forEach((t) => {
            expect(src).toContain(t);
        });
        expect(src).not.toMatch(/[‐-‧₹]/);
    });

    test('adds pages for long resumes and handles empty data', () => {
        const long = { ...sample, experience: Array.from({ length: 12 }, () => sample.experience[0]) };
        expect(generateAtsPdf(long, { save: false }).getNumberOfPages()).toBeGreaterThan(1);
        const empty = generateAtsPdf({}, { save: false });
        expect(pdfText(empty)).toContain('YOUR NAME');
    });
});
