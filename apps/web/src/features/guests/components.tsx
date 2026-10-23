import { PageTitle, Card, SectionHeading, Loading, Empty, Metric, Badge, Field, Modal } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { api, patch } from "../../lib/api";
import { guestName, money, dateLabel, statusLabels } from "../../lib/domain";
import { type Guest } from "../../types";
import { Search, ChevronRight, FileText, Plus, Check } from "lucide-react";
import { useState, type FormEvent } from "react";

export function GuestsPage({ flash }: { flash: (s: string) => void }) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [version, setVersion] = useState(0),
    [editing, setEditing] = useState(false);
  const { data: guests, loading } = useLoad<Guest[]>(
    `/guests?q=${encodeURIComponent(query)}`,
    [query, version],
  );
  const { data: detail } = useLoad<any>(
    selected ? `/guests/${selected}` : null,
    [selected, version],
  );
  return (
    <>
      <PageTitle
        eyebrow="RELATIONSHIPS"
        title="Guests"
        subtitle="Guest profiles, preferences and stay history."
        action={
          <div className="search-box guest-search">
            <Search size={16} />
            <input
              placeholder="Name, phone, ID number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
      />
      <div className="guest-layout">
        <Card className="guest-list-card">
          <SectionHeading
            title="Guest directory"
            meta={`${guests?.length ?? 0} guests`}
          />
          {loading ? (
            <Loading />
          ) : guests?.length ? (
            <div className="guest-list">
              {guests.map((g) => (
                <button
                  className={`guest-list-item ${selected === g.id ? "selected" : ""}`}
                  onClick={() => setSelected(g.id)}
                  key={g.id}
                >
                  <span className="avatar avatar-guest">
                    {g.firstName[0]}
                    {g.lastName[0]}
                  </span>
                  <span>
                    <strong>{guestName(g)}</strong>
                    <small>{g.phone ?? g.email ?? "No contact details"}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="No guests found"
              copy="Try another name or phone number."
            />
          )}
        </Card>
        <Card className="guest-detail-card">
          {detail ? (
            <>
              <div className="guest-profile-head">
                <div className="avatar avatar-large">
                  {detail.firstName[0]}
                  {detail.lastName[0]}
                </div>
                <div>
                  <h2>{guestName(detail)}</h2>
                  <p>
                    {detail.phone ?? "No phone"}
                    {detail.nationality ? ` · ${detail.nationality}` : ""}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setEditing(true)}
                >
                  Edit profile
                </button>
              </div>
              {detail.insights && (
                <div className="guest-insight-grid">
                  <Metric
                    label="Total stays"
                    value={detail.insights.totalStays}
                  />
                  <Metric
                    label="Total nights"
                    value={detail.insights.totalNights}
                  />
                  <Metric
                    label="Total spent"
                    value={money(detail.insights.totalSpent)}
                  />
                  <Metric
                    label="Last stay"
                    value={dateLabel(detail.insights.lastStayDate)}
                  />
                </div>
              )}
              <div className="guest-info-grid">
                <div>
                  <span>ID document</span>
                  <strong>
                    {detail.idType
                      ? `${statusLabels[detail.idType] ?? detail.idType} · ${detail.idNumber ?? "no number"}`
                      : "Not recorded"}
                  </strong>
                </div>
                <div>
                  <span>Preferences</span>
                  <strong>
                    {detail.preferences ?? "No preferences noted"}
                  </strong>
                </div>
                <div>
                  <span>Notes</span>
                  <strong>{detail.notes ?? "No notes"}</strong>
                </div>
              </div>
              <SectionHeading
                title="Stay history"
                meta={`${detail.stays.length} stays`}
              />
              {detail.stays.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Dates</th>
                        <th>Room</th>
                        <th>Status</th>
                        <th>Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.stays.map((s: any) => (
                        <tr key={s.id}>
                          <td>
                            {dateLabel(s.checkInAt)} –{" "}
                            {dateLabel(s.checkOutAt ?? s.expectedCheckOut)}
                          </td>
                          <td>{s.room.number}</td>
                          <td>
                            <Badge value={s.status} />
                          </td>
                          <td>
                            {money(
                              s.folio?.payments.reduce(
                                (n: number, p: any) => n + Number(p.amount),
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="No stay history yet"
                  copy="Completed visits will appear here."
                />
              )}
              <SectionHeading title="ID documents" />
              {detail.documents.length ? (
                <div className="document-list">
                  {detail.documents.map((doc: any) => (
                    <button
                      className="document-item"
                      key={doc.id}
                      onClick={async () => {
                        try {
                          const { url } = await api<{ url: string }>(
                            `/guests/documents/${doc.id}/url`,
                          );
                          window.open(url, "_blank", "noopener");
                        } catch (e) {
                          flash(
                            e instanceof Error
                              ? e.message
                              : "Unable to open document",
                          );
                        }
                      }}
                    >
                      <FileText size={17} />
                      <span>
                        {statusLabels[doc.documentType] ?? doc.documentType} ·{" "}
                        {Math.round(doc.sizeBytes / 1024)} KB
                      </span>
                      <span>
                        View securely <ChevronRight size={14} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="subtle-copy">
                  No ID image stored for this guest.
                </p>
              )}
              <GuestDocumentUpload
                guestId={detail.id}
                onUploaded={() => setVersion((v) => v + 1)}
              />
            </>
          ) : (
            <Empty
              title="Select a guest"
              copy="Choose a profile to see stay history and guest insights."
            />
          )}
        </Card>
      </div>
      {editing && detail && (
        <GuestEditModal
          guest={detail}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setVersion((x) => x + 1);
            flash("Guest profile updated");
          }}
        />
      )}
    </>
  );
}

export function GuestDocumentUpload({
  guestId,
  onUploaded,
}: {
  guestId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [type, setType] = useState("NATIONAL_ID"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="document-upload"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        setError("");
        const data = new FormData();
        data.set("image", file);
        data.set("documentType", type);
        try {
          await api(`/guests/${guestId}/documents`, {
            method: "POST",
            body: data,
          });
          setFile(null);
          onUploaded();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Unable to upload ID photo",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <SectionHeading
        title="Add an ID photo"
        meta="Private storage · compressed to WebP"
      />
      <div className="form-grid two">
        <Field label="Document type">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="NATIONAL_ID">National ID</option>
            <option value="PASSPORT">Passport</option>
            <option value="DRIVERS_LICENSE">Driver's license</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Photo">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <div className="form-actions">
          <button className="secondary-button" disabled={!file || busy}>
            <Plus size={15} />
            {busy ? "Uploading…" : "Upload ID photo"}
          </button>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
}

export function GuestEditModal({
  guest,
  onClose,
  onSaved,
}: {
  guest: Guest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await patch(`/guests/${guest.id}`, {
        firstName: f.get("firstName"),
        lastName: f.get("lastName"),
        phone: f.get("phone"),
        email: f.get("email") || null,
        nationality: f.get("nationality"),
        idType: f.get("idType") || null,
        idNumber: f.get("idNumber") || null,
        preferences: f.get("preferences") || null,
        notes: f.get("notes") || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update guest");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Edit guest profile"
      subtitle={guestName(guest)}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid two">
          <Field label="First name">
            <input name="firstName" defaultValue={guest.firstName} required />
          </Field>
          <Field label="Last name">
            <input name="lastName" defaultValue={guest.lastName} required />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={guest.phone ?? ""} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={guest.email ?? ""} />
          </Field>
          <Field label="Nationality">
            <input name="nationality" defaultValue={guest.nationality ?? ""} />
          </Field>
          <Field label="ID type">
            <select name="idType" defaultValue={guest.idType ?? ""}>
              <option value="">Not recorded</option>
              <option value="NATIONAL_ID">National ID</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVERS_LICENSE">Driver's license</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="ID number">
            <input name="idNumber" defaultValue={guest.idNumber ?? ""} />
          </Field>
          <Field label="Preferences">
            <input name="preferences" defaultValue={guest.preferences ?? ""} />
          </Field>
          <Field label="Notes" className="wide-field">
            <input name="notes" defaultValue={guest.notes ?? ""} />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={busy}>
            <Check size={16} />
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
