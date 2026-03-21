import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import Navbar from '../components/Navbar';

export default function ProfilePage() {
  const { user } = useAuth();
  const { data } = useData();
  const initials = user?.name?user.name.split(' ').map(w=>w[0]).slice(-2).join('').toUpperCase():'U';
  return (
    <div className="app-wrapper"><Navbar/>
      <div className="page-content">
        <div className="profile-head">
          <div className="profile-avatar">{initials}</div>
          <div>
            <div className="page-title">{user?.name}</div>
            <div style={{fontSize:'.875rem',color:'var(--muted)',marginTop:4}}>@{user?.username}</div>
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <span className="badge badge-blue">Sinh viên</span>
              <span className="badge badge-green">Hoạt động</span>
            </div>
          </div>
        </div>
        <div className="stat-row">
          {[['142','Bài đã làm','↑ +12 tuần này'],['84%','Tỉ lệ đúng',''],['2,840','Tổng điểm','↑ +320'],['18','Chuỗi ngày','🔥']].map(([v,l,c])=>(
            <div key={l} className="stat-card">
              <div className="stat-val">{v}</div>
              <div className="stat-label">{l}</div>
              {c&&<div className="stat-change">{c}</div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:20}}>
          <div className="section-title">Hoạt động gần đây</div>
          <div className="table-wrap">
            {data.lessons.slice(0,5).map((l,i)=>(
              <div key={l.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderBottom:i<4?'1px solid var(--border-soft)':'none'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:'.875rem'}}>{l.name}</div>
                  <div style={{fontSize:'.75rem',color:'var(--muted)',marginTop:2}}>{['Hôm nay','Hôm qua','2 ngày trước','3 ngày trước','Tuần trước'][i]}</div>
                </div>
                <span className="badge badge-green">{[92,85,78,90,74][i]}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
