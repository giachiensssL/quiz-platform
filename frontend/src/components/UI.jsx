import { useState, useEffect } from 'react';

export function Button({ children, variant = 'primary', size = '', full, icon, loading, ...props }) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', full ? 'btn-full' : ''].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading && <span style={{display:'inline-block',width:13,height:13,border:'2px solid currentColor',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite'}} />}
      {!loading && icon && <span>{icon}</span>}
      {children}
    </button>
  );
}

export function Input({ label, error, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input className={`form-input${error ? ' error' : ''}`} {...props} />
      {error && <span className="form-error">⚠ {error}</span>}
    </div>
  );
}

export function Select({ label, options = [], error, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select className={`form-input${error ? ' error' : ''}`} {...props}>
        <option value="">-- Chọn --</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span className="form-error">⚠ {error}</span>}
    </div>
  );
}

export function Textarea({ label, error, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <textarea className={`form-input${error ? ' error' : ''}`} rows={3} {...props} />
      {error && <span className="form-error">⚠ {error}</span>}
    </div>
  );
}

export function Badge({ children, color = 'blue' }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}

export function Modal({ open, title, children, footer, onClose }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-box">
        <div className="flex items-center justify-between" style={{marginBottom:16}}>
          <div className="modal-title">{title}</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--muted)'}}>✕</button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ message, type = '', onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className={`toast ${type}`}>{message}</div>;
}

export function EmptyState({ icon = '📭', text = 'Chưa có dữ liệu' }) {
  return <div className="empty-state"><div className="es-icon">{icon}</div><p>{text}</p></div>;
}

export function Confirm({ open, title, message, onConfirm, onCancel, danger, loading = false }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={<><Button variant="ghost" onClick={onCancel} disabled={loading}>Huỷ</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={loading}>Xác nhận</Button></>}>
      <p style={{color:'var(--text-2)',fontSize:'.9rem'}}>{message}</p>
    </Modal>
  );
}

const s = document.createElement('style');
s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(s);
