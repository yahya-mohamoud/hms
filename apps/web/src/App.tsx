import { Login } from "./features/auth/components";
import { FolioModal } from "./features/billing/components";
import { ExpensesPage } from "./features/expenses/components";
import { GuestsPage } from "./features/guests/components";
import { Overview } from "./features/overview/components";
import { ReportsPage, DailyAuditHistory, ActivityLog } from "./features/reports/components";
import { CheckInModal, ReservationsPage } from "./features/reservations/components";
import { RoomsPage, RoomActionModal, RoomMovePanel } from "./features/rooms/components";
import { InHousePage } from "./features/stays/components";
import { TeamPage } from "./features/team/components";
import { type User } from "./lib/api";
import { today, nav, statusLabels, dateLabel } from "./lib/domain";
import { type Page, type Room } from "./types";
import { Building2, X, ChevronDown, Sparkles, LogOut, Menu, CalendarDays, Sun, Moon, Check } from "lucide-react";
import { useState, useCallback, useEffect, type ReactNode } from "react";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("hms_user") ?? "null");
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<Page>("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<ReactNode>(null);
  const [roomForReservation, setRoomForReservation] = useState<Room | null>(
    null,
  );
  const [version, setVersion] = useState(0);
  const [dark, setDark] = useState(false);
  const [date, setDate] = useState(today());
  const refresh = () => setVersion((v) => v + 1);
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const onMutation = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setModal(null);
      flash(done);
      refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not save changes");
    }
  };
  const logout = useCallback(() => {
    localStorage.removeItem("hms_token");
    localStorage.removeItem("hms_user");
    setUser(null);
    setModal(null);
  }, []);
  useEffect(() => {
    window.addEventListener("hms:logout", logout);
    return () => window.removeEventListener("hms:logout", logout);
  }, [logout]);
  useEffect(() => {
    const navigate = (event: Event) => {
      const next = (event as CustomEvent<Page>).detail;
      if (next) setPage(next);
    };
    const toast = (event: Event) => {
      setNotice(String((event as CustomEvent).detail ?? "Done"));
      window.setTimeout(() => setNotice(""), 3500);
    };
    const walkin = () =>
      setModal(
        <CheckInModal onClose={() => setModal(null)} onSave={onMutation} />,
      );
    window.addEventListener("hms:navigate", navigate);
    window.addEventListener("hms:toast", toast);
    window.addEventListener("hms:open-walkin", walkin);
    return () => {
      window.removeEventListener("hms:navigate", navigate);
      window.removeEventListener("hms:toast", toast);
      window.removeEventListener("hms:open-walkin", walkin);
    };
  });

  if (!user) return <Login onLogin={setUser} />;
  return (
    <div className={`app-shell ${dark ? "dark-mode" : ""}`}>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Building2 size={18} />
          </div>
          <div>
            <strong>Staywell</strong>
            <small>HOTEL DESK</small>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="property-pill">
          <span className="online-dot" /> Front desk <ChevronDown size={14} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav
            .filter(
              ({ label }) =>
                (label !== "Team" || user.role === "ADMIN") &&
                (label !== "Expenses" ||
                  ["ADMIN", "MANAGER", "RECEPTIONIST"].includes(user.role)),
            )
            .map(({ label, icon: Icon }) => (
              <button
                className={`nav-item ${page === label ? "active" : ""}`}
                key={label}
                onClick={() => {
                  setPage(label);
                  setMobileNav(false);
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <Sparkles size={16} />
            </div>
            <strong>Everything in order?</strong>
            <span>Keep today's operations moving smoothly.</span>
          </div>
          <div className="user-chip">
            <div className="avatar">
              {user.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="user-meta">
              <strong>{user.name}</strong>
              <span>{statusLabels[user.role] ?? user.role}</span>
            </div>
            <button
              aria-label="Sign out"
              className="icon-button logout"
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            Workspace <span>/</span> <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <div className="top-date">
              <CalendarDays size={16} />
              <span className="top-date-text">
                {dateLabel(date, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="avatar avatar-small">{user.name.slice(0, 1)}</div>
          </div>
        </header>
        <div className="page-content">
          {page === "Overview" && (
            <Overview
              key={`overview-${version}-${date}`}
              date={date}
              setDate={setDate}
              openCheckIn={(r) =>
                setModal(
                  <CheckInModal
                    reservation={r}
                    onClose={() => setModal(null)}
                    onSave={onMutation}
                  />,
                )
              }
              openFolio={(s) =>
                setModal(
                  <FolioModal
                    stay={s}
                    onClose={() => setModal(null)}
                    flash={flash}
                  />,
                )
              }
            />
          )}
          {page === "Rooms" && (
            <RoomsPage
              key={`rooms-${version}`}
              flash={flash}
              canManage={["ADMIN", "MANAGER"].includes(user.role)}
              onChooseRoom={(room) =>
                setModal(
                  <RoomActionModal
                    room={room}
                    onClose={() => setModal(null)}
                    onCheckIn={() =>
                      setModal(
                        <CheckInModal
                          initialRoomId={room.id}
                          onClose={() => setModal(null)}
                          onSave={onMutation}
                        />,
                      )
                    }
                    onReserve={() => {
                      setRoomForReservation(room);
                      setPage("Reservations");
                      setModal(null);
                    }}
                  />,
                )
              }
            />
          )}
          {page === "Reservations" && (
            <ReservationsPage
              key={`reservations-${version}`}
              roomForReservation={roomForReservation}
              onReservationRoomUsed={() => setRoomForReservation(null)}
              openCheckIn={(r) =>
                setModal(
                  <CheckInModal
                    reservation={r}
                    onClose={() => setModal(null)}
                    onSave={onMutation}
                  />,
                )
              }
            />
          )}
          {page === "Guests" && (
            <GuestsPage key={`guests-${version}`} flash={flash} />
          )}
          {page === "In-house" && (
            <>
              <InHousePage
                key={`inhouse-${version}`}
                openFolio={(s) =>
                  setModal(
                    <FolioModal
                      stay={s}
                      onClose={() => setModal(null)}
                      flash={flash}
                    />,
                  )
                }
                flash={flash}
              />
              <RoomMovePanel
                key={`room-move-${version}`}
                flash={flash}
                refresh={refresh}
              />
            </>
          )}
          {page === "Expenses" &&
            ["ADMIN", "MANAGER", "RECEPTIONIST"].includes(user.role) && (
              <ExpensesPage
                key={`expenses-${version}`}
                flash={flash}
                canManage={["ADMIN", "MANAGER"].includes(user.role)}
              />
            )}
          {page === "Reports" && (
            <>
              <ReportsPage
                key={`reports-${version}`}
                flash={flash}
                role={user.role}
              />
              {["ADMIN", "MANAGER"].includes(user.role) && (
                <DailyAuditHistory key={`daily-audits-${version}`} />
              )}
              {user.role === "ADMIN" && (
                <ActivityLog key={`audit-${version}`} />
              )}
            </>
          )}
          {page === "Team" && user.role === "ADMIN" && (
            <TeamPage
              key={`team-${version}`}
              flash={flash}
              currentUserId={user.id}
            />
          )}
        </div>
      </main>
      {modal}
      {notice && (
        <div className="toast">
          <span className="toast-icon">
            <Check size={15} />
          </span>
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
