const Subject = require("../models/Subject");
const Lesson = require("../models/Lesson");

const LOCK_KEYS = ["faculties", "years", "semesters", "subjects", "lessons"];

const uniqStrings = (items) => {
  const set = new Set((Array.isArray(items) ? items : []).map((item) => String(item || "").trim()).filter(Boolean));
  return [...set];
};

const normalizeAccessLocks = (rawLocks = {}) => {
  return LOCK_KEYS.reduce((acc, key) => {
    acc[key] = uniqStrings(rawLocks?.[key]);
    return acc;
  }, {});
};

const getUserLockSets = (user) => {
  const normalized = normalizeAccessLocks(user?.accessLocks || {});
  return {
    faculties: new Set(normalized.faculties),
    years: new Set(normalized.years),
    semesters: new Set(normalized.semesters),
    subjects: new Set(normalized.subjects),
    lessons: new Set(normalized.lessons),
  };
};

const buildLockedSubjectQuery = (lockSets) => {
  const conditions = [];

  if (lockSets.faculties.size) {
    conditions.push({ faculty: { $in: [...lockSets.faculties] } });
  }
  if (lockSets.years.size) {
    conditions.push({ year: { $in: [...lockSets.years] } });
  }
  if (lockSets.semesters.size) {
    conditions.push({ semester: { $in: [...lockSets.semesters] } });
  }
  if (lockSets.subjects.size) {
    conditions.push({ _id: { $in: [...lockSets.subjects] } });
  }

  return conditions.length ? { $or: conditions } : null;
};

const resolveBlockedSubjectIds = async (lockSets) => {
  const blocked = new Set([...lockSets.subjects]);
  const query = buildLockedSubjectQuery(lockSets);
  if (!query) {
    return blocked;
  }

  const subjects = await Subject.find(query).select("_id").lean();
  subjects.forEach((item) => blocked.add(String(item._id)));
  return blocked;
};

const isLessonAccessibleForUser = async (user, lessonId) => {
  const id = String(lessonId || "").trim();
  if (!id) return false;

  const lockSets = getUserLockSets(user);
  if (lockSets.lessons.has(id)) {
    return false;
  }

  const lesson = await Lesson.findById(id).select("subject").lean();
  if (!lesson) return false;

  const subjectId = String(lesson.subject || "");
  const blockedSubjectIds = await resolveBlockedSubjectIds(lockSets);
  return !blockedSubjectIds.has(subjectId);
};

module.exports = {
  LOCK_KEYS,
  normalizeAccessLocks,
  getUserLockSets,
  buildLockedSubjectQuery,
  resolveBlockedSubjectIds,
  isLessonAccessibleForUser,
};
