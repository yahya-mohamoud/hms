import { PageTitle, Card, SectionHeading, Loading, ErrorPanel, Badge, Field, Modal } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { patch, post, api } from "../../lib/api";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

export function TeamPage({
  flash,
  currentUserId,
}: {
  flash: (s: string) => void;
  currentUserId: string;
}) {
  const { data: users, loading, error, reload } = useLoad<any[]>("/users");
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [resettingUser, setResettingUser] = useState<any | null>(null);
  async function setActive(user: any) {
    try {
      await patch(`/users/${user.id}`, { active: !user.active });
      flash(`${user.name} ${user.active ? "deactivated" : "activated"}`);
      reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not update account");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="PROPERTY SETTINGS"
        title="Team access"
        subtitle="Activate or deactivate reception accounts and remove accounts that are no longer needed."
        action={
          <button
            className="primary-button"
            onClick={() =>
              document
                .getElementById("invite-staff")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Plus size={16} /> Add staff member
          </button>
        }
      />
      <Card className="table-card">
        <SectionHeading
          title="Staff accounts"
          meta={`${users?.length ?? 0} accounts`}
        />
        {loading ? (
          <Loading />
        ) : !users ? (
          <ErrorPanel message={error} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Account actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="staff-name">
                        <span className="avatar avatar-guest">
                          {u.name.slice(0, 1)}
                        </span>
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <Badge value={u.role} />
                      {u.role === "HOUSEKEEPING" && (
                        <small className="account-note">
                          Worker account · app sign-in disabled
                        </small>
                      )}
                    </td>
                    <td>
                      <span
                        className={`account-status ${u.active ? "is-active" : "is-inactive"}`}
                      >
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="account-actions">
                        {u.id !== currentUserId && (
                          <button
                            className="small-button"
                            onClick={() => setResettingUser(u)}
                          >
                            Reset password
                          </button>
                        )}
                        {u.role === "ADMIN" ? (
                          <small>Administrator account</small>
                        ) : (
                          <>
                            <button
                              className="secondary-button"
                              onClick={() => setActive(u)}
                            >
                              {u.active ? "Deactivate" : "Activate"}
                            </button>
                            {u.id !== currentUserId && (
                              <button
                                className="small-button danger-button"
                                onClick={() => setDeletingUser(u)}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AdminPasswordSettings flash={flash} />
      <AdminRecoverySettings flash={flash} />
      <Card id="invite-staff">
        <SectionHeading
          title="Add staff member"
          meta="Create staff access for reception or management"
        />
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await post("/users", {
                name: f.get("name"),
                email: f.get("email"),
                password: f.get("password"),
                role: f.get("role"),
              });
              (e.target as HTMLFormElement).reset();
              flash("Staff account created");
              reload();
            } catch (err) {
              flash(
                err instanceof Error
                  ? err.message
                  : "Unable to create staff account",
              );
            }
          }}
        >
          <Field label="Full name">
            <input name="name" required />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required />
          </Field>
          <Field label="Temporary password (10+ characters)">
            <input name="password" type="password" minLength={10} required />
          </Field>
          <Field label="Role">
            <select name="role">
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <div className="form-actions">
            <button className="primary-button">
              <Plus size={16} /> Create account
            </button>
          </div>
        </form>
      </Card>
      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={() => {
            setDeletingUser(null);
            reload();
          }}
        />
      )}
      {resettingUser && (
        <ResetStaffPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSaved={() => {
            setResettingUser(null);
            reload();
            flash(`Password updated for ${resettingUser.name}`);
          }}
        />
      )}
    </>
  );
}

export function AdminPasswordSettings({
  flash,
}: {
  flash: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get("currentPassword") ?? "");
    const newPassword = String(values.get("newPassword") ?? "");
    if (newPassword !== String(values.get("confirmPassword") ?? "")) {
      setError("The new passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Choose a password different from your current password.");
      return;
    }
    setBusy(true);
    try {
      const result = await post<{ message: string }>("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      form.reset();
      flash(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change password",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <SectionHeading
        title="Change my password"
        meta="Change your administrator sign-in password while you are signed in."
      />
      <form className="form-grid" onSubmit={save}>
        <Field label="Current password">
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password (10+ characters)">
          <input
            name="newPassword"
            type="password"
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm new password">
          <input
            name="confirmPassword"
            type="password"
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            required
          />
        </Field>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button className="primary-button" disabled={busy}>
            {busy ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function ResetStaffPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: { id: string; name: string; email: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const values = new FormData(e.currentTarget);
    const password = String(values.get("password") ?? "");
    if (password !== String(values.get("confirmPassword") ?? "")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await patch(`/users/${user.id}`, { password });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Reset staff password"
      subtitle={`${user.name} · ${user.email}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <Field label="New password (10+ characters)">
          <input
            name="password"
            type="password"
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            required
            autoFocus
          />
        </Field>
        <Field label="Confirm new password">
          <input
            name="confirmPassword"
            type="password"
            minLength={10}
            maxLength={200}
            autoComplete="new-password"
            required
          />
        </Field>
        <p className="account-note">
          Tell the staff member their new password privately.
        </p>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Reset password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminRecoverySettings({
  flash,
}: {
  flash: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const values = new FormData(form);
    const recoveryPhrase = String(values.get("recoveryPhrase") ?? "");
    if (recoveryPhrase !== String(values.get("confirmPhrase") ?? "")) {
      setError("The recovery passphrases do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await post<{ message: string }>(
        "/auth/admin/recovery-phrase",
        { currentPassword: values.get("currentPassword"), recoveryPhrase },
      );
      form.reset();
      flash(result.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save recovery passphrase",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <SectionHeading
        title="Administrator password recovery"
        meta="Set this once while signed in; use it if you forget your password."
      />
      <form className="form-grid" onSubmit={save}>
        <Field label="Your current password">
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="Recovery passphrase (12+ characters)">
          <input
            name="recoveryPhrase"
            type="password"
            minLength={12}
            maxLength={200}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm recovery passphrase">
          <input
            name="confirmPhrase"
            type="password"
            minLength={12}
            maxLength={200}
            autoComplete="new-password"
            required
          />
        </Field>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Save recovery passphrase"}
          </button>
        </div>
        <small className="account-note">
          Keep it somewhere private. Receptionists cannot use this recovery
          option.
        </small>
      </form>
    </Card>
  );
}

export function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: any;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      window.dispatchEvent(
        new CustomEvent("hms:toast", {
          detail: `${user.name}'s account deleted`,
        }),
      );
      onDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete staff account",
      );
      setBusy(false);
    }
  }
  return (
    <Modal title="Delete staff account" subtitle={user.name} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="card-notice danger">
          <strong>Permanent account removal</strong>Are you sure you want to
          delete <strong>{user.name}</strong> ({user.email})? This staff account
          will lose access immediately. This action cannot be undone.
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button danger-button"
            disabled={busy}
          >
            <Trash2 size={15} />
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
