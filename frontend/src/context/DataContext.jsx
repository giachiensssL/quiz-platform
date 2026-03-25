// src/context/DataContext.jsx
// Mock data - thay bằng API calls khi có backend
import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { KTMT_SEED } from '../data/ktmtSeed';
import { API_BASE_URL, adminDataAPI, facultiesAPI, lessonsAPI, questionsAPI, semestersAPI, subjectsAPI, yearsAPI } from '../api/api';

const DataContext = createContext(null);
const DATA_STORAGE_KEY = 'qm_data_store';
const ENABLE_LOCAL_DATA_FALLBACK = String(process.env.REACT_APP_ENABLE_LOCAL_DATA_FALLBACK || '').toLowerCase() === 'true';
const isServerToken = (token) => {
  const value = String(token || '');
  if (!value) return false;
  return value !== 'admin-token' && !value.startsWith('token-');
};

const normalizeType = (type) => {
  if (type === 'true_false') return 'truefalse';
  if (type === 'drag_drop') return 'drag';
  return type;
};

const normalizeQuestion = (q) => ({
  ...q,
  text: q?.text || q?.question || '',
  type: normalizeType(q?.type || 'single'),
  imageUrl: q?.imageUrl || '',
  answers: (Array.isArray(q?.answers) ? q.answers : []).map((a, idx) => ({
    id: a?.id ?? idx + 1,
    text: a?.text || '',
    imageUrl: a?.imageUrl || '',
    correct: Boolean(a?.correct ?? a?.isCorrect),
    order: a?.order,
  })),
});

const parseNumberFromLabel = (label, fallback = 1) => {
  const matched = String(label || '').match(/\d+/);
  if (!matched) return fallback;
  const value = Number(matched[0]);
  return Number.isNaN(value) ? fallback : value;
};

const normalizeLessonTitle = (name, order) => {
  const raw = String(name || '').trim();
  if (!raw) return raw;
  if (/^bai\s+\d+/i.test(raw) || /^bài\s+\d+/i.test(raw)) return raw;
  const ord = Number(order || parseNumberFromLabel(raw, 1));
  return `Bài ${ord}: ${raw}`;
};

const SUBJECT_ICON_RULES = [
  { icon: '💻', keys: ['lap trinh', 'lập trình', 'cau truc du lieu', 'cấu trúc dữ liệu', 'giai thuat', 'giải thuật', 'oop', 'phan mem', 'phần mềm'] },
  { icon: '🌐', keys: ['web', 'mang', 'mạng', 'internet', 'truyen thong', 'truyền thông'] },
  { icon: '🗄️', keys: ['co so du lieu', 'cơ sở dữ liệu', 'database', 'sql', 'data'] },
  { icon: '🤖', keys: ['tri tue nhan tao', 'trí tuệ nhân tạo', 'ai', 'machine learning', 'hoc may', 'học máy'] },
  { icon: '🔒', keys: ['bao mat', 'bảo mật', 'an toan thong tin', 'an toàn thông tin', 'security'] },
  { icon: '⚡', keys: ['dien', 'điện', 'mach', 'mạch', 'dien tu', 'điện tử'] },
  { icon: '📈', keys: ['kinh te', 'kinh tế', 'quan tri', 'quản trị', 'marketing', 'tai chinh', 'tài chính'] },
  { icon: '🌍', keys: ['anh van', 'anh', 'tieng anh', 'tiếng anh', 'ngoai ngu', 'ngoại ngữ'] },
  { icon: '🎨', keys: ['do hoa', 'đồ họa', 'thiet ke', 'thiết kế', 'my thuat', 'mỹ thuật'] },
];

const inferSubjectIcon = (subjectName) => {
  const value = String(subjectName || '').trim().toLowerCase();
  if (!value) return '📚';
  const matched = SUBJECT_ICON_RULES.find((rule) => rule.keys.some((key) => value.includes(key)));
  return matched?.icon || '📚';
};

const mergeById = (base, extras) => {
  const list = Array.isArray(base) ? [...base] : [];
  const ids = new Set(list.map((item) => item?.id));
  (Array.isArray(extras) ? extras : []).forEach((item) => {
    if (!ids.has(item?.id)) {
      list.push(item);
      ids.add(item?.id);
    }
  });
  return list;
};

const ensureKtmtSeed = (source) => {
  const safe = source && typeof source === 'object' ? source : {};
  const subjects = mergeById(safe.subjects, [KTMT_SEED.subject]);
  const lessons = mergeById(safe.lessons, KTMT_SEED.lessons);
  const questions = mergeById(safe.questions, KTMT_SEED.questions);

  return {
    ...safe,
    subjects,
    lessons,
    questions,
  };
};

