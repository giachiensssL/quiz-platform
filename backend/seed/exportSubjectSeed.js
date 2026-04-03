require('dotenv').config();
const fs = require('fs');
const path = require('path');

const connectDB = require('../config/db');
const Faculty = require('../models/Faculty');
const Year = require('../models/Year');
const Semester = require('../models/Semester');
const Subject = require('../models/Subject');
const Lesson = require('../models/Lesson');
const Question = require('../models/Question');

const DATA_DIR = path.resolve(__dirname, '../../frontend/src/data');

const args = process.argv.slice(2);
const getArg = (key) => {
  const index = args.indexOf(key);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
};
const hasFlag = (key) => args.includes(key);

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
const slugify = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');
const constantName = (value) => normalizeText(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/(^_|_$)/g, '')
  .toUpperCase();

const formatJsObject = (obj) => JSON.stringify(obj, null, 2);

const getSubjectsQuery = () => {
  const subjectId = getArg('--id');
  const subjectName = getArg('--subject') || getArg('--name');
  const exportAll = hasFlag('--all');

  if (exportAll) return {};
  if (subjectId) return { _id: subjectId };
  if (subjectName) return { name: new RegExp(`^${subjectName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i') };

  throw new Error('Please specify --all or --id <subjectId> or --subject <subjectName>');
};

const getSemesterName = (semester) => {
  if (!semester) return '';
  return semester.label || `Học kỳ ${semester.value || ''}`.trim();
};

const getYearName = (year) => {
  if (!year) return '';
  return year.label || `Năm ${year.value || ''}`.trim();
};

const writeDataIndex = () => {
  const files = fs.readdirSync(DATA_DIR).filter((file) => file.endsWith('Seed.js'));
  const imports = files
    .map((file) => {
      const base = path.basename(file, '.js');
      return `import { ${constantName(base)} } from './${base}';`;
    })
    .join('\n');
  const seedsList = files
    .map((file) => constantName(path.basename(file, '.js')))
    .join(', ');
  const content = `${imports}\n\nexport const DATA_SEEDS = [${seedsList}];\n`;
  fs.writeFileSync(path.join(DATA_DIR, 'index.js'), content, 'utf8');
  console.log('Wrote frontend/src/data/index.js');
};

const buildSeedObject = (subject, lessons, questions) => {
  const facultyName = subject.faculty?.name || '';
  const yearName = getYearName(subject.year);
  const semesterName = getSemesterName(subject.semester);
  const subjectId = String(subject._id);
  const lessonCounts = new Map();
  questions.forEach((question) => {
    const lessonId = String(question.lessonId);
    lessonCounts.set(lessonId, (lessonCounts.get(lessonId) || 0) + 1);
  });

  return {
    facultyName,
    yearName,
    semesterName,
    subject: {
      id: subjectId,
      semesterId: String(subject.semester?._id || subject.semester || ''),
      name: subject.name || '',
      icon: subject.icon || '📚',
      lessons: lessons.length,
      locked: Boolean(subject.locked),
    },
    lessons: lessons.map((lesson) => ({
      id: String(lesson._id),
      subjectId,
      name: lesson.title || lesson.name || '',
      questions: lessonCounts.get(String(lesson._id)) || 0,
      locked: Boolean(lesson.locked),
    })),
    questions: questions.map((question) => ({
      id: String(question._id),
      lessonId: String(question.lessonId),
      type: String(question.type || 'single'),
      text: String(question.question || question.text || ''),
      imageUrl: String(question.imageUrl || ''),
      answers: Array.isArray(question.answers)
        ? question.answers.map((answer, idx) => ({
            id: answer._id ? String(answer._id) : idx + 1,
            text: String(answer.text || ''),
            imageUrl: String(answer.imageUrl || ''),
            correct: Boolean(answer.isCorrect),
          }))
        : [],
    })),
  };
};

const exportSeeds = async () => {
  await connectDB();
  const query = getSubjectsQuery();
  const subjects = await Subject.find(query).populate('faculty year semester').lean();
  if (!subjects.length) {
    throw new Error('No subject found for the given query');
  }

  for (const subject of subjects) {
    const lessons = await Lesson.find({ subject: subject._id }).sort({ order: 1, title: 1 }).lean();
    const lessonIds = lessons.map((lesson) => lesson._id);
    const questions = lessonIds.length ? await Question.find({ lessonId: { $in: lessonIds } }).sort({ order: 1, createdAt: 1 }).lean() : [];
    const seed = buildSeedObject(subject, lessons, questions);

    const slug = slugify(subject.name || `subject-${String(subject._id)}`) || `subject-${String(subject._id)}`;
    const fileName = `${slug}Seed.js`;
    const filePath = path.join(DATA_DIR, fileName);

    const constant = constantName(`${slug}Seed`);
    const fileText = `// Auto-generated from backend DB export for subject \"${subject.name}\"\nexport const ${constant} = ${formatJsObject(seed)};\n`;
    fs.writeFileSync(filePath, fileText, 'utf8');
    console.log(`Wrote ${fileName}`);
  }

  writeDataIndex();
};

exportSeeds()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
