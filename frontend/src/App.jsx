import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { API_BASE_URL, analyticsAPI } from './api/api';
import LoginPage       from './pages/LoginPage';
import HomePage        from './pages/HomePage';
import YearPage        from './pages/YearPage';
import SemesterPage    from './pages/SemesterPage';
import SubjectPage     from './pages/SubjectPage';
import LessonPage      from './pages/LessonPage';
import QuizPage        from './pages/QuizPage';
import PracticePage    from './pages/PracticePage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage     from './pages/ProfilePage';
import ReviewPage      from './pages/ReviewPage';
import AdminDashboard  from './pages/admin/AdminDashboard';
import './styles/global.css';

function VisitTracker() {
  useEffect(() => {
    const sessionKey = 'qm_visit_session_id';
    const existing = sessionStorage.getItem(sessionKey);
    const sessionId = existing || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (!existing) sessionStorage.setItem(sessionKey, sessionId);

    analyticsAPI.track({ sessionId, path: window.location.pathname }).catch(() => {});

    const heartbeat = window.setInterval(() => {
      analyticsAPI.heartbeat({ sessionId, path: window.location.pathname }).catch(() => {});
    }, 30000);

    const onUnload = () => {
      const payload = JSON.stringify({ sessionId });
      const url = `${API_BASE_URL}/analytics/leave`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      }
    };

    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('beforeunload', onUnload);
      analyticsAPI.leave({ sessionId }).catch(() => {});
    };
  }, []);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <VisitTracker />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/year/:facultyId" element={<ProtectedRoute><YearPage /></ProtectedRoute>} />
            <Route path="/semester/:yearId" element={<ProtectedRoute><SemesterPage /></ProtectedRoute>} />
            <Route path="/subject/:semesterId" element={<ProtectedRoute><SubjectPage /></ProtectedRoute>} />
            <Route path="/lesson/:subjectId" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
            <Route path="/quiz/:lessonId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
            <Route path="/practice" element={<ProtectedRoute><PracticePage /></ProtectedRoute>} />
            <Route path="/practice/:subjectId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/review/:attemptId" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
export default App;
