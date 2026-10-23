import { Loading, ErrorPanel, PageTitle, Card, SectionHeading, Empty } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { shiftDay, money, guestName, dateLabel, statusLabels } from "../../lib/domain";
import { type Reservation, type Stay, type Dashboard } from "../../types";
import { ChevronLeft, ChevronRight, BedDouble, DoorOpen, LogOut, CircleDollarSign, Sparkles } from "lucide-react";
import { type ReactNode } from "react";

export function Overview({
  date,
  setDate,
  openCheckIn,
  openFolio,
}: {
  date: string;
  setDate: (d: string) => void;
  openCheckIn: (r: Reservation) => void;
  openFolio: (s: Stay) => void;
}) {
  const { data, loading, error } = useLoad<Dashboard>(
    `/reports/dashboard?date=${date}`,
  );
  if (loading) return <Loading />;
  if (!data) return <ErrorPanel message={error} />;
  const statuses = [
    "AVAILABLE",
    "OCCUPIED",
    "DIRTY",
    "CLEAN",
    "INSPECTED",
    "OUT_OF_ORDER",
  ];
  return (
    <>
      <PageTitle
        eyebrow={new Date(`${date}T12:00:00`)
          .toLocaleDateString(undefined, {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
          .toUpperCase()}
        title="Good morning, team"
        subtitle="Here's what's happening at the hotel today."
        action={
          <div className="date-picker">
            <button
              className="icon-button"
              onClick={() => setDate(shiftDay(date, -1))}
            >
              <ChevronLeft size={17} />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              className="icon-button"
              onClick={() => setDate(shiftDay(date, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        }
      />
      <div className="stats-grid">
        <StatCard
          label="Occupancy"
          value={`${data.occupancy.percent}%`}
          note={`${data.occupancy.occupied} of ${data.occupancy.total} rooms`}
          icon={<BedDouble />}
          tone="green"
        />
        <StatCard
          label="Arrivals"
          value={data.arrivals.length}
          note="Expected today"
          icon={<DoorOpen />}
          tone="blue"
        />
        <StatCard
          label="Departures"
          value={data.departures.length}
          note="Expected today"
          icon={<LogOut />}
          tone="peach"
        />
        <StatCard
          label="Payments today"
          value={money(data.paymentsToday)}
          note="Across all tenders"
          icon={<CircleDollarSign />}
          tone="lilac"
        />
      </div>
      <div className="overview-grid">
        <Card>
          <SectionHeading
            title="Today's arrivals"
            meta={`${data.arrivals.length} expected`}
            action={
              <button className="text-button" onClick={() => {}}>
                View all <ChevronRight size={15} />
              </button>
            }
          />
          {data.arrivals.length ? (
            <div className="arrival-list">
              {data.arrivals.slice(0, 5).map((r) => (
                <div className="arrival-row" key={r.id}>
                  <div className="avatar avatar-guest">
                    {r.guest.firstName[0]}
                    {r.guest.lastName[0]}
                  </div>
                  <div className="arrival-person">
                    <strong>{guestName(r.guest)}</strong>
                    <span>
                      {r.confirmationCode} ·{" "}
                      {r.room?.number
                        ? `Room ${r.room.number}`
                        : (r.roomType ?? "Room to assign")}
                    </span>
                  </div>
                  <div className="arrival-date">{dateLabel(r.arrivalDate)}</div>
                  <button
                    className="small-button"
                    onClick={() => openCheckIn(r)}
                  >
                    Check in
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No arrivals today"
              copy="The front desk is all caught up."
            />
          )}
        </Card>
        <Card className="room-overview-card">
          <SectionHeading
            title="Room status"
            meta="Live overview"
            action={
              <button
                className="text-button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("hms:navigate", { detail: "Rooms" }),
                  )
                }
              >
                Room board <ChevronRight size={15} />
              </button>
            }
          />
          <div className="status-summary">
            {statuses.map((s) => (
              <div className="status-summary-row" key={s}>
                <span className={`status-dot dot-${s.toLowerCase()}`} />
                <span>{statusLabels[s]}</span>
                <strong>
                  {data.rooms.filter((r) => r.status === s).length}
                </strong>
              </div>
            ))}
          </div>
          <div className="occupancy-footer">
            <div>
              <span>Currently in-house</span>
              <strong>
                {data.inHouse} <small>/ {data.occupancy.total} rooms</small>
              </strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${data.occupancy.percent}%` }} />
            </div>
          </div>
        </Card>
        <Card className="stays-card">
          <SectionHeading
            title="Guests in-house"
            meta={`${data.inHouse} active stays`}
            action={
              <button
                className="text-button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("hms:navigate", { detail: "In-house" }),
                  )
                }
              >
                View stays <ChevronRight size={15} />
              </button>
            }
          />
          <InHouseMini openFolio={openFolio} />
        </Card>
        <Card className="quick-card">
          <div className="quick-heading">
            <div className="quick-icon">
              <Sparkles size={17} />
            </div>
            <div>
              <h3>Front desk pulse</h3>
              <span>A quick look at today's operations</span>
            </div>
          </div>
          <div className="pulse-stat">
            <span>Rooms in use</span>
            <strong>
              {data.inHouse} / {data.occupancy.total}
            </strong>
          </div>
          <div className="pulse-stat">
            <span>Payments received</span>
            <strong>{money(data.paymentsToday)}</strong>
          </div>
          <div className="pulse-note">
            <span className="online-dot" /> All hotel services are running
            normally
          </div>
        </Card>
      </div>
    </>
  );
}

export function StatCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <div className={`stat-icon icon-${tone}`}>{icon}</div>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </div>
  );
}

export function InHouseMini({ openFolio }: { openFolio: (s: Stay) => void }) {
  const { data, loading } = useLoad<Stay[]>("/stays/in-house");
  if (loading) return <Loading />;
  if (!data?.length)
    return (
      <Empty
        title="No guests checked in"
        copy="Checked-in guests will appear here."
      />
    );
  return (
    <div className="mini-stay-list">
      {data.slice(0, 4).map((s) => (
        <button className="mini-stay" key={s.id} onClick={() => openFolio(s)}>
          <span className="avatar avatar-guest">
            {s.guest.firstName[0]}
            {s.guest.lastName[0]}
          </span>
          <span className="mini-stay-name">
            <strong>{guestName(s.guest)}</strong>
            <small>
              Room {s.room.number} · departs {dateLabel(s.expectedCheckOut)}
            </small>
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}
