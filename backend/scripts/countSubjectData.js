require('dotenv').config();
const connectDB = require('../config/db');
const Subject = require('../models/Subject');
const Lesson = require('../models/Lesson');
const Question = require('../models/Question');

const subjectsToCheck = [
  { code: 'KTCT', nameHint: 'kinh' },
  { code: null, nameHint: 'vat' },
];

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const run = async () => {
  await connectDB();
  for (const s of subjectsToCheck) {
    let subject;
    if (s.code) subject = await Subject.findOne({ code: s.code });
    if (!subject) subject = await Subject.findOne({ name: new RegExp(s.nameHint, 'i') });
    if (!subject) {
      console.log(`Subject not found for hint=${s.nameHint}`);
      if (s.nameHint === 'vat') {
        const candidates = await Subject.find({ name: /v/i }).limit(20);
        console.log('Subject name candidates containing letter V:');
        candidates.forEach(c=>console.log(` - ${c.name}`));
        const match = candidates.find(c=>normalize(c.name).includes('vat'));
        if (match) subject = match;
      }
      if (!subject) continue;
    }
    const lessons = await Lesson.find({ subject: subject._id }).sort({ order: 1 });
    const lessonIds = lessons.map(l=>l._id);
    const qCount = await Question.countDocuments({ lessonId: { $in: lessonIds } });
    console.log(`${subject.name}: lessons=${lessons.length}, questions=${qCount}`);
  }
  process.exit(0);
};

run().catch(e=>{ console.error(e); process.exit(1); });