const normalizeData = (source, options = {}) => {
  const includeKtmtSeed = options.includeKtmtSeed !== false;
  const seeded = includeKtmtSeed ? ensureKtmtSeed(source) : (source && typeof source === 'object' ? source : {});
  return {
    ...seeded,
    faculties: (Array.isArray(seeded?.faculties) ? seeded.faculties : []).map((item) => ({ ...item, locked: Boolean(item?.locked) })),
    years: (Array.isArray(seeded?.years) ? seeded.years : []).map((item) => ({ ...item, locked: Boolean(item?.locked) })),
    subjects: (Array.isArray(seeded?.subjects) ? seeded.subjects : []).map((item) => ({ ...item, locked: Boolean(item?.locked) })),
    lessons: (Array.isArray(seeded?.lessons) ? seeded.lessons : []).map((item) => ({ ...item, locked: Boolean(item?.locked) })),
    questions: (Array.isArray(seeded?.questions) ? seeded.questions : []).map(normalizeQuestion),
  };
};

const INIT = {
  faculties: [
    { id: 1, name: 'Công nghệ Thông tin', icon: '💻', desc: '24 môn học' },
    { id: 2, name: 'Kinh tế & Quản trị', icon: '📊', desc: '18 môn học' },
    { id: 3, name: 'Kỹ thuật Điện - Điện tử', icon: '⚡', desc: '20 môn học' },
    { id: 4, name: 'Ngoại ngữ', icon: '🌐', desc: '14 môn học' },
  ],
  years: [
    { id: 1, facultyId: 1, name: 'Năm 1' },
    { id: 2, facultyId: 1, name: 'Năm 2' },
    { id: 3, facultyId: 1, name: 'Năm 3' },
    { id: 4, facultyId: 1, name: 'Năm 4' },
    { id: 5, facultyId: 2, name: 'Năm 1' },
    { id: 6, facultyId: 2, name: 'Năm 2' },
  ],
  semesters: [
    { id: 1, yearId: 1, name: 'Học kỳ 1' },
    { id: 2, yearId: 1, name: 'Học kỳ 2' },
    { id: 3, yearId: 2, name: 'Học kỳ 1' },
    { id: 4, yearId: 2, name: 'Học kỳ 2' },
    { id: 5, yearId: 3, name: 'Học kỳ 1' },
  ],
  subjects: [
    { id: 1, semesterId: 1, name: 'Cấu trúc Dữ liệu & Giải thuật', icon: '🌳', lessons: 8 },
    { id: 2, semesterId: 1, name: 'Lập trình Hướng đối tượng', icon: '🧩', lessons: 6 },
    { id: 3, semesterId: 1, name: 'Cơ sở Dữ liệu', icon: '🗄️', lessons: 10 },
    { id: 4, semesterId: 2, name: 'Mạng Máy tính', icon: '🔗', lessons: 7 },
    { id: 5, semesterId: 2, name: 'Trí tuệ Nhân tạo', icon: '🤖', lessons: 9 },
    { id: 6, semesterId: 3, name: 'Phát triển Web', icon: '🌐', lessons: 12 },
  ],
  lessons: [
    { id: 1, subjectId: 1, name: 'Ôn tập Chương 1: Mảng & Danh sách', questions: 10 },
    { id: 2, subjectId: 1, name: 'Ôn tập Chương 2: Ngăn xếp & Hàng đợi', questions: 12 },
    { id: 3, subjectId: 1, name: 'Ôn tập Chương 3: Cây nhị phân', questions: 15 },
    { id: 4, subjectId: 1, name: 'Kiểm tra giữa kỳ', questions: 30 },
    { id: 5, subjectId: 2, name: 'Ôn tập: OOP cơ bản', questions: 10 },
    { id: 6, subjectId: 3, name: 'Ôn tập SQL cơ bản', questions: 14 },
  ],
  questions: [
    { id: 1, lessonId: 1, type: 'single', text: 'Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO?', answers: [
      { id: 1, text: 'Queue (Hàng đợi)', correct: false },
      { id: 2, text: 'Stack (Ngăn xếp)', correct: true },
      { id: 3, text: 'Linked List', correct: false },
      { id: 4, text: 'Binary Tree', correct: false },
    ]},
    { id: 2, lessonId: 1, type: 'single', text: 'Độ phức tạp tìm kiếm trung bình của Binary Search là:', answers: [
      { id: 5, text: 'O(n)', correct: false },
      { id: 6, text: 'O(n²)', correct: false },
      { id: 7, text: 'O(log n)', correct: true },
      { id: 8, text: 'O(1)', correct: false },
    ]},
    { id: 3, lessonId: 1, type: 'multiple', text: 'Các cấu trúc dữ liệu tuyến tính bao gồm: (Chọn tất cả đúng)', answers: [
      { id: 9, text: 'Array (Mảng)', correct: true },
      { id: 10, text: 'Linked List', correct: true },
      { id: 11, text: 'Binary Tree', correct: false },
      { id: 12, text: 'Stack', correct: true },
    ]},
    { id: 4, lessonId: 1, type: 'truefalse', text: 'Array có thể thay đổi kích thước động trong hầu hết ngôn ngữ lập trình.', answers: [
      { id: 13, text: 'Đúng', correct: false },
      { id: 14, text: 'Sai', correct: true },
    ]},
    { id: 5, lessonId: 1, type: 'fill', text: 'Thuật toán sắp xếp có độ phức tạp O(n log n) tốt nhất là _______.', answers: [
      { id: 15, text: 'Quick Sort', correct: true },
      { id: 16, text: 'Merge Sort', correct: true },
    ]},
    { id: 6, lessonId: 1, type: 'drag', text: 'Sắp xếp theo tốc độ truy cập từ NHANH đến CHẬM:', answers: [
      { id: 17, text: 'Array', order: 1 },
      { id: 18, text: 'Hash Table', order: 2 },
      { id: 19, text: 'Linked List', order: 3 },
      { id: 20, text: 'Tree', order: 4 },
    ]},
  ],
  leaderboard: [
    { userId: 1, name: 'Nguyễn Văn A', score: 980, correct: 98, quizzes: 42 },
    { userId: 2, name: 'Trần Thị B', score: 945, correct: 94, quizzes: 38 },
    { userId: 3, name: 'Lê Minh Cường', score: 912, correct: 91, quizzes: 35 },
    { userId: 4, name: 'Phạm Thu Dung', score: 887, correct: 88, quizzes: 30 },
    { userId: 5, name: 'Hoàng Văn Em', score: 862, correct: 86, quizzes: 28 },
    { userId: 6, name: 'Đỗ Thị Phương', score: 841, correct: 84, quizzes: 25 },
    { userId: 7, name: 'Vũ Quốc Giang', score: 820, correct: 82, quizzes: 22 },
  ],
};

