import { useEffect, useState, type ReactNode } from "react";
import { useAppData } from "./AppDataContext";
import { useAuth } from "./auth/AuthContext";

type BrowserPermission = "granted" | "denied" | "prompt" | "unknown";

/**
 * Renders a full-screen "Location access required" page in place of the rest
 * of the app whenever the signed-in user's stored preference says they have
 * denied location consent. The user can re-enable consent here; on a
 * successful browser permission grant, AppDataContext PATCHes the server back
 * to "granted" and this guard unmounts, restoring access to the app.
 *
 * Why the Permissions API: a user who previously blocked location for this
 * origin will see `getCurrentPosition` fail synchronously with
 * PERMISSION_DENIED, with no native prompt — clicking the "Re-enable" button
 * would otherwise feel like a no-op. We query the permission state up front
 * (and subscribe to changes) so we can show a distinct "blocked by browser"
 * message and instructions before the user clicks, then automatically pick
 * up the change the moment they flip the site permission in browser settings.
 */
export function LocationConsentGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { locStatus, requestLocation } = useAppData();

  // Defensive optional chaining on `preferences`: a previously-cached user
  // from before this field existed may have `preferences === undefined` on
  // the first render after deploy. AuthContext refreshes the cache from
  // /auth/me on boot, so this only matters for that initial paint.
  const consent = user?.preferences?.locationConsent ?? "granted";

  const [browserPermission, setBrowserPermission] =
    useState<BrowserPermission>("unknown");
  const [attempted, setAttempted] = useState(false);

  // Query the browser's site-level geolocation permission so we can
  // distinguish "browser will prompt" from "browser will silently reject".
  // Safari < 16 doesn't implement Permissions API for geolocation; we fall
  // back to "unknown" and rely on attempt-time error feedback there.
  useEffect(() => {
    if (consent !== "denied") return;
    if (typeof navigator === "undefined" || !navigator.permissions) return;

    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (status && !cancelled) {
        setBrowserPermission(status.state as BrowserPermission);
      }
    };

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        setBrowserPermission(s.state as BrowserPermission);
        s.addEventListener("change", onChange);
      })
      .catch(() => {
        // Some browsers (older Safari) reject geolocation queries entirely.
        if (!cancelled) setBrowserPermission("unknown");
      });

    return () => {
      cancelled = true;
      if (status) status.removeEventListener("change", onChange);
    };
  }, [consent]);

  if (consent !== "denied") {
    return <>{children}</>;
  }

  const isRequesting = locStatus === "requesting";
  const browserBlocked = browserPermission === "denied";
  // Treat as "attempt failed" if either: we tried and the watcher reports
  // denied, or the Permissions API tells us the browser will reject.
  const reEnableFailed =
    browserBlocked || (attempted && locStatus === "denied");

  const onReEnable = () => {
    setAttempted(true);
    requestLocation();
  };

  // Button label reflects current state so the click feels alive even when
  // the underlying getCurrentPosition call is async (or rejected silently).
  let buttonLabel = "Re-enable location sharing";
  if (isRequesting) buttonLabel = "Requesting location…";
  else if (attempted && !reEnableFailed) buttonLabel = "Try again";

  return (
    <main className="layout layout-single">
      <section className="panel results consent-required">
        <h2>Location access required</h2>
        <p>
          Pointz uses your location to recommend the best card for where you
          are. We need your permission to access your device's location before
          you can continue.
        </p>

        {browserBlocked ? (
          <div className="status error">
            <strong>Your browser has blocked location for this site.</strong>
            <br />
            Clicking the button below won't prompt you — you must first allow
            location in your browser's site settings, then return here.
            <ul className="muted small" style={{ marginTop: 8 }}>
              <li>
                Chrome / Edge: click the lock icon in the address bar →
                <em> Site settings</em> → set <em>Location</em> to{" "}
                <em>Allow</em>, then reload.
              </li>
              <li>
                Safari: <em>Safari → Settings → Websites → Location</em>, set
                this site to <em>Allow</em>.
              </li>
              <li>
                Firefox: click the lock icon → <em>Clear permission</em> for
                location, then reload.
              </li>
            </ul>
          </div>
        ) : null}

        <div className="consent-actions">
          <button
            type="button"
            className="btn primary"
            onClick={onReEnable}
            disabled={isRequesting}
          >
            {buttonLabel}
          </button>
        </div>

        {!browserBlocked && reEnableFailed ? (
          <div className="status error">
            We couldn't get your location. Your browser may have blocked it.
            Open your browser's site settings for Pointz, allow location
            access, then click the button again.
          </div>
        ) : null}

        {!browserBlocked && !reEnableFailed && !isRequesting ? (
          <p className="muted small">
            Your browser will ask for permission when you click the button.
          </p>
        ) : null}
      </section>
    </main>
  );
}
