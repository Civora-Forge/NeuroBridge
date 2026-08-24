import React from "react";

export function SupportToolCard({ children, className = "" }) {
  return <section className={`support-tool-card ${className}`.trim()}>{children}</section>;
}

export function SupportToolNotice({ children, className = "" }) {
  return <p className={`support-tool-notice ${className}`.trim()}>{children}</p>;
}

export default function SupportToolLayout({ title, description, progress, status, notice, actions, completion, rating, children, className = "" }) {
  return (
    <main className={`support-tool-page support-tool-layout ${className}`.trim()}>
      {(title || description) && <header className="support-tool-header"><h1>{title}</h1>{description && <p>{description}</p>}</header>}
      {(progress || status) && <div className="support-tool-layout-status">{progress}{status}</div>}
      {children}
      {(completion || rating) && <section className="support-tool-completion">{completion}{rating}</section>}
      {notice && <SupportToolNotice>{notice}</SupportToolNotice>}
      {actions && <div className="support-tool-actions">{actions}</div>}
    </main>
  );
}
