import { api, type User } from "../../lib/api";
import { Building2, EyeOff, Eye, ChevronRight } from "lucide-react";
import { useState, type FormEvent } from "react";

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recovering, setRecovering] = useState(false),
    [recoveryPhrase, setRecoveryPhrase] = useState(""),
    [newPassword, setNewPassword] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("hms_token", result.token);
      localStorage.setItem("hms_user", JSON.stringify(result.user));
      onLogin(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>(
        "/auth/admin/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email, recoveryPhrase, newPassword }),
        },
      );
      setRecovering(false);
      setPassword("");
      setRecoveryPhrase("");
      setNewPassword("");
      setError(result.message);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to reset administrator password",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="login-brand">
          <div className="brand-mark">
            <Building2 size={18} />
          </div>{" "}
          Staywell
        </div>
        <div className="art-copy">
          <span className="eyebrow">A CALM START TO EVERY STAY</span>
          <h1>
            Good hospitality
            <br />
            starts right here.
          </h1>
          <p>Your hotel's daily operations, thoughtfully organized.</p>
        </div>
        <div className="art-bottom">
          <span>ROOMS · GUESTS · OPERATIONS</span>
          <span>12 rooms, one clear view.</span>
        </div>
        <div className="art-shape shape-one" />
        <div className="art-shape shape-two" />
      </div>
      <div className="login-form-side">
        <form
          className="login-form"
          onSubmit={recovering ? resetPassword : submit}
        >
          <div className="login-mobile-brand">
            <div className="brand-mark">
              <Building2 size={18} />
            </div>{" "}
            Staywell
          </div>
          <span className="eyebrow">HOTEL TEAM</span>
          <h2>
            {recovering ? "Reset administrator password" : "Welcome back"}
          </h2>
          <p>
            {recovering
              ? "Use the recovery passphrase you set in Team access."
              : "Sign in to continue to the front desk."}
          </p>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {recovering ? (
            <>
              <label>
                Admin recovery passphrase
                <input
                  type="password"
                  autoComplete="off"
                  required
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                />
              </label>
              <label>
                New password (10+ characters)
                <input
                  type="password"
                  minLength={10}
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              Password
              <span className="login-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
          )}
          {error && (
            <div
              className={
                error.includes("reset") ? "form-success" : "form-error"
              }
            >
              {error}
            </div>
          )}
          <button className="primary-button full" disabled={busy}>
            {busy ? "Please wait…" : recovering ? "Reset password" : "Sign in"}
            <ChevronRight size={17} />
          </button>
          {!recovering ? (
            <button
              type="button"
              className="text-button recovery-link"
              onClick={() => {
                setError("");
                setRecovering(true);
              }}
            >
              Forgot administrator password?
            </button>
          ) : (
            <button
              type="button"
              className="text-button recovery-link"
              onClick={() => {
                setError("");
                setRecovering(false);
              }}
            >
              Back to sign in
            </button>
          )}
          <small className="login-foot">
            Receptionist accounts must contact the hotel administrator for
            password help.
          </small>
        </form>
      </div>
    </div>
  );
}
