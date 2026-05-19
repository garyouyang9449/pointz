import { Link, Outlet } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppDataProvider } from "./AppDataContext";

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <AppDataProvider>
      <div className="app">
        <header className="header">
          <div className="header-row">
            <div className="header-left">
              <h1>
                <Link to="/" className="brand-link">
                  <span className="logo">●</span> Pointz
                </Link>
              </h1>
            </div>
            {user && (
              <div className="user-badge">
                <Link
                  to="/profile"
                  className="profile-icon-link"
                  aria-label="Profile"
                  title="Profile"
                >
                  <svg
                    className="profile-icon"
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
                  </svg>
                </Link>
                <button type="button" className="btn-link" onClick={logout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <Outlet />
      </div>
    </AppDataProvider>
  );
}
