import { PageTitle, Card, Field, Metric, SectionHeading, Loading, ErrorPanel, Empty, Modal } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { patch, post } from "../../lib/api";
import { today, money, dateLabel, expenseCategoryLabel, statusLabels, expenseCategories, paymentMethodOptions } from "../../lib/domain";
import { type Expense } from "../../types";
import { Plus, Check, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

export function ExpensesPage({
  flash,
  canManage,
}: {
  flash: (s: string) => void;
  canManage: boolean;
}) {
  const [range, setRange] = useState({
    from: `${today().slice(0, 7)}-01`,
    to: today(),
  });
  const path = `/expenses?from=${range.from}&to=${range.to}`;
  const {
    data: expenses,
    loading,
    error,
    reload,
  } = useLoad<Expense[]>(path, [range.from, range.to]);
  const [editing, setEditing] = useState<Expense | null | false>(false);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const activeExpenses = expenses?.filter((e) => !e.voidedAt) ?? [];
  const total = activeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  async function save(values: Record<string, unknown>) {
    try {
      if (editing) await patch(`/expenses/${editing.id}`, values);
      else await post("/expenses", values);
      setEditing(false);
      flash(editing ? "Expense updated" : "Expense recorded");
      reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not save expense");
      throw e;
    }
  }
  async function voidExpense(expense: Expense, reason: string) {
    try {
      await post(`/expenses/${expense.id}/void`, { reason });
      setVoiding(null);
      flash("Expense voided");
      reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not void expense");
      throw e;
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="FINANCES"
        title="Expenses"
        subtitle="Record and review hotel expenses."
        action={
          <button className="primary-button" onClick={() => setEditing(null)}>
            <Plus size={16} /> Record expense
          </button>
        }
      />
      <Card className="expense-summary-card">
        <div className="expense-range">
          <Field label="From">
            <input
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </Field>
        </div>
        <div className="report-metrics">
          <Metric label="Expenses in period" value={money(total)} />
          <Metric
            label="Active expense records"
            value={activeExpenses.length}
          />
        </div>
      </Card>
      <Card className="expense-list-card">
        <SectionHeading
          title="Expense records"
          meta="Voided records remain visible and are excluded from totals"
        />
        {loading ? (
          <Loading />
        ) : !expenses ? (
          <ErrorPanel message={error} />
        ) : expenses.length ? (
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
                  <th>Status</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className={expense.voidedAt ? "expense-voided" : ""}
                  >
                    <td>
                      {dateLabel(expense.expenseDate, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>{expenseCategoryLabel(expense.category)}</td>
                    <td>
                      <strong>{expense.description}</strong>
                      {expense.reference && (
                        <small>Ref. {expense.reference}</small>
                      )}
                      {expense.voidReason && (
                        <small>Void reason: {expense.voidReason}</small>
                      )}
                    </td>
                    <td>{expense.payee || "—"}</td>
                    <td>
                      {statusLabels[expense.paymentMethod] ??
                        expense.paymentMethod.replaceAll("_", " ")}
                    </td>
                    <td>{money(expense.amount)}</td>
                    <td>
                      {expense.voidedAt ? (
                        <span className="badge badge-cancelled">Voided</span>
                      ) : (
                        <span className="badge badge-done">Recorded</span>
                      )}
                    </td>
                    {canManage && (
                      <td>
                        {!expense.voidedAt && (
                          <div className="expense-actions">
                            <button
                              className="small-button"
                              onClick={() => setEditing(expense)}
                            >
                              Edit
                            </button>
                            <button
                              className="small-button danger-text-button"
                              onClick={() => setVoiding(expense)}
                            >
                              Void
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No expenses for these dates"
            copy="Record an expense or choose a wider date range."
          />
        )}
      </Card>
      {editing !== false && (
        <ExpenseModal
          expense={editing || undefined}
          onClose={() => setEditing(false)}
          onSave={save}
        />
      )}{" "}
      {voiding && canManage && (
        <VoidExpenseModal
          expense={voiding}
          onClose={() => setVoiding(null)}
          onVoid={voidExpense}
        />
      )}
    </>
  );
}

export function ExpenseModal({
  expense,
  onClose,
  onSave,
}: {
  expense?: Expense;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [category, setCategory] = useState(expense?.category ?? "UTILITIES"),
    [description, setDescription] = useState(expense?.description ?? ""),
    [payee, setPayee] = useState(expense?.payee ?? ""),
    [amount, setAmount] = useState(expense ? String(expense.amount) : ""),
    [method, setMethod] = useState(expense?.paymentMethod ?? "CASH"),
    [reference, setReference] = useState(expense?.reference ?? ""),
    [notes, setNotes] = useState(expense?.notes ?? ""),
    [expenseDate, setExpenseDate] = useState(
      expense?.expenseDate.slice(0, 10) ?? today(),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        category,
        description: description.trim(),
        payee: payee.trim() || null,
        amount: Number(amount),
        paymentMethod: method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        expenseDate,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save expense");
      setBusy(false);
    }
  }
  return (
    <Modal
      title={expense ? "Edit expense" : "Record an expense"}
      subtitle="Enter the amount paid and the date it was paid."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Date paid">
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </Field>
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {expenseCategoryLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <input
              required
              maxLength={300}
              placeholder="e.g. Electricity bill"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Amount">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Payment method">
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {paymentMethodOptions.map((m) => (
                <option key={m} value={m}>
                  {statusLabels[m] ?? m.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Paid to (optional)">
            <input
              maxLength={120}
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
            />
          </Field>
          <Field label="Reference (optional)">
            <input
              maxLength={120}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Notes (optional)" className="wide-field">
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
            {busy ? "Saving…" : expense ? "Save changes" : "Record expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function VoidExpenseModal({
  expense,
  onClose,
  onVoid,
}: {
  expense: Expense;
  onClose: () => void;
  onVoid: (expense: Expense, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onVoid(expense, reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not void expense");
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Void expense"
      subtitle={`${expenseCategoryLabel(expense.category)} · ${money(expense.amount)}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="card-notice warning">
          <strong>This expense will be excluded from reports.</strong>The entry
          remains in the audit history.
        </div>
        <Field label="Reason for voiding">
          <textarea
            rows={3}
            minLength={3}
            maxLength={500}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
            Cancel
          </button>
          <button className="primary-button danger-button" disabled={busy}>
            <Trash2 size={15} />
            {busy ? "Voiding…" : "Confirm void"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
