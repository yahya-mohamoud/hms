import { PageTitle, Card, SectionHeading, Field, Metric, Loading, Empty, ErrorPanel } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { api, post } from "../../lib/api";
import { today, money, dateLabel, shiftMonth, paymentMethodOptions, statusLabels, expenseCategories, expenseCategoryLabel } from "../../lib/domain";
import { type Expense } from "../../types";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

export function ReportsPage({
  flash,
  role,
}: {
  flash: (s: string) => void;
  role: string;
}) {
  const canSeeInsights = ["ADMIN", "MANAGER"].includes(role);
  const canSeeFinancials = ["ADMIN", "MANAGER", "RECEPTIONIST"].includes(role);
  const canClose = canSeeInsights;
  const { data: insights, loading } = useLoad<any>(
    canSeeInsights ? "/reports/guest-insights" : null,
  );
  const [dates, setDates] = useState({
    from: today().slice(0, 7) + "-01",
    to: today(),
  });
  const [revenue, setRevenue] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      setRevenue(
        await api(`/reports/revenue?from=${dates.from}&to=${dates.to}`),
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not load report");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run();
  }, []);
  const close = async () => {
    try {
      const report = await post<any>("/reports/daily-close", {
        businessDate: today(),
      });
      flash(
        report.alreadyClosed
          ? `Daily close already saved · payments ${money(report.paymentsTotal)}`
          : `Daily close saved · payments ${money(report.paymentsTotal)}`,
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : "Unable to close day");
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="INSIGHTS"
        title="Reports"
        subtitle="Revenue, occupancy trends and guest insights."
        action={
          canClose ? (
            <button className="secondary-button" onClick={close}>
              <Check size={16} /> Close today
            </button>
          ) : undefined
        }
      />
      <Card className="revenue-card">
        <SectionHeading
          title="Revenue & occupancy"
          meta="Based on posted charges and stays"
        />
        <div className="report-filters">
          <Field label="From">
            <input
              type="date"
              value={dates.from}
              onChange={(e) => setDates({ ...dates, from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={dates.to}
              onChange={(e) => setDates({ ...dates, to: e.target.value })}
            />
          </Field>
          <button className="primary-button" onClick={run} disabled={busy}>
            {busy ? "Loading…" : "Run report"}
          </button>
        </div>
        {revenue && (
          <>
            <div className="report-metrics">
              <Metric label="Room revenue" value={money(revenue.roomRevenue)} />
              <Metric
                label="Extras & adjustments"
                value={money(revenue.otherRevenue)}
              />
              <Metric
                label="Payments received"
                value={money(revenue.payments)}
              />
              <Metric
                label="Occupied room nights"
                value={revenue.occupiedNights}
              />
              <Metric
                label="Occupancy"
                value={`${revenue.occupancyPercent}%`}
              />
            </div>
            <div className="payment-method-cards">
              <Metric
                label="Cash received"
                value={money(revenue.paymentBreakdown?.CASH)}
              />
              <Metric
                label="Coopay Ebirr"
                value={money(revenue.paymentBreakdown?.COOPAY_EBIRR)}
              />
              <Metric
                label="Ebirr Kaafi"
                value={money(revenue.paymentBreakdown?.EBIRR_KAAFI)}
              />
              <Metric
                label="CBE Bank"
                value={money(revenue.paymentBreakdown?.CBE_BANK)}
              />
              <Metric
                label="Other"
                value={money(revenue.paymentBreakdown?.OTHER)}
              />
            </div>
          </>
        )}
      </Card>
      {canSeeFinancials && <MonthlyFinancialReport />}{" "}
      {canSeeInsights &&
        (loading ? (
          <Loading />
        ) : (
          insights && (
            <>
              <div className="report-columns">
                <GuestRank
                  title="Top guests · stays"
                  items={insights.topByStays}
                  value="totalStays"
                  unit="stays"
                />
                <GuestRank
                  title="Top guests · nights"
                  items={insights.topByNights}
                  value="totalNights"
                  unit="nights"
                />
                <GuestRank
                  title="Top guests · revenue"
                  items={insights.topByRevenue}
                  value="totalSpent"
                  unit="spent"
                />
              </div>
              <Card className="repeat-card">
                <SectionHeading
                  title="Most recent repeat guests"
                  meta={`${insights.repeatGuests.length} guests with 2+ stays`}
                />
                {insights.recentRepeatGuests.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Guest</th>
                          <th>Stays</th>
                          <th>Nights</th>
                          <th>Total spent</th>
                          <th>Last stay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.recentRepeatGuests.map((g: any) => (
                          <tr key={g.id}>
                            <td>
                              <strong>{g.name}</strong>
                              <small>{g.phone ?? ""}</small>
                            </td>
                            <td>{g.totalStays}</td>
                            <td>{g.totalNights}</td>
                            <td>{money(g.totalSpent)}</td>
                            <td>{dateLabel(g.lastStayDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="No repeat stays yet"
                    copy="Guests returning for a second stay will be listed here."
                  />
                )}
              </Card>
            </>
          )
        ))}
    </>
  );
}

export function MonthlyFinancialReport() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [showAllDaily, setShowAllDaily] = useState(false);
  const from = `${month}-01`,
    to = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10);
  const { data, loading, error } = useLoad<any>(
    `/reports/financial-summary?from=${from}&to=${to}`,
    [month],
  );
  const { data: expenseRecords, loading: expensesLoading } = useLoad<Expense[]>(
    `/expenses?from=${from}&to=${to}`,
    [month],
  );
  const monthLabel = new Date(`${month}-15T12:00:00`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
  const dailyRows = (data?.daily ?? []).filter(
    (row: any) => row.date <= today(),
  );
  const visibleDailyRows = showAllDaily
    ? [...dailyRows].reverse()
    : [...dailyRows].reverse().slice(0, 7);
  useEffect(() => setShowAllDaily(false), [month]);
  return (
    <Card className="monthly-financial-card">
      <SectionHeading
        title="Monthly income and expenses"
        meta="Net cash is payments received minus expenses paid"
        action={
          <div className="month-picker">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={17} />
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        }
      />
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorPanel message={error} />
      ) : (
        <>
          <div className="financial-month-label">{monthLabel}</div>
          <div className="report-metrics financial-summary-metrics">
            <Metric
              label="Payments received"
              value={money(data.paymentsTotal)}
            />
            <Metric label="Expenses paid" value={money(data.expensesTotal)} />
            <Metric label="Net cash" value={money(data.netCash)} />
            <Metric
              label="Room charges posted"
              value={money(data.roomRevenue)}
            />
            <Metric
              label="Other charges posted"
              value={money(data.otherRevenue)}
            />
          </div>
          <div className="financial-breakdowns">
            <div>
              <SectionHeading title="Received by payment method" />
              {paymentMethodOptions.map((method) => (
                <div className="financial-breakdown-row" key={method}>
                  <span>{statusLabels[method] ?? method}</span>
                  <strong>{money(data.paymentBreakdown?.[method])}</strong>
                </div>
              ))}
            </div>
            <div>
              <SectionHeading title="Expenses by category" />
              {expenseCategories.map((category) => (
                <div className="financial-breakdown-row" key={category}>
                  <span>{expenseCategoryLabel(category)}</span>
                  <strong>{money(data.expensesByCategory?.[category])}</strong>
                </div>
              ))}
            </div>
          </div>
          <SectionHeading
            title="Daily summary"
            meta={`${dailyRows.length} days in ${monthLabel}`}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payments received</th>
                  <th>Expenses</th>
                  <th>Net cash</th>
                  <th>Room charges</th>
                  <th>Other charges</th>
                </tr>
              </thead>
              <tbody>
                {visibleDailyRows.map((row: any) => (
                  <tr key={row.date}>
                    <td>
                      {dateLabel(row.date, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>{money(row.payments)}</td>
                    <td>{money(row.expenses)}</td>
                    <td
                      className={
                        row.netCash < 0 ? "negative-amount" : "positive-amount"
                      }
                    >
                      {money(row.netCash)}
                    </td>
                    <td>{money(row.roomCharges)}</td>
                    <td>{money(row.otherCharges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dailyRows.length > 7 && (
            <div className="table-expand">
              <button
                className="text-button"
                onClick={() => setShowAllDaily((value) => !value)}
              >
                {showAllDaily
                  ? "Show less"
                  : "Read more (" + (dailyRows.length - 7) + " days)"}
              </button>
            </div>
          )}
          <SectionHeading
            title="Expense details"
            meta={`${expenseRecords?.filter((expense) => !expense.voidedAt).length ?? 0} recorded expenses`}
          />
          {expensesLoading ? (
            <Loading />
          ) : expenseRecords?.filter((expense) => !expense.voidedAt).length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Paid to</th>
                    <th>Payment method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRecords
                    .filter((expense) => !expense.voidedAt)
                    .map((expense) => (
                      <tr key={expense.id}>
                        <td>
                          {dateLabel(expense.expenseDate, {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td>{expenseCategoryLabel(expense.category)}</td>
                        <td>{expense.description}</td>
                        <td>{expense.payee || "—"}</td>
                        <td>
                          {statusLabels[expense.paymentMethod] ??
                            expense.paymentMethod}
                        </td>
                        <td>{money(expense.amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No recorded expenses this month"
              copy="The monthly expense total is zero."
            />
          )}
        </>
      )}
    </Card>
  );
}

export function GuestRank({
  title,
  items,
  value,
  unit,
}: {
  title: string;
  items: any[];
  value: string;
  unit: string;
}) {
  return (
    <Card className="rank-card">
      <SectionHeading title={title} />
      {items.length ? (
        items.slice(0, 5).map((g, i) => (
          <div className="rank-row" key={g.id}>
            <span className={`rank-number ${i === 0 ? "rank-first" : ""}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{g.name}</strong>
              <small>
                {g.totalStays} stays · last {dateLabel(g.lastStayDate)}
              </small>
            </div>
            <b>
              {value === "totalSpent" ? money(g[value]) : g[value]}
              <small>{unit === "spent" ? "total" : unit}</small>
            </b>
          </div>
        ))
      ) : (
        <Empty
          title="No stays recorded"
          copy="Guest rankings will appear once stays are completed."
        />
      )}
    </Card>
  );
}

export function DailyAuditHistory() {
  const { data, loading, error, reload } = useLoad<any[]>(
    "/reports/daily-audits",
  );
  const [expanded, setExpanded] = useState(false);
  const visible = data ? (expanded ? data : data.slice(0, 7)) : [];
  return (
    <Card className="activity-card">
      <SectionHeading
        title="Daily close snapshots"
        meta="Saved occupancy, revenue, expenses and payment reconciliation"
        action={
          <button className="small-button" onClick={reload}>
            Refresh
          </button>
        }
      />
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorPanel message={error} />
      ) : data.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business date</th>
                  <th>Rooms occupied</th>
                  <th>Room revenue</th>
                  <th>ADR</th>
                  <th>RevPAR</th>
                  <th>Payments received</th>
                  <th>Expenses</th>
                  <th>Net cash</th>
                  <th>Cash</th>
                  <th>Coopay Ebirr</th>
                  <th>Ebirr Kaafi</th>
                  <th>CBE Bank</th>
                  <th>Other</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((audit: any) => (
                  <tr key={audit.id}>
                    <td>
                      {dateLabel(audit.businessDate, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      {audit.occupiedRooms}/{audit.openingRooms} ·{" "}
                      {audit.openingRooms
                        ? Math.round(
                            (audit.occupiedRooms / audit.openingRooms) * 100,
                          )
                        : 0}
                      %
                    </td>
                    <td>{money(audit.roomRevenue)}</td>
                    <td>{money(audit.averageDailyRate)}</td>
                    <td>{money(audit.revenuePerAvailableRoom)}</td>
                    <td>{money(audit.paymentsTotal)}</td>
                    <td>{money(audit.expensesTotal)}</td>
                    <td
                      className={
                        Number(audit.netCash) < 0
                          ? "negative-amount"
                          : "positive-amount"
                      }
                    >
                      {money(audit.netCash)}
                    </td>
                    <td>{money(audit.cashPayments)}</td>
                    <td>{money(audit.coopayEbirrPayments)}</td>
                    <td>{money(audit.ebirrKaafiPayments)}</td>
                    <td>{money(audit.cbeBankPayments)}</td>
                    <td>{money(audit.otherPayments)}</td>
                    <td>{money(audit.outstandingTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 7 && (
            <div className="table-expand">
              <button
                className="text-button"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded
                  ? "Show less"
                  : "Read more (" + (data.length - 7) + " days)"}
              </button>
            </div>
          )}
        </>
      ) : (
        <Empty
          title="No daily closes saved"
          copy="A manager or administrator can save the daily close from this page."
        />
      )}
    </Card>
  );
}

export function ActivityLog() {
  const { data, loading, error } = useLoad<any[]>("/reports/audit-log");
  const [expanded, setExpanded] = useState(false);
  const [staffFilter, setStaffFilter] = useState("ALL");
  const staffOptions = Array.from(
    new Map<string, string>(
      (data ?? []).map((item) => [
        item.user?.email ?? "__SYSTEM__",
        item.user?.name ?? "System",
      ]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));
  const filtered = (data ?? []).filter(
    (item) =>
      staffFilter === "ALL" ||
      (staffFilter === "__SYSTEM__"
        ? !item.user?.email
        : item.user?.email === staffFilter),
  );
  const visible = expanded ? filtered : filtered.slice(0, 7);
  return (
    <Card className="activity-card">
      <SectionHeading
        title="Recent activity"
        meta="Newest staff actions first"
      />
      {data && data.length > 0 && (
        <div className="activity-filter-row">
          <Field label="Filter by staff member">
            <select
              aria-label="Filter activity by staff member"
              value={staffFilter}
              onChange={(e) => {
                setStaffFilter(e.target.value);
                setExpanded(false);
              }}
            >
              <option value="ALL">All staff</option>
              {staffOptions.map(([email, name]) => (
                <option key={email} value={email}>
                  {email === "__SYSTEM__" ? name : name + " · " + email}
                </option>
              ))}
            </select>
          </Field>
          <span className="activity-filter-count">
            {filtered.length}{" "}
            {filtered.length === 1 ? "activity" : "activities"}
          </span>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorPanel message={error} />
      ) : filtered.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Staff member</th>
                  <th>Action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item: any) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>{item.user?.name ?? "System"}</td>
                    <td>
                      {item.action.replaceAll(".", " ").replaceAll("_", " ")}
                    </td>
                    <td>
                      {item.entityType}
                      {item.entityId ? " · " + item.entityId.slice(-7) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 7 && (
            <div className="table-expand">
              <button
                className="text-button"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded
                  ? "Show less"
                  : "Read more (" + (filtered.length - 7) + " entries)"}
              </button>
            </div>
          )}
        </>
      ) : (
        <Empty
          title={
            data.length
              ? "No activity for this staff member"
              : "No activity recorded yet"
          }
          copy={
            data.length
              ? "Choose another staff member or select All staff."
              : "Important room, reservation, stay and billing changes will appear here."
          }
        />
      )}
    </Card>
  );
}
