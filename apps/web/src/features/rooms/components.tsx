import { PageTitle, Loading, ErrorPanel, Card, Empty, Badge, Modal, Field, SectionHeading } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { patch, post } from "../../lib/api";
import { statusLabels, money, guestName } from "../../lib/domain";
import { type Room, type Stay } from "../../types";
import { BedDouble, Trophy, Pencil, Check, DoorOpen, CalendarDays } from "lucide-react";
import { useState, type FormEvent } from "react";

export function RoomsPage({
  flash,
  onChooseRoom,
  canManage,
}: {
  flash: (s: string) => void;
  onChooseRoom: (room: Room) => void;
  canManage: boolean;
}) {
  const { data: rooms, loading, error, reload } = useLoad<Room[]>("/rooms");
  const [filter, setFilter] = useState<
    "ALL" | "FREE" | "OCCUPIED" | "ATTENTION"
  >("ALL");
  const [editing, setEditing] = useState<Room | null>(null);
  async function change(room: Room, status: string) {
    try {
      await patch(`/rooms/${room.id}/status`, { status });
      flash(
        `Room ${room.number} marked ${statusLabels[status]?.toLowerCase()}`,
      );
      reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not update room");
    }
  }
  async function saveRoom(room: Room, values: Record<string, unknown>) {
    await patch(`/rooms/${room.id}`, values);
    setEditing(null);
    flash(
      `Room ${room.number} updated. The room type price applies to every ${String(values.type || room.type)} room.`,
    );
    reload();
  }
  const freeCount =
    rooms?.filter((r) => ["AVAILABLE", "CLEAN", "INSPECTED"].includes(r.status))
      .length ?? 0;
  const occupiedCount =
    rooms?.filter((r) => r.status === "OCCUPIED").length ?? 0;
  const visible =
    rooms?.filter(
      (r) =>
        filter === "ALL" ||
        (filter === "FREE" &&
          ["AVAILABLE", "CLEAN", "INSPECTED"].includes(r.status)) ||
        (filter === "OCCUPIED" && r.status === "OCCUPIED") ||
        (filter === "ATTENTION" &&
          ["DIRTY", "OUT_OF_ORDER"].includes(r.status)),
    ) ?? [];
  const grouped = new Map<string, { title: string; rooms: Room[] }>();
  for (const room of visible) {
    const title = room.type.trim() || "Other";
    const key = title.toLocaleLowerCase();
    const group = grouped.get(key) ?? { title, rooms: [] };
    group.rooms.push(room);
    grouped.set(key, group);
  }
  const roomGroups = Array.from(grouped.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const busiest =
    rooms?.reduce<Room | null>(
      (top, room) =>
        !top || (room.stayCount ?? 0) > (top.stayCount ?? 0) ? room : top,
      null,
    ) ?? null;
  return (
    <>
      <PageTitle
        eyebrow="PROPERTY"
        title="Room board"
        subtitle="See at a glance which rooms are free and which are occupied."
        action={
          <div className="room-count-pill">
            <BedDouble size={15} /> {rooms?.length ?? 12} rooms
          </div>
        }
      />
      {loading ? (
        <Loading />
      ) : !rooms ? (
        <ErrorPanel message={error} />
      ) : (
        <>
          <div className="room-quick-counts">
            <div className="room-count-box free">
              <span>Free rooms</span>
              <strong>{freeCount}</strong>
            </div>
            <div className="room-count-box occupied">
              <span>Occupied rooms</span>
              <strong>{occupiedCount}</strong>
            </div>
            <div className="room-count-box attention">
              <span>Need attention</span>
              <strong>{rooms.length - freeCount - occupiedCount}</strong>
            </div>
          </div>
          <div className="toolbar room-filter-toolbar">
            <div className="segmented room-filter" aria-label="Filter rooms">
              <button
                className={filter === "ALL" ? "selected" : ""}
                onClick={() => setFilter("ALL")}
              >
                All ({rooms.length})
              </button>
              <button
                className={filter === "FREE" ? "selected" : ""}
                onClick={() => setFilter("FREE")}
              >
                Free ({freeCount})
              </button>
              <button
                className={filter === "OCCUPIED" ? "selected" : ""}
                onClick={() => setFilter("OCCUPIED")}
              >
                Occupied ({occupiedCount})
              </button>
              <button
                className={filter === "ATTENTION" ? "selected" : ""}
                onClick={() => setFilter("ATTENTION")}
              >
                Needs attention ({rooms.length - freeCount - occupiedCount})
              </button>
            </div>
          </div>
          <div className="room-legend">
            {[
              "AVAILABLE",
              "OCCUPIED",
              "DIRTY",
              "CLEAN",
              "INSPECTED",
              "OUT_OF_ORDER",
            ].map((s) => (
              <span key={s}>
                <i className={`status-dot dot-${s.toLowerCase()}`} />
                {statusLabels[s]}
              </span>
            ))}
          </div>
          {busiest && (busiest.stayCount ?? 0) > 0 && (
            <div className="busiest-room-note">
              <Trophy size={16} /> Most stays:{" "}
              <strong>Room {busiest.number}</strong>
              <span>{busiest.stayCount} recorded stays</span>
            </div>
          )}
          {roomGroups.length ? (
            roomGroups.map((group) => {
              const representative = group.rooms[0];
              const rate = group.rooms.every(
                (r) => Number(r.baseRate) === Number(representative.baseRate),
              )
                ? money(representative.baseRate)
                : "Mixed";
              return (
                <section
                  className="room-type-section"
                  key={group.title.toLocaleLowerCase()}
                >
                  <div className="room-type-heading">
                    <div>
                      <h2>{group.title} rooms</h2>
                      <small>
                        Nightly rate:{" "}
                        {rate === "Mixed" ? rate : `${rate} / night`}
                      </small>
                    </div>
                    <div className="room-type-heading-actions">
                      <span>
                        {group.rooms.length}{" "}
                        {group.rooms.length === 1 ? "room" : "rooms"}
                      </span>
                      {canManage && (
                        <button
                          className="small-button"
                          onClick={() => setEditing(representative)}
                        >
                          <Pencil size={13} /> Edit type price
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="room-grid">
                    {group.rooms.map((room) => (
                      <RoomBoardCard
                        key={room.id}
                        room={room}
                        isBusiest={
                          room.id === busiest?.id && (room.stayCount ?? 0) > 0
                        }
                        canManage={canManage}
                        onManage={() => setEditing(room)}
                        onStatusChange={change}
                        onChooseRoom={onChooseRoom}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <Card>
              <Empty
                title="No rooms in this filter"
                copy="Choose another room group to see more rooms."
              />
            </Card>
          )}
        </>
      )}
      {editing && (
        <RoomEditModal
          room={editing}
          knownRooms={rooms ?? []}
          onClose={() => setEditing(null)}
          onSave={saveRoom}
        />
      )}
    </>
  );
}

export function RoomBoardCard({
  room,
  isBusiest,
  canManage,
  onManage,
  onStatusChange,
  onChooseRoom,
}: {
  room: Room;
  isBusiest: boolean;
  canManage: boolean;
  onManage: () => void;
  onStatusChange: (room: Room, status: string) => void;
  onChooseRoom: (room: Room) => void;
}) {
  return (
    <article className={`room-card room-${room.status.toLowerCase()}`}>
      <div className="room-card-top">
        <span className="room-number">{room.number}</span>
        <Badge value={room.status} />
      </div>
      <div className="room-type">
        {room.type} room <span>·</span> {money(room.baseRate)} / night
      </div>
      <div className="room-stay-count">
        {isBusiest && <Trophy size={13} />} {room.stayCount ?? 0}{" "}
        {(room.stayCount ?? 0) === 1 ? "stay" : "stays"}
        {isBusiest ? " · Most stays" : ""}
      </div>
      {room.stays?.[0]?.guest && (
        <div className="room-guest">
          <div className="avatar avatar-guest">
            {room.stays[0].guest.firstName[0]}
            {room.stays[0].guest.lastName[0]}
          </div>
          <span>
            <strong>{guestName(room.stays[0].guest)}</strong>
            <small>Currently staying</small>
          </span>
        </div>
      )}
      {room.notes && <p className="room-notes">{room.notes}</p>}
      <div className="room-card-bottom">
        <select
          aria-label={`Update room ${room.number} status`}
          value={room.status}
          onChange={(e) => onStatusChange(room, e.target.value)}
        >
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="DIRTY">Dirty</option>
          <option value="CLEAN">Clean</option>
          <option value="INSPECTED">Inspected</option>
          <option value="OUT_OF_ORDER">Out of order</option>
        </select>
        {["AVAILABLE", "CLEAN", "INSPECTED"].includes(room.status) && (
          <button
            className="small-button room-action-button"
            onClick={() => onChooseRoom(room)}
          >
            Check in / reserve
          </button>
        )}
      </div>
      {canManage && (
        <button className="text-button room-manage-button" onClick={onManage}>
          <Pencil size={14} /> Manage room
        </button>
      )}
    </article>
  );
}

export function RoomEditModal({
  room,
  knownRooms,
  onClose,
  onSave,
}: {
  room: Room;
  knownRooms: Room[];
  onClose: () => void;
  onSave: (room: Room, values: Record<string, unknown>) => Promise<void>;
}) {
  const [number, setNumber] = useState(room.number),
    [type, setType] = useState(room.type),
    [rate, setRate] = useState(String(room.baseRate)),
    [floor, setFloor] = useState(
      room.floor === null || room.floor === undefined ? "" : String(room.floor),
    ),
    [capacity, setCapacity] = useState(String(room.capacity ?? 2)),
    [notes, setNotes] = useState(room.notes ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function changeType(next: string) {
    setType(next);
    const match = knownRooms.find(
      (candidate) =>
        candidate.id !== room.id &&
        candidate.type.toLocaleLowerCase() === next.trim().toLocaleLowerCase(),
    );
    if (match) setRate(String(match.baseRate));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const typeChanged = type.trim() !== room.type;
      await onSave(room, {
        number: number.trim(),
        type: type.trim(),
        ...(typeChanged && Number(rate) === Number(room.baseRate)
          ? {}
          : { baseRate: Number(rate) }),
        floor: floor === "" ? undefined : Number(floor),
        capacity: Number(capacity),
        notes: notes.trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save room");
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Manage room ${room.number}`}
      subtitle="Room type price is shared by all rooms in that type."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Room number">
            <input
              required
              maxLength={12}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </Field>
          <Field label="Room type">
            <input
              required
              maxLength={60}
              value={type}
              onChange={(e) => changeType(e.target.value)}
            />
          </Field>
          <Field label="Type nightly price">
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          <Field label="Floor">
            <input
              type="number"
              step="1"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            />
          </Field>
          <Field label="Guest capacity">
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>
          <Field label="Room notes" className="wide-field">
            <textarea
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
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
          <button className="primary-button" disabled={busy}>
            <Check size={15} />
            {busy ? "Saving…" : "Save room"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RoomActionModal({
  room,
  onClose,
  onCheckIn,
  onReserve,
}: {
  room: Room;
  onClose: () => void;
  onCheckIn: () => void;
  onReserve: () => void;
}) {
  return (
    <Modal
      title={`Room ${room.number}`}
      subtitle={`${room.type} · ${statusLabels[room.status]} · ${money(room.baseRate)} per night`}
      onClose={onClose}
    >
      <div className="room-action-options">
        <p>What would you like to do with this room?</p>
        <button className="primary-button" onClick={onCheckIn}>
          <DoorOpen size={16} /> Check in a guest
        </button>
        <button className="secondary-button" onClick={onReserve}>
          <CalendarDays size={16} /> Make a reservation
        </button>
      </div>
    </Modal>
  );
}

export function RoomMovePanel({
  flash,
  refresh,
}: {
  flash: (s: string) => void;
  refresh: () => void;
}) {
  const { data: stays } = useLoad<Stay[]>("/stays/in-house");
  const { data: rooms } = useLoad<Room[]>("/rooms");
  const [stayId, setStayId] = useState(""),
    [roomId, setRoomId] = useState("");
  const selected = stays?.find((x) => x.id === stayId);
  const eligible =
    rooms?.filter(
      (r) =>
        r.id !== selected?.room.id &&
        !["OCCUPIED", "DIRTY", "OUT_OF_ORDER"].includes(r.status),
    ) ?? [];
  return (
    <Card className="move-room-card">
      <SectionHeading
        title="Move a guest to another room"
        meta="The previous room will be marked Dirty; higher room rates are charged for remaining nights, while the contracted rate stays for lower-rate rooms."
      />
      <div className="form-grid">
        <Field label="Current guest">
          <select
            value={stayId}
            onChange={(e) => {
              setStayId(e.target.value);
              setRoomId("");
            }}
          >
            <option value="">Choose an in-house guest</option>
            {stays?.map((s) => (
              <option key={s.id} value={s.id}>
                {guestName(s.guest)} · Room {s.room.number}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destination room">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Choose an available room</option>
            {eligible.map((r) => (
              <option value={r.id} key={r.id}>
                {r.number} · {r.type}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button
            className="primary-button"
            disabled={!stayId || !roomId}
            onClick={async () => {
              try {
                await post(`/stays/${stayId}/move-room`, {
                  roomId,
                  reason: "Guest room move",
                });
                flash("Guest moved · previous room marked Dirty");
                setStayId("");
                setRoomId("");
                refresh();
              } catch (e) {
                flash(e instanceof Error ? e.message : "Could not move guest");
              }
            }}
          >
            <DoorOpen size={16} /> Move guest
          </button>
        </div>
      </div>
    </Card>
  );
}
