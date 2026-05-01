import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-layout">
      <div className="auth-card panel">
        <div className="auth-brand">
          <span className="logo">●</span>
          <span className="auth-brand-name">Pointz</span>
        </div>
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