export function DataProvider({ children }) {
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
  const [data, setData] = useState(() => {
    const hasServerSession = isServerToken(localStorage.getItem('qm_token'));
    try {
      const raw = JSON.parse(localStorage.getItem(DATA_STORAGE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        return normalizeData(raw, { includeKtmtSeed: !hasServerSession });
      }
    } catch {
      // fallback to INIT
    }

    if (hasServerSession) {
      return normalizeData({ faculties: [], years: [], semesters: [], subjects: [], lessons: [], questions: [], leaderboard: [] }, { includeKtmtSeed: false });
    }

    return normalizeData(INIT, { includeKtmtSeed: true });
  });

  useEffect(() => {
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const syncFromServer = useCallback(async () => {
    const [facRes, yearRes, semRes, subRes] = await Promise.all([
      facultiesAPI.list(),
      yearsAPI.list(),
      semestersAPI.list(),
      subjectsAPI.list(),
    ]);

    const subjectItems = Array.isArray(subRes?.data) ? subRes.data : [];
    const lessonResponses = await Promise.all(subjectItems.map((subject) => lessonsAPI.listBySubject(subject._id || subject.id)));
    const lessonItems = lessonResponses.flatMap((res) => (Array.isArray(res?.data) ? res.data : []));
    const questionAllRes = await questionsAPI.listAll();
    const questionItems = Array.isArray(questionAllRes?.data) ? questionAllRes.data : [];

    const lesRes = { data: lessonItems };
    const quesRes = { data: questionItems };

    const faculties = (facRes.data || []).map((f) => ({
      id: String(f._id),
      name: f.name || '',
      desc: f.description || '',
      icon: '🏛️',
      locked: Boolean(f.locked),
    }));

    const years = (yearRes.data || []).map((y) => ({
      id: String(y._id),
      name: y.label || `Năm ${y.value || ''}`.trim(),
      value: y.value,
      facultyId: String(y?.faculty?._id || y?.faculty || ''),
      locked: Boolean(y.locked),
    }));

    const semesters = (semRes.data || []).map((s) => ({
      id: String(s._id),
      name: s.label || `Học kỳ ${s.value || ''}`.trim(),
      value: s.value,
      yearId: String(s?.year?._id || s?.year || ''),
      locked: Boolean(s.locked),
    }));

    const subjects = (subRes.data || []).map((s) => ({
      id: String(s._id),
      name: s.name || '',
      icon: s.icon || '📚',
      semesterId: String(s?.semester?._id || s?.semester || ''),
      yearId: String(s?.year?._id || s?.year || ''),
      facultyId: String(s?.faculty?._id || s?.faculty || ''),
      desc: s.description || '',
      locked: Boolean(s.locked),
    }));

    const lessons = (lesRes.data || []).map((l) => ({
      id: String(l._id),
      subjectId: String(l?.subject?._id || l?.subject || ''),
      name: l.title || l.name || '',
      questions: Number(l.questions || 0),
      order: Number(l.order || 0),
      locked: Boolean(l.locked),
    }));

    const questions = (quesRes.data || []).map((q) => ({
      id: String(q._id),
      lessonId: String(q?.lessonId?._id || q?.lessonId || ''),
      type: q.type,
      text: q.question || q.text || '',
      imageUrl: q.imageUrl || '',
      answers: (Array.isArray(q.answers) ? q.answers : []).map((a, idx) => ({
        id: String(a._id || idx + 1),
        text: a.text || '',
        imageUrl: a.imageUrl || '',
        correct: Boolean(a.isCorrect ?? a.correct),
      })),
      dragItems: Array.isArray(q.dragItems) ? q.dragItems : [],
      dropTargets: Array.isArray(q.dropTargets) ? q.dropTargets : [],
    }));

    setData(() => normalizeData({
      faculties,
      years,
      semesters,
      subjects,
      lessons,
      questions,
    }, { includeKtmtSeed: false }));
    return true;
  }, []);

  const syncDebounceRef = useRef(null);

  // Debounced sync: collapses rapid consecutive calls (e.g. multiple WS events) into one
  const debouncedSync = useCallback(() => {
    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    syncDebounceRef.current = setTimeout(() => {
      syncFromServer().catch(() => {});
    }, 300);
  }, [syncFromServer]);

  useEffect(() => {
    const token = localStorage.getItem('qm_token');
    if (!isServerToken(token)) return undefined;

    syncFromServer().catch(() => {});
    const timer = window.setInterval(debouncedSync, 30000); // reduced from 10s to 30s

    const handleFocus = () => debouncedSync();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') debouncedSync();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncFromServer, debouncedSync]);

  useEffect(() => {
    const token = localStorage.getItem('qm_token');
    if (!isServerToken(token)) {
      setRealtimeStatus('disconnected');
      return undefined;
    }

    const wsBase = API_BASE_URL.replace(/\/api\/?$/, '').replace(/^http/i, 'ws');
    const wsUrl = `${wsBase}/ws`;

    let socket;
    let reconnectTimer;

    const connect = () => {
      setRealtimeStatus('connecting');
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setRealtimeStatus('connected');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data || '{}');
          if (payload?.event === 'catalog-updated') {
            debouncedSync();
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onclose = () => {
        setRealtimeStatus('disconnected');
        reconnectTimer = window.setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        setRealtimeStatus('disconnected');
        try {
          socket.close();
        } catch {
          // noop
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
      setRealtimeStatus('disconnected');
    };
  }, [syncFromServer, debouncedSync]);

  const crud = (key) => ({
    list: () => data[key],
    add: async (item) => {
      let nextItem = { ...item, id: item?.id || Date.now(), locked: Boolean(item?.locked) };
      const token = localStorage.getItem('qm_token');
      const shouldUseServer = isServerToken(token);
      let serverSynced = false;

      try {
        if (key === 'faculties') {
          const res = await adminDataAPI.createFaculty({ name: item.name, description: item.desc || '' });
          nextItem = { ...nextItem, id: String(res.data?._id || nextItem.id) };
          serverSynced = true;
        }
        if (key === 'years') {
          const value = Number(item.value || parseNumberFromLabel(item.name, 1));
          const res = await adminDataAPI.createYear({
            value,
            label: item.name || `Năm ${value}`,
            faculty: item.facultyId || undefined,
          });
          nextItem = { ...nextItem, id: String(res.data?._id || nextItem.id), value, facultyId: item.facultyId || '' };
          serverSynced = true;
        }
        if (key === 'semesters') {
          const value = Number(item.value || parseNumberFromLabel(item.name, 1));
          const res = await adminDataAPI.createSemester({
            value,
            label: item.name || `Học kỳ ${value}`,
            year: item.yearId || undefined,
          });
          nextItem = { ...nextItem, id: String(res.data?._id || nextItem.id), value, yearId: item.yearId || '' };
          serverSynced = true;
        }
        if (key === 'subjects') {
          const res = await adminDataAPI.createSubject({
            name: item.name,
            description: item.desc || '',
            faculty: item.facultyId,
            year: item.yearId,
            semester: item.semesterId,
            code: item.code || '',
          });
          nextItem = {
            ...nextItem,
            id: String(res.data?._id || nextItem.id),
            icon: res.data?.icon || inferSubjectIcon(item.name),
          };
          serverSynced = true;
        }
        if (key === 'lessons') {
          const res = await adminDataAPI.createLesson({
            subject: item.subjectId,
            title: normalizeLessonTitle(item.name, item.order),
            description: item.desc || '',
            order: Number(item.order || 0),
          });
          nextItem = {
            ...nextItem,
            id: String(res.data?._id || nextItem.id),
            name: normalizeLessonTitle(item.name, item.order),
          };
          serverSynced = true;
        }
        if (key === 'questions') {
          const res = await adminDataAPI.createQuestion({
            lessonId: item.lessonId,
            type: item.type,
            text: item.text,
            imageUrl: item.imageUrl || '',
            answers: (Array.isArray(item.answers) ? item.answers : []).map((a) => ({
              text: String(a.text || '').trim() || '[Hinh anh]',
              isCorrect: Boolean(a.correct),
            })),
            dragItems: Array.isArray(item.dragItems) ? item.dragItems : [],
            dropTargets: Array.isArray(item.dropTargets) ? item.dropTargets : [],
          });
          nextItem = { ...nextItem, id: String(res.data?._id || nextItem.id) };
          serverSynced = true;
        }
      } catch (error) {
        if (shouldUseServer || !ENABLE_LOCAL_DATA_FALLBACK) throw error;
        // Keep local fallback when backend API is unavailable or data shape is incompatible.
      }

      if (serverSynced) {
        setData((d) => ({ ...d, [key]: [...d[key], nextItem] }));
        debouncedSync();
        return nextItem;
      }

      setData((d) => ({ ...d, [key]: [...d[key], nextItem] }));
      return nextItem;
    },
    update: async (id, changes) => {
      const token = localStorage.getItem('qm_token');
      const shouldUseServer = isServerToken(token);
      let serverSynced = false;
      try {
        const currentItem = data[key]?.find((x) => String(x.id) === String(id));

        if (key === 'faculties') {
          await adminDataAPI.updateFaculty(id, {
            name: changes.name ?? currentItem?.name ?? '',
            description: changes.desc ?? currentItem?.desc ?? '',
            locked: typeof changes.locked === 'boolean' ? changes.locked : Boolean(currentItem?.locked),
          });
          serverSynced = true;
        }
        if (key === 'years') {
          const currentName = changes.name ?? currentItem?.name ?? '';
          const value = Number(changes.value ?? currentItem?.value ?? parseNumberFromLabel(currentName, 1));
          const facultyId = changes.facultyId ?? currentItem?.facultyId ?? undefined;
          await adminDataAPI.updateYear(id, {
            value,
            label: currentName || `Năm ${value}`,
            faculty: facultyId || undefined,
            locked: typeof changes.locked === 'boolean' ? changes.locked : Boolean(currentItem?.locked),
          });
          serverSynced = true;
        }
        if (key === 'semesters') {
          const currentName = changes.name ?? currentItem?.name ?? '';
          const value = Number(changes.value ?? currentItem?.value ?? parseNumberFromLabel(currentName, 1));
          const yearId = changes.yearId ?? currentItem?.yearId ?? undefined;
          await adminDataAPI.updateSemester(id, {
            value,
            label: currentName || `Học kỳ ${value}`,
            year: yearId || undefined,
            locked: typeof changes.locked === 'boolean' ? changes.locked : Boolean(currentItem?.locked),
          });
          serverSynced = true;
        }
        if (key === 'subjects') {
          const facultyId = changes.facultyId ?? currentItem?.facultyId ?? undefined;
          const yearId = changes.yearId ?? currentItem?.yearId ?? undefined;
          const semesterId = changes.semesterId ?? currentItem?.semesterId ?? undefined;
          await adminDataAPI.updateSubject(id, {
            name: changes.name ?? currentItem?.name ?? '',
            description: changes.desc ?? currentItem?.desc ?? '',
            faculty: facultyId || undefined,
            year: yearId || undefined,
            semester: semesterId || undefined,
            code: changes.code ?? currentItem?.code ?? '',
            locked: typeof changes.locked === 'boolean' ? changes.locked : Boolean(currentItem?.locked),
          });
          serverSynced = true;
        }
        if (key === 'lessons') {
          const subjectId = changes.subjectId ?? currentItem?.subjectId ?? undefined;
          const nextName = changes.name ?? currentItem?.name ?? '';
          await adminDataAPI.updateLesson(id, {
            subject: subjectId || undefined,
            title: normalizeLessonTitle(nextName, changes.order ?? currentItem?.order),
            description: changes.desc ?? currentItem?.desc ?? '',
            order: Number(changes.order ?? currentItem?.order ?? 0),
            locked: typeof changes.locked === 'boolean' ? changes.locked : Boolean(currentItem?.locked),
          });
          serverSynced = true;
        }
        if (key === 'questions') {
          await adminDataAPI.updateQuestion(id, {
            lessonId: changes.lessonId,
            type: changes.type,
            text: changes.text,
            imageUrl: changes.imageUrl || '',
            answers: (Array.isArray(changes.answers) ? changes.answers : []).map((a) => ({
              text: String(a.text || '').trim() || '[Hinh anh]',
              isCorrect: Boolean(a.correct),
            })),
            dragItems: Array.isArray(changes.dragItems) ? changes.dragItems : [],
            dropTargets: Array.isArray(changes.dropTargets) ? changes.dropTargets : [],
          });
          serverSynced = true;
        }
      } catch (error) {
        if (shouldUseServer || !ENABLE_LOCAL_DATA_FALLBACK) throw error;
        // Keep local update fallback.
      }

      if (serverSynced) {
        setData((d) => ({
          ...d,
          [key]: d[key].map((x) => {
            if (String(x.id) !== String(id)) return x;
            if (key === 'lessons') {
              return { ...x, ...changes, name: normalizeLessonTitle(changes.name, changes.order) };
            }
            if (key === 'subjects') {
              return { ...x, ...changes, icon: inferSubjectIcon(changes.name || x.name) };
            }
            return { ...x, ...changes };
          }),
        }));
        debouncedSync();
        return;
      }

      setData((d) => ({
        ...d,
        [key]: d[key].map((x) => {
          if (String(x.id) !== String(id)) return x;
          if (key === 'lessons') {
            return { ...x, ...changes, name: normalizeLessonTitle(changes.name, changes.order) };
          }
          if (key === 'subjects') {
            return { ...x, ...changes, icon: inferSubjectIcon(changes.name || x.name) };
          }
          return { ...x, ...changes };
        }),
      }));
    },
    remove: async (id) => {
      const token = localStorage.getItem('qm_token');
      const shouldUseServer = isServerToken(token);
      let serverSynced = false;
      try {
        if (key === 'faculties') { await adminDataAPI.removeFaculty(id); serverSynced = true; }
        if (key === 'years') { await adminDataAPI.removeYear(id); serverSynced = true; }
        if (key === 'semesters') { await adminDataAPI.removeSemester(id); serverSynced = true; }
        if (key === 'subjects') { await adminDataAPI.removeSubject(id); serverSynced = true; }
        if (key === 'lessons') { await adminDataAPI.removeLesson(id); serverSynced = true; }
        if (key === 'questions') { await adminDataAPI.removeQuestion(id); serverSynced = true; }
      } catch (error) {
        if (shouldUseServer || !ENABLE_LOCAL_DATA_FALLBACK) throw error;
        // Keep local delete fallback.
      }

      if (serverSynced) {
        setData((d) => ({ ...d, [key]: d[key].filter((x) => String(x.id) !== String(id)) }));
        debouncedSync();
        return;
      }

      setData((d) => ({ ...d, [key]: d[key].filter((x) => String(x.id) !== String(id)) }));
    },
  });

  return (
    <DataContext.Provider value={{
      data,
      setData,
      realtimeStatus,
      syncFromServer,
      faculties: crud('faculties'),
      years:     crud('years'),
      semesters: crud('semesters'),
      subjects:  crud('subjects'),
      lessons:   crud('lessons'),
      questions: crud('questions'),
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);