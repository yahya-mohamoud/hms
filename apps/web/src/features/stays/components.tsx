import { PageTitle, Loading, ErrorPanel, Card, Empty, Badge, Modal, Field } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { post } from "../../lib/api";
import { guestName, dateLabel, money } from "../../lib/domain";
import { type Stay } from "../../types";
import { Plus, CreditCard, Check } from "lucide-react";
import { useState, type FormEvent } from "react";

export function InHousePage({
  openFolio,
  flash,
}: {
  openFolio: (s: Stay) => void;
  flash: (s: string) => void;
}) {
  const {
    data: stays,
    loading,
    error,
    reload,
  } = useLoad<Stay[]>("/stays/in-house");
  const [checkingOut, setCheckingOut] = useState<Stay | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="GUEST SERVICES"
        title="Guests in-house"
        subtitle="Active stays, folios and room assignments."
        action={
          <button
            className="primary-button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("hms:open-walkin"))
            }
          >
            <Plus size={16} /> Walk-in check-in
          </button>
        }
      />
      {loading ? (
        <Loading />
      ) : !stays ? (
        <ErrorPanel message={error} />
      ) : stays.length === 0 ? (
        <Card>
          <Empty
            title="No guests checked in"
            copy="New arrivals will show up here after check-in."
          />
        </Card>
      ) : (
        <div className="inhouse-grid">
          {stays.map((s) => (
            <Card className="inhouse-card" key={s.id}>
              <div className="inhouse-card-top">
                <div className="avatar avatar-guest">
                  {s.guest.firstName[0]}
                  {s.guest.lastName[0]}
                </div>
                <Badge value="OCCUPIED" />
              </div>
              <h3>{guestName(s.guest)}</h3>
              <span className="inhouse-room">
                Room {s.room.number} · {s.room.type}
              </span>
              <div className="inhouse-dates">
                <div>
                  <span>CHECKED IN</span>
                  <strong>{dateLabel(s.checkInAt)}</strong>
                </div>
                <div>
                  <span>EXPECTED OUT</span>
                  <strong>{dateLabel(s.expectedCheckOut)}</strong>
                </div>
              </div>
              <div className="folio-mini">
                <span>{s.folio?.folioNumber ?? "Folio"} · Balance</span>
                <strong>
                  {money(
                    (s.folio?.items.reduce((n, x) => n + Number(x.amount), 0) ??
                      0) -
                      (s.folio?.payments.reduce(
                        (n, x) => n + Number(x.amount),
                        0,
                      ) ?? 0),
                  )}
                </strong>
              </div>
              <div className="inhouse-actions">
                <button
                  className="secondary-button"
                  onClick={() => openFolio(s)}
                >
                  <CreditCard size={15} /> Folio
                </button>
                <button
                  className="small-button"
                  onClick={() => setCheckingOut(s)}
                >
                  Check out
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {checkingOut && (
        <CheckOutModal
          stay={checkingOut}
          onClose={() => setCheckingOut(null)}
          onCheckedOut={() => {
            setCheckingOut(null);
            reload();
          }}
          openFolio={openFolio}
          flash={flash}
        />
      )}
    </>
  );
}

export function CheckOutModal({
  stay,
  onClose,
  onCheckedOut,
  openFolio,
  flash,
}: {
  stay: Stay;
  onClose: () => void;
  onCheckedOut: () => void;
  openFolio: (s: Stay) => void;
  flash: (s: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const charges =
    stay.folio?.items.reduce((n, x) => n + Number(x.amount), 0) ?? 0;
  const paid =
    stay.folio?.payments.reduce((n, x) => n + Number(x.amount), 0) ?? 0;
  const balance = charges - paid;
  const hasOutstanding = balance > 0;
  async function checkout(e: FormEvent) {
    e.preventDefault();
    if (hasOutstanding) {
      setError(
        `Outstanding balance of ${money(balance)} must be settled before checkout.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post(`/stays/${stay.id}/check-out`, {
        notes: notes.trim() || undefined,
      });
      flash(
        `${guestName(stay.guest)} checked out · Room ${stay.room.number} marked dirty`,
      );
      onCheckedOut();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not complete check-out",
      );
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Guest check-out"
      subtitle={`${guestName(stay.guest)} · Room ${stay.room.number}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={checkout}>
        {hasOutstanding ? (
          <div className="card-notice warning">
            <strong>Outstanding balance: {money(balance)}</strong>This stay
            cannot be checked out until the folio is settled to zero. Please
            record payment before finalizing departure.
          </div>
        ) : (
          <div className="card-notice info">
            <strong>Folio is settled in full</strong>Room {stay.room.number}{" "}
            will be marked <strong>Dirty</strong>; staff can mark it free from
            the room board when it is ready.
          </div>
        )}
        <Field label="Departure notes (optional)">
          <input
            placeholder="e.g. Keys returned, luggage stored, minibar verified"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            autoFocus={!hasOutstanding}
          />
        </Field>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          {hasOutstanding ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onClose();
                  openFolio(stay);
                }}
              >
                <CreditCard size={15} /> Settle folio
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                <Check size={16} />
                {busy ? "Checking out…" : "Complete check-out"}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
