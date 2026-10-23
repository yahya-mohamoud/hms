import { PageTitle, Card, SectionHeading, Loading, ErrorPanel, Empty, Badge, Field, Modal, Metric } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { post, patch, api } from "../../lib/api";
import { today, shiftMonth, shiftDay, guestName, dateLabel, money, statusLabels } from "../../lib/domain";
import { type Reservation, type Room, type Guest, type Stay } from "../../types";
import { Plus, ChevronLeft, ChevronRight, Search, X, UserRound, Check, Phone, Mail, MapPin, IdCard } from "lucide-react";
import { useState, useMemo, type FormEvent } from "react";

export function ReservationsPage({
  openCheckIn,
  roomForReservation,
  onReservationRoomUsed,
}: {
  openCheckIn: (r: Reservation) => void;
  roomForReservation: Room | null;
  onReservationRoomUsed: () => void;
}) {
  const [mode, setMode] = useState<"day" | "month">("day"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Reservation | null>(null),
    [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [canceling, setCanceling] = useState<Reservation | null>(null);
  const [guestNameInput, setGuestNameInput] = useState(""),
    [guestPhoneInput, setGuestPhoneInput] = useState(""),
    [existingGuest, setExistingGuest] = useState<Guest | null>(null);
  const from = mode === "month" ? `${month}-01` : today(),
    to =
      mode === "month" ? shiftMonth(month, 1) + "-01" : shiftDay(today(), 31);
  const {
    data: reservations,
    loading,
    error,
    reload,
  } = useLoad<Reservation[]>(`/reservations?from=${from}&to=${to}`);
  const { data: rooms } = useLoad<Room[]>("/rooms");
  const lookupQuery = [guestNameInput, guestPhoneInput]
    .filter(Boolean)
    .join(" ")
    .trim();
  const { data: guestMatches } = useLoad<Guest[]>(
    lookupQuery.length >= 2
      ? `/guests?q=${encodeURIComponent(lookupQuery)}`
      : null,
    [lookupQuery],
  );
  const filtered = useMemo(
    () =>
      reservations?.filter((r) =>
        `${guestName(r.guest)} ${r.confirmationCode} ${r.groupName ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [reservations, query],
  );
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const guestText = guestNameInput.trim().split(/\s+/);
    try {
      await post("/reservations", {
        guestId: existingGuest?.id,
        guest: existingGuest
          ? undefined
          : {
              firstName: guestText[0],
              lastName: guestText.slice(1).join(" ") || "Guest",
              phone: guestPhoneInput || undefined,
            },
        source: f.get("source"),
        arrivalDate: f.get("arrival"),
        departureDate: f.get("departure"),
        roomId: f.get("room") || undefined,
        roomType: f.get("roomType") || undefined,
        nightlyRate: Number(f.get("rate")),
        depositAmount: Number(f.get("deposit") || 0),
        depositMethod: f.get("depositMethod"),
        adults: Number(f.get("adults") || 1),
        groupName: f.get("groupName") || undefined,
        groupCode: f.get("groupName")
          ? String(f.get("groupName")).toUpperCase().replaceAll(" ", "-")
          : undefined,
      });
      form.reset();
      setGuestNameInput("");
      setGuestPhoneInput("");
      setExistingGuest(null);
      onReservationRoomUsed();
      reload();
      window.dispatchEvent(
        new CustomEvent("hms:toast", { detail: "Reservation created" }),
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("hms:toast", {
          detail:
            err instanceof Error ? err.message : "Could not create reservation",
        }),
      );
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="FRONT DESK"
        title="Reservations"
        subtitle="Manage phone bookings, walk-ins and group stays."
        action={
          <button
            className="primary-button"
            onClick={() =>
              document
                .getElementById("new-reservation")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Plus size={16} /> New reservation
          </button>
        }
      />
      <div className="toolbar">
        <div className="segmented">
          <button
            className={mode === "day" ? "selected" : ""}
            onClick={() => setMode("day")}
          >
            Daily
          </button>
          <button
            className={mode === "month" ? "selected" : ""}
            onClick={() => setMode("month")}
          >
            Monthly board
          </button>
        </div>
        <div className="month-control">
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft size={17} />
          </button>
          <strong>
            {new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </strong>
          <button
            className="icon-button"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="Search guest or group"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {mode === "month" && rooms && filtered && (
        <MonthlyBoard
          rooms={rooms}
          reservations={filtered.filter(
            (r) => !["CANCELLED", "NO_SHOW"].includes(r.status),
          )}
          month={month}
          onGuest={setSelectedGuest}
        />
      )}
      {mode === "day" && (
        <Card className="table-card">
          <SectionHeading
            title="Reservation list"
            meta={`${filtered?.length ?? 0} upcoming stays`}
          />
          {loading ? (
            <Loading />
          ) : !filtered ? (
            <ErrorPanel message={error} />
          ) : filtered.length === 0 ? (
            <Empty
              title="No reservations in this period"
              copy="Create a reservation to get started."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Dates</th>
                    <th>Room</th>
                    <th>Source</th>
                    <th>Deposit</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{guestName(r.guest)}</strong>
                        <small>
                          {r.confirmationCode}
                          {r.groupName ? ` · ${r.groupName}` : ""}
                          {r.cancellationNote ? ` · ${r.cancellationNote}` : ""}
                        </small>
                      </td>
                      <td>
                        {dateLabel(r.arrivalDate)} –{" "}
                        {dateLabel(r.departureDate)}
                      </td>
                      <td>
                        {r.room?.number
                          ? `Room ${r.room.number}`
                          : (r.roomType ?? "Unassigned")}
                      </td>
                      <td>
                        <span className="source-label">
                          {r.source.replace("_", " ")}
                        </span>
                      </td>
                      <td>{money(r.depositAmount)}</td>
                      <td>
                        <Badge value={r.status} />
                      </td>
                      <td>
                        {["CONFIRMED", "PENDING"].includes(r.status) ? (
                          <div className="reservation-actions">
                            <button
                              className="small-button"
                              onClick={() => openCheckIn(r)}
                            >
                              Check in
                            </button>
                            <button
                              className="icon-button"
                              title="Cancel reservation"
                              onClick={() => setCanceling(r)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <Card className="create-res-card" id="new-reservation">
        <SectionHeading
          title="Create a reservation"
          meta="Phone, walk-in, or group booking"
        />
        <form className="form-grid" onSubmit={create}>
          <Field label="Guest name">
            <input
              name="guest"
              placeholder="Full name"
              required
              value={guestNameInput}
              onChange={(e) => {
                setGuestNameInput(e.target.value);
                setExistingGuest(null);
              }}
            />
          </Field>
          <Field label="Phone">
            <input
              name="phone"
              placeholder="Phone number"
              value={guestPhoneInput}
              onChange={(e) => {
                setGuestPhoneInput(e.target.value);
                setExistingGuest(null);
              }}
            />
          </Field>
          {existingGuest ? (
            <div className="guest-match selected">
              <UserRound size={16} />
              <span>
                <strong>
                  Using existing guest: {guestName(existingGuest)}
                </strong>
                <small>
                  {existingGuest.phone || "No phone on file"} · no duplicate
                  profile will be created
                </small>
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => setExistingGuest(null)}
              >
                Change
              </button>
            </div>
          ) : (
            !!guestMatches?.length && (
              <div className="guest-match-list">
                <strong>
                  Possible existing guests — select one to reuse their profile
                </strong>
                {guestMatches.slice(0, 4).map((g) => (
                  <button
                    type="button"
                    className="guest-match-option"
                    key={g.id}
                    onClick={() => {
                      setExistingGuest(g);
                      setGuestNameInput(guestName(g));
                      setGuestPhoneInput(g.phone ?? "");
                    }}
                  >
                    <span>
                      <b>{guestName(g)}</b>
                      <small>
                        {g.phone || "No phone on file"}
                        {g.nationality ? ` · ${g.nationality}` : ""}
                      </small>
                    </span>
                    <span className="text-button">Use profile</span>
                  </button>
                ))}
              </div>
            )
          )}
          <Field label="Booking source">
            <select name="source">
              <option value="PHONE">Phone booking</option>
              <option value="WALK_IN">Walk-in</option>
              <option value="GROUP">Group booking</option>
            </select>
          </Field>
          <Field label="Group name (optional)">
            <input name="groupName" placeholder="e.g. Regional workshop" />
          </Field>
          <Field label="Arrival">
            <input name="arrival" type="date" defaultValue={today()} required />
          </Field>
          <Field label="Departure">
            <input
              name="departure"
              type="date"
              defaultValue={shiftDay(today(), 1)}
              required
            />
          </Field>
          <Field label="Room (optional)">
            <select name="room" defaultValue={roomForReservation?.id ?? ""}>
              <option value="">Assign later</option>
              {rooms?.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.number} · {r.type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Room type">
            <input name="roomType" placeholder="Standard, twin…" />
          </Field>
          <Field label="Nightly rate">
            <input
              name="rate"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                roomForReservation ? Number(roomForReservation.baseRate) : 0
              }
              required
            />
          </Field>
          <Field label="Deposit received">
            <input
              name="deposit"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
            />
          </Field>
          <Field label="Deposit method">
            <select name="depositMethod">
              <option value="CASH">Cash</option>
              <option value="COOPAY_EBIRR">Coopay Ebirr</option>
              <option value="EBIRR_KAAFI">Ebirr Kaafi</option>
              <option value="CBE_BANK">CBE Bank</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Adults">
            <input name="adults" type="number" min="1" defaultValue="1" />
          </Field>
          <div className="form-actions">
            <button className="primary-button">
              <Plus size={16} /> Save reservation
            </button>
          </div>
        </form>
      </Card>
      {reservations?.some((r) =>
        ["CONFIRMED", "PENDING"].includes(r.status),
      ) && (
        <Card className="edit-res-card">
          <SectionHeading
            title="Edit a reservation"
            meta="Change dates, room assignment, or deposit details"
          />
          <Field label="Select reservation">
            <select
              value=""
              onChange={(e) =>
                setEditing(
                  reservations.find((r) => r.id === e.target.value) ?? null,
                )
              }
            >
              <option value="">Choose a reservation to edit</option>
              {reservations
                .filter((r) => ["CONFIRMED", "PENDING"].includes(r.status))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.confirmationCode} · {guestName(r.guest)} ·{" "}
                    {dateLabel(r.arrivalDate)}
                  </option>
                ))}
            </select>
          </Field>
        </Card>
      )}
      {editing && (
        <EditReservationModal
          reservation={editing}
          rooms={rooms ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {selectedGuest && (
        <GuestDetailsModal
          guest={selectedGuest}
          onClose={() => setSelectedGuest(null)}
        />
      )}
      {canceling && (
        <CancelReservationModal
          reservation={canceling}
          onClose={() => setCanceling(null)}
          onCancelled={() => {
            setCanceling(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export function CancelReservationModal({
  reservation,
  onClose,
  onCancelled,
}: {
  reservation: Reservation;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function cancel(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/reservations/${reservation.id}/cancel`, {
        note: note.trim() || undefined,
      });
      window.dispatchEvent(
        new CustomEvent("hms:toast", {
          detail: `Reservation ${reservation.confirmationCode} cancelled`,
        }),
      );
      onCancelled();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel reservation",
      );
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Cancel reservation"
      subtitle={`${guestName(reservation.guest)} · ${reservation.confirmationCode}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={cancel}>
        <div className="card-notice danger">
          <strong>Confirm reservation cancellation</strong>Are you sure you want
          to cancel reservation <strong>{reservation.confirmationCode}</strong>{" "}
          for {guestName(reservation.guest)} (
          {dateLabel(reservation.arrivalDate)} –{" "}
          {dateLabel(reservation.departureDate)})? Any assigned room will be
          released immediately.
        </div>
        <Field label="Cancellation note (optional)">
          <input
            placeholder="e.g. Guest called to cancel, flight delay, schedule change"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </Field>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            Keep reservation
          </button>
          <button
            type="submit"
            className="primary-button danger-button"
            disabled={busy}
          >
            <X size={16} />
            {busy ? "Cancelling…" : "Confirm cancellation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function EditReservationModal({
  reservation,
  rooms,
  onClose,
  onSaved,
}: {
  reservation: Reservation;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await patch(`/reservations/${reservation.id}`, {
        arrivalDate: f.get("arrival"),
        departureDate: f.get("departure"),
        roomId: f.get("room") || null,
        nightlyRate: Number(f.get("rate")),
        depositAmount: Number(f.get("deposit")),
        depositMethod: f.get("depositMethod"),
        notes: f.get("notes") || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update reservation");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Edit reservation"
      subtitle={`${guestName(reservation.guest)} · ${reservation.confirmationCode}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid two">
          <Field label="Arrival">
            <input
              name="arrival"
              type="date"
              defaultValue={reservation.arrivalDate.slice(0, 10)}
              required
            />
          </Field>
          <Field label="Departure">
            <input
              name="departure"
              type="date"
              defaultValue={reservation.departureDate.slice(0, 10)}
              required
            />
          </Field>
          <Field label="Room">
            <select name="room" defaultValue={reservation.roomId ?? ""}>
              <option value="">Unassigned</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {r.type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nightly rate">
            <input
              name="rate"
              type="number"
              min="0"
              step="0.01"
              defaultValue={Number(reservation.nightlyRate)}
              required
            />
          </Field>
          <Field label="Deposit">
            <input
              name="deposit"
              type="number"
              min="0"
              step="0.01"
              defaultValue={Number(reservation.depositAmount)}
            />
          </Field>
          <Field label="Deposit method">
            <select
              name="depositMethod"
              defaultValue={reservation.depositMethod ?? "CASH"}
            >
              {reservation.depositMethod &&
                ![
                  "CASH",
                  "COOPAY_EBIRR",
                  "EBIRR_KAAFI",
                  "CBE_BANK",
                  "OTHER",
                ].includes(reservation.depositMethod) && (
                  <option value={reservation.depositMethod}>
                    Previous method ·{" "}
                    {reservation.depositMethod.replaceAll("_", " ")}
                  </option>
                )}
              <option value="CASH">Cash</option>
              <option value="COOPAY_EBIRR">Coopay Ebirr</option>
              <option value="EBIRR_KAAFI">Ebirr Kaafi</option>
              <option value="CBE_BANK">CBE Bank</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Notes">
            <input
              name="notes"
              defaultValue=""
              placeholder="Reservation notes"
            />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={busy}>
            <Check size={16} />
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function GuestDetailsModal({
  guest,
  onClose,
}: {
  guest: Guest;
  onClose: () => void;
}) {
  const { data, loading, error } = useLoad<any>(`/guests/${guest.id}`, [
    guest.id,
  ]);
  return (
    <Modal
      title={guestName(guest)}
      subtitle="Guest profile and stay history"
      onClose={onClose}
      wide
    >
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorPanel message={error} />
      ) : (
        <div className="guest-detail-body">
          <div className="guest-detail-grid">
            <div className="guest-detail-item">
              <Phone size={15} />
              <span>
                <small>Phone</small>
                <strong>{data.phone || "Not provided"}</strong>
              </span>
            </div>
            <div className="guest-detail-item">
              <Mail size={15} />
              <span>
                <small>Email</small>
                <strong>{data.email || "Not provided"}</strong>
              </span>
            </div>
            <div className="guest-detail-item">
              <MapPin size={15} />
              <span>
                <small>Nationality</small>
                <strong>{data.nationality || "Not provided"}</strong>
              </span>
            </div>
            <div className="guest-detail-item">
              <IdCard size={15} />
              <span>
                <small>ID details</small>
                <strong>
                  {[data.idType?.replaceAll("_", " "), data.idNumber]
                    .filter(Boolean)
                    .join(" · ") || "Not provided"}
                </strong>
              </span>
            </div>
          </div>
          {data.insights && (
            <div className="guest-detail-stats">
              <Metric label="Total stays" value={data.insights.totalStays} />
              <Metric label="Total nights" value={data.insights.totalNights} />
              <Metric
                label="Total spent"
                value={money(data.insights.totalSpent)}
              />
              <Metric
                label="Last stay"
                value={dateLabel(data.insights.lastStayDate, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            </div>
          )}
          {(data.preferences || data.notes) && (
            <div className="guest-notes">
              <strong>Preferences and notes</strong>
              <p>{data.preferences || "No preferences saved."}</p>
              {data.notes && <p>{data.notes}</p>}
            </div>
          )}
          <SectionHeading
            title="Stay history"
            meta={`${data.stays?.length ?? 0} stays`}
          />
          {data.stays?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stays.map((stay: any) => (
                    <tr key={stay.id}>
                      <td>Room {stay.room.number}</td>
                      <td>
                        {dateLabel(stay.checkInAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td>
                        {dateLabel(stay.checkOutAt ?? stay.expectedCheckOut, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td>
                        <Badge value={stay.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No completed stays yet"
              copy="Past and current stays will appear here."
            />
          )}
        </div>
      )}
    </Modal>
  );
}

export function MonthlyBoard({
  rooms,
  reservations,
  month,
  onGuest,
}: {
  rooms: Room[];
  reservations: Reservation[];
  month: string;
  onGuest: (guest: Guest) => void;
}) {
  const count = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const days = Array.from({ length: count }, (_, i) => i + 1);
  return (
    <Card className="month-board-card">
      <div className="month-board-scroll">
        <table className="month-board">
          <thead>
            <tr>
              <th>Room</th>
              {days.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <th>
                  {room.number}
                  <small>{room.type}</small>
                </th>
                {days.map((d) => {
                  const date = `${month}-${String(d).padStart(2, "0")}`;
                  const res = reservations.find(
                    (r) =>
                      r.roomId === room.id &&
                      r.arrivalDate.slice(0, 10) <= date &&
                      r.departureDate.slice(0, 10) > date,
                  );
                  return (
                    <td key={d}>
                      {res && (
                        <button
                          type="button"
                          className={`board-stay ${res.source.toLowerCase()}`}
                          title={`Open ${guestName(res.guest)} · ${res.confirmationCode}`}
                          onClick={() => onGuest(res.guest)}
                          aria-label={`View ${guestName(res.guest)} guest details`}
                        >
                          {res.arrivalDate.slice(0, 10) === date
                            ? guestName(res.guest)
                            : "·"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="board-legend">
        <span>
          <i className="board-swatch confirmed" />
          Reserved
        </span>
        <span>
          <i className="board-swatch walk-in" />
          Walk-in
        </span>
        <span>Click a guest name in the board to view guest details</span>
      </div>
    </Card>
  );
}

export function CheckInModal({
  reservation,
  initialRoomId,
  onClose,
  onSave,
}: {
  reservation?: Reservation;
  initialRoomId?: string;
  onClose: () => void;
  onSave: (a: () => Promise<unknown>, s: string) => void;
}) {
  const { data: rooms } = useLoad<Room[]>("/rooms");
  const [roomId, setRoomId] = useState(
    reservation?.roomId ?? initialRoomId ?? "",
  );
  const [image, setImage] = useState<File | null>(null);
  const { data: freeRooms } = useLoad<Room[]>("/rooms");
  const available =
    freeRooms?.filter(
      (r) => !["OCCUPIED", "DIRTY", "OUT_OF_ORDER"].includes(r.status),
    ) ?? [];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSave(async () => {
      const result = await post<{ stay: Stay; guest: Guest }>(
        "/stays/check-in",
        {
          reservationId: reservation?.id,
          guestId: reservation?.guest.id,
          guest: reservation
            ? undefined
            : {
                firstName: form.get("firstName"),
                lastName: form.get("lastName"),
                phone: form.get("phone"),
              },
          roomId,
          expectedCheckOut: form.get("departure"),
          nightlyRate: Number(form.get("rate") || 0),
          adults: Number(form.get("adults") || 1),
          idType: form.get("idType") || undefined,
          idNumber: form.get("idNumber") || undefined,
        },
      );
      if (image) {
        const data = new FormData();
        data.set("image", image);
        data.set("documentType", String(form.get("idType") || "OTHER"));
        try {
          await api(`/guests/${result.guest.id}/documents`, {
            method: "POST",
            body: data,
          });
        } catch {
          window.dispatchEvent(
            new CustomEvent("hms:toast", {
              detail:
                "Check-in is complete, but the ID photo did not upload. Retry it from the guest profile when storage is available.",
            }),
          );
        }
      }
      return result;
    }, "Guest checked in");
  }
  return (
    <Modal
      title="Check in guest"
      subtitle={
        reservation
          ? `${guestName(reservation.guest)} · ${reservation.confirmationCode}`
          : "Walk-in guest"
      }
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        {!reservation && (
          <div className="form-grid two">
            <Field label="First name">
              <input name="firstName" required />
            </Field>
            <Field label="Last name">
              <input name="lastName" required />
            </Field>
            <Field label="Phone">
              <input name="phone" />
            </Field>
          </div>
        )}
        <Field label="Assign room">
          <select
            required
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            <option value="">Choose a room</option>
            {available.map((r) => (
              <option value={r.id} key={r.id}>
                {r.number} · {r.type} · {statusLabels[r.status]}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid two">
          <Field label="Expected departure">
            <input
              name="departure"
              type="date"
              defaultValue={
                reservation?.departureDate.slice(0, 10) ?? shiftDay(today(), 1)
              }
              required
            />
          </Field>
          <Field label="Nightly rate">
            <input
              name="rate"
              type="number"
              min="0"
              step="0.01"
              defaultValue={Number(
                reservation?.nightlyRate ??
                  rooms?.find((r) => r.id === roomId)?.baseRate ??
                  0,
              )}
              required
            />
          </Field>
          <Field label="Adults">
            <input name="adults" type="number" min="1" defaultValue="1" />
          </Field>
          <Field label="ID type">
            <select name="idType">
              <option value="">Choose type</option>
              <option value="NATIONAL_ID">National ID</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVERS_LICENSE">Driver's license</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="ID number">
            <input name="idNumber" />
          </Field>
          <Field label="ID photo (private)">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <div className="privacy-note">
          <span className="lock-dot" /> ID photos are compressed before private
          storage. Access is limited to authorized staff.
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button">
            <Check size={16} /> Complete check-in
          </button>
        </div>
      </form>
    </Modal>
  );
}
