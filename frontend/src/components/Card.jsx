export default function Card({ icon, iconVariant = "", title, sub, badge, badgeVariant = "badge-blue", onClick, children }) {
  return (
    <div className="card" onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}>
      {icon && (
        <div className={`card-icon${iconVariant ? " " + iconVariant : ""}`}>{icon}</div>
      )}
      <div>
        <div className="card-title">{title}</div>
        {sub && <div className="card-sub" style={{ marginTop: 3 }}>{sub}</div>}
      </div>
      {(badge || children) && (
        <div className="card-footer">
          {badge && <span className={`badge ${badgeVariant}`}>{badge}</span>}
          {children}
          <span className="card-arrow">→</span>
        </div>
      )}
    </div>
  );
}
