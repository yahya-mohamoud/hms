import { Modal, Empty, Loading, Metric, SectionHeading, Card, Field } from "../../components/ui";
import { useLoad } from "../../hooks/useLoad";
import { api, post, patch } from "../../lib/api";
import { escapeHtml, money, guestName, statusLabels } from "../../lib/domain";
import { type Stay, type Invoice } from "../../types";
import { Plus, CreditCard, FileText, Check, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

export function FolioModal({
  stay,
  onClose,
  flash,
}: {
  stay: Stay;
  onClose: () => void;
  flash: (s: string) => void;
}) {
  const [v, setV] = useState(0);
  const { data: folio } = useLoad<any>(
    stay.folio ? `/billing/folio/${stay.folio.id}` : null,
    [stay.id, v],
  );
  const [activeCard, setActiveCard] = useState<
    "none" | "add_charge" | "record_payment"
  >("none");
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [removingItem, setRemovingItem] = useState<any | null>(null);
  if (!stay.folio)
    return (
      <Modal title="Folio" onClose={onClose}>
        <Empty title="No folio found" copy="This stay has no billing folio." />
      </Modal>
    );
  const charge = folio?.summary?.charges ?? 0,
    paid = folio?.summary?.paid ?? 0;
  async function record(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      setV((x) => x + 1);
      flash(message);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not update folio");
      throw e;
    }
  }
  async function printInvoice() {
    try {
      const inv = await api<Invoice>(`/billing/folio/${folio.id}/invoice`);
      const w = window.open("", "_blank");
      if (w) {
        const printDate = new Date().toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const formatDate = (value?: string | null) =>
          value
            ? new Date(value).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—";
        w.document
          .write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${escapeHtml(inv.folioNumber)}</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#172033;font:14px/1.5 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.invoice{max-width:780px;margin:36px auto;padding:0 24px}.topline{height:5px;background:#4338ca;margin-bottom:34px}.header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:28px;border-bottom:1px solid #e5e7eb}.brand{display:flex;align-items:center;gap:12px}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:#4338ca;color:#fff;font-size:19px;font-weight:700}.hotel{font-size:20px;font-weight:700;letter-spacing:-.4px;color:#111827}.label{color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}.invoice-title{text-align:right}.invoice-title h1{margin:2px 0 4px;font-size:29px;line-height:1.1;letter-spacing:1px;color:#111827}.invoice-title strong{font-size:13px;color:#4338ca}.info-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;margin:28px 0}.info-card{padding:17px 18px;border:1px solid #e5e7eb;border-radius:10px}.info-card h2{margin:0 0 10px;color:#6b7280;font-size:10px;letter-spacing:1.1px;text-transform:uppercase}.info-card strong{display:block;color:#111827;font-size:15px}.info-card p{margin:3px 0;color:#596273;font-size:12px}.stay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 30px;padding:16px 18px;background:#f8fafc;border-radius:10px}.stay-grid span{display:block;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}.stay-grid strong{display:block;margin-top:4px;color:#172033;font-size:13px}.section-title{margin:0 0 10px;color:#111827;font-size:13px;font-weight:700}.items{width:100%;border-collapse:collapse}.items th{padding:11px 12px;background:#f3f4f6;color:#596273;font-size:10px;letter-spacing:.8px;text-align:left;text-transform:uppercase}.items th:first-child{border-radius:7px 0 0 7px}.items th:last-child{border-radius:0 7px 7px 0}.items td{padding:14px 12px;border-bottom:1px solid #edf0f3;color:#374151;font-size:12px}.items .num{text-align:right;white-space:nowrap}.items td:first-child{font-weight:600;color:#172033}.after-items{display:grid;grid-template-columns:1fr 270px;gap:30px;margin-top:24px}.payment-note{color:#6b7280;font-size:11px}.payment-list{width:100%;border-collapse:collapse}.payment-list td{padding:7px 0;border-bottom:1px solid #edf0f3;color:#596273;font-size:11px}.payment-list td:last-child{text-align:right;color:#172033;font-weight:600;white-space:nowrap}.totals{padding:16px 18px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px}.total-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;color:#596273;font-size:12px}.total-row strong{color:#172033}.balance{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px -6px -6px;padding:13px 12px;background:#eef2ff;border-radius:7px;color:#3730a3;font-weight:700}.balance strong{font-size:18px;white-space:nowrap}.footer{margin-top:38px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:16px;color:#6b7280;font-size:10px}.footer strong{color:#374151}@media(max-width:600px){.invoice{margin:18px auto;padding:0 14px}.header{gap:12px}.hotel{font-size:16px}.invoice-title h1{font-size:23px}.info-grid{grid-template-columns:1fr}.after-items{grid-template-columns:1fr}.stay-grid{gap:8px;padding:13px}.items th,.items td{padding:10px 7px;font-size:10px}.mark{width:36px;height:36px}}@media print{body{font-size:12px}.invoice{max-width:none;margin:0;padding:0}.topline{margin-bottom:26px}.info-card,.totals,.stay-grid{-webkit-print-color-adjust:exact;print-color-adjust:exact}.items tr,.payment-list tr{break-inside:avoid}.footer{margin-top:28px}}
    </style></head><body><main class="invoice"><div class="topline"></div><header class="header"><div class="brand"><div class="mark">S</div><div><div class="hotel">${escapeHtml(inv.hotel)}</div><div class="label">Guest statement</div></div></div><div class="invoice-title"><div class="label">Invoice</div><h1>INVOICE</h1><strong>${escapeHtml(inv.folioNumber)}</strong></div></header><section class="info-grid"><div class="info-card"><h2>Bill to</h2><strong>${escapeHtml(inv.guest.firstName)} ${escapeHtml(inv.guest.lastName)}</strong>${inv.guest.phone ? `<p>${escapeHtml(inv.guest.phone)}</p>` : ""}${inv.guest.email ? `<p>${escapeHtml(inv.guest.email)}</p>` : ""}</div><div class="info-card"><h2>Invoice details</h2><p>Invoice number <strong>${escapeHtml(inv.folioNumber)}</strong></p><p>Issued <strong>${escapeHtml(printDate)}</strong></p><p>Room <strong>${escapeHtml(inv.room.number)} · ${escapeHtml(inv.room.type)}</strong></p></div></section><section class="stay-grid"><div><span>Check-in</span><strong>${escapeHtml(formatDate(inv.checkIn))}</strong></div><div><span>Check-out</span><strong>${escapeHtml(formatDate(inv.checkOut))}</strong></div><div><span>Room</span><strong>${escapeHtml(inv.room.number)}</strong></div></section><h2 class="section-title">Charges</h2><table class="items"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${inv.items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td class="num">${escapeHtml(item.quantity)}</td><td class="num">${money(item.unitPrice)}</td><td class="num">${money(item.amount)}</td></tr>`).join("")}</tbody></table><section class="after-items"><div><h2 class="section-title">Payments received</h2>${inv.payments.length ? `<table class="payment-list"><tbody>${inv.payments.map((payment) => `<tr><td>${escapeHtml(payment.method.replaceAll("_", " "))}${payment.reference ? ` · ${escapeHtml(payment.reference)}` : ""}<br><span>${escapeHtml(formatDate(payment.receivedAt))}</span></td><td>${money(payment.amount)}</td></tr>`).join("")}</tbody></table>` : '<p class="payment-note">No payments have been recorded.</p>'}</div><div class="totals"><div class="total-row"><span>Total charges</span><strong>${money(inv.total)}</strong></div><div class="total-row"><span>Payments received</span><strong>− ${money(inv.paid)}</strong></div><div class="balance"><span>${Number(inv.balance) > 0 ? "Balance due" : "Balance"}</span><strong>${money(inv.balance)}</strong></div></div></section><footer class="footer"><span><strong>${escapeHtml(inv.hotel)}</strong> · Thank you for your stay.</span><span>Printed ${escapeHtml(printDate)}</span></footer></main><script>window.print()</script></body></html>`);
        w.document.close();
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "Unable to create invoice");
    }
  }
  return (
    <Modal
      title={`Guest folio · ${stay.folio.folioNumber}`}
      subtitle={`${guestName(stay.guest)} · Room ${stay.room.number}`}
      onClose={onClose}
      wide
    >
      <div className="folio-body">
        {!folio ? (
          <Loading />
        ) : (
          <>
            <div className="folio-summary">
              <Metric label="Charges" value={money(charge)} />
              <Metric label="Paid" value={money(paid)} />
              <Metric label="Balance due" value={money(charge - paid)} />
            </div>
            {editingItem && (
              <EditChargeCard
                folioId={folio.id}
                item={editingItem}
                onSave={record}
                onCancel={() => setEditingItem(null)}
              />
            )}
            {removingItem && (
              <RemoveChargeCard
                folioId={folio.id}
                item={removingItem}
                onSave={record}
                onCancel={() => setRemovingItem(null)}
              />
            )}
            {activeCard === "add_charge" && (
              <AddChargeCard
                folioId={folio.id}
                onSave={record}
                onCancel={() => setActiveCard("none")}
              />
            )}
            {activeCard === "record_payment" && (
              <RecordPaymentCard
                folioId={folio.id}
                balanceDue={Math.max(0, charge - paid)}
                onSave={record}
                onCancel={() => setActiveCard("none")}
              />
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Amount</th>
                    {folio.status === "OPEN" && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {folio.items.map((i: any) => (
                    <tr key={i.id}>
                      <td>{i.description}</td>
                      <td>{Number(i.quantity)}</td>
                      <td>{money(i.unitPrice)}</td>
                      <td>{money(i.amount)}</td>
                      {folio.status === "OPEN" && (
                        <td>
                          <button
                            className="small-button"
                            onClick={() => {
                              setRemovingItem(null);
                              setActiveCard("none");
                              setEditingItem(i);
                            }}
                          >
                            Edit
                          </button>{" "}
                          <button
                            className="small-button"
                            onClick={() => {
                              setEditingItem(null);
                              setActiveCard("none");
                              setRemovingItem(i);
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SectionHeading title="Payments" />
            {folio.payments.map((p: any) => (
              <div className="payment-row" key={p.id}>
                <span>
                  {statusLabels[p.method] ?? p.method.replace("_", " ")}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <strong>{money(p.amount)}</strong>
              </div>
            ))}
            <div className="folio-actions">
              {folio.status === "OPEN" && (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setEditingItem(null);
                      setRemovingItem(null);
                      setActiveCard(
                        activeCard === "add_charge" ? "none" : "add_charge",
                      );
                    }}
                  >
                    <Plus size={15} /> Add charge
                  </button>
                  <button
                    className="secondary-button"
                    disabled={charge <= paid}
                    onClick={() => {
                      setEditingItem(null);
                      setRemovingItem(null);
                      setActiveCard(
                        activeCard === "record_payment"
                          ? "none"
                          : "record_payment",
                      );
                    }}
                  >
                    <CreditCard size={15} /> Record payment
                  </button>
                </>
              )}
              <button className="primary-button" onClick={printInvoice}>
                <FileText size={15} /> Print invoice
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function AddChargeCard({
  folioId,
  onSave,
  onCancel,
}: {
  folioId: string;
  onSave: (action: () => Promise<unknown>, message: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"EXTRA" | "TAX" | "DISCOUNT">("EXTRA");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total =
    (Number(price) || 0) * (Number(qty) || 1) * (type === "DISCOUNT" ? -1 : 1);

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (!desc.trim()) {
      setError("Enter a description for this charge");
      return;
    }

    if (price === "" || isNaN(Number(price))) {
      setError("Enter a valid unit price");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onSave(async () => {
        await post(`/billing/folio/${folioId}/items`, {
          description: desc.trim(),
          unitPrice: Number(price),
          quantity: Number(qty) || 1,
          type,
        });
      }, "Charge added to folio");
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add charge");
      setBusy(false);
    }
  }

  return (
    <Card className="folio-action-card">
      <SectionHeading
        title="Add charge to folio"
        meta="Post extra services, room amenities or taxes"
      />
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Description">
            <input
              placeholder="e.g. Breakfast buffet, laundry, airport transfer"
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Charge category">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="EXTRA">Extra service</option>
              <option value="TAX">Tax charge</option>
              <option value="DISCOUNT">Discount adjustment</option>
            </select>
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              required
            />
          </Field>
          <Field label="Unit price">
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) =>
                setPrice(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
            />
          </Field>
          <div className="wide-field">
            <div className="total-preview">
              <span>Estimated item total</span>
              <strong>{money(total)}</strong>
            </div>
          </div>
        </div>
        {error && (
          <div className="form-error" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        <div className="card-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            <Check size={15} />
            {busy ? "Adding…" : "Add charge"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function RecordPaymentCard({
  folioId,
  balanceDue,
  onSave,
  onCancel,
}: {
  folioId: string;
  balanceDue: number;
  onSave: (action: () => Promise<unknown>, message: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState<number | "">(
    balanceDue > 0 ? balanceDue : "",
  );
  const [method, setMethod] = useState<
    "CASH" | "COOPAY_EBIRR" | "EBIRR_KAAFI" | "CBE_BANK" | "OTHER"
  >("CASH");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();

    const num = Number(amount);
    if (!num || num <= 0) {
      setError("Enter a payment amount greater than zero");
      return;
    }

    if (num > balanceDue) {
      setError(
        `Payment cannot exceed outstanding balance of ${money(balanceDue)}`,
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      await onSave(async () => {
        await post(`/billing/folio/${folioId}/payments`, {
          amount: num,
          method,
          reference: reference.trim() || undefined,
        });
      }, "Payment recorded");
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment");
      setBusy(false);
    }
  }

  return (
    <Card className="folio-action-card">
      <SectionHeading
        title="Record payment"
        meta={`Outstanding balance due: ${money(balanceDue)}`}
      />
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Payment amount">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={balanceDue}
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
              autoFocus
            />
          </Field>
          <Field label="Payment method">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
            >
              <option value="CASH">Cash</option>
              <option value="COOPAY_EBIRR">Coopay Ebirr</option>
              <option value="EBIRR_KAAFI">Ebirr Kaafi</option>
              <option value="CBE_BANK">CBE Bank</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Reference / notes (optional)">
            <input
              placeholder="e.g. Receipt #, transaction code"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
        </div>
        {error && (
          <div className="form-error" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        <div className="card-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            <CreditCard size={15} />
            {busy ? "Recording…" : "Record payment"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function EditChargeCard({
  folioId,
  item,
  onSave,
  onCancel,
}: {
  folioId: string;
  item: any;
  onSave: (a: () => Promise<unknown>, msg: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(item.description);
  const [quantity, setQuantity] = useState<number>(Number(item.quantity) || 1);
  const [unitPrice, setUnitPrice] = useState<number>(
    Number(item.unitPrice) || 0,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Enter a description");
      return;
    }
    if (!quantity || quantity <= 0) {
      setError("Quantity must be at least 1");
      return;
    }
    if (isNaN(unitPrice)) {
      setError("Enter a valid price");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onSave(async () => {
        await patch(`/billing/folio/${folioId}/items/${item.id}`, {
          description: description.trim(),
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
        });
      }, "Charge updated");
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update charge");
      setBusy(false);
    }
  }
  return (
    <Card className="folio-action-card">
      <SectionHeading
        title={`Edit charge · ${item.description}`}
        meta="Update item description, quantity, or unit price"
      />
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Unit price">
            <input
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              required
            />
          </Field>
          <div className="wide-field">
            <div className="total-preview">
              <span>Updated total</span>
              <strong>{money(quantity * unitPrice)}</strong>
            </div>
          </div>
        </div>
        {error && (
          <div className="form-error" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
        <div className="card-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            <Check size={15} />
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function RemoveChargeCard({
  folioId,
  item,
  onSave,
  onCancel,
}: {
  folioId: string;
  item: any;
  onSave: (action: () => Promise<unknown>, message: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmRemove() {
    setBusy(true);
    setError("");
    try {
      await onSave(async () => {
        await api(`/billing/folio/${folioId}/items/${item.id}`, {
          method: "DELETE",
        });
      }, "Charge removed");
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove charge");
      setBusy(false);
    }
  }
  return (
    <Card className="folio-action-card danger-card">
      <SectionHeading
        title="Remove charge item"
        meta="Deduct this charge from the guest folio"
      />
      <div className="card-notice danger">
        Are you sure you want to remove <strong>“{item.description}”</strong> (
        {money(item.amount)}) from this folio?
      </div>
      {error && (
        <div className="form-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
      <div className="card-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
          disabled={busy}
        >
          Keep item
        </button>
        <button
          type="button"
          className="primary-button danger-button"
          onClick={confirmRemove}
          disabled={busy}
        >
          <Trash2 size={15} />
          {busy ? "Removing…" : "Remove charge"}
        </button>
      </div>
    </Card>
  );
}
