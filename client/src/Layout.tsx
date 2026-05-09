import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppDataProvider } from "./AppDataContext";

const PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/wallet", label: "Wallet" }
];

function NavMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const current =
    PAGES.find((p) => p.path === location.pathname) ?? PAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="nav-menu" ref={ref}>
      <button
        type="button"
        className="nav-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {current.label}
        <span className="nav-menu-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul className="nav-menu-list" role="menu">
          {PAGES.map((p) => (
            <li key={p.path} role="none">
              <button
                type="button"
                role="menuitem"
                className={
                  "nav-menu-item" +
                  (p.path === current.path ? " is-active" : "")
                }
                onClick={() => {
                  setOpen(false);
                  if (p.path !== location.pathname) navigate(p.path);
                }}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <AppDataProvider>
      <div className="app">
        <header className="header">
          <div className="header-row">
            <div className="header-left">
              <h1>
                <span className="logo">●</span> Pointz
              </h1>
              <NavMenu />
            </div>
            {user && (
              <div className="user-badge">
                <span className="user-email">{user.email}</span>
                <button type="button" className="btn-link" onClick={logout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
          <p className="tagline">
            Automatically picks the card that earns the most — based on where
            you are.
          </p>
        </header>

        <Outlet />
      </div>
    </AppDataProvider>
  );
}
