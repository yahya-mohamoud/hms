import { statusLabels } from "../lib/domain";
import { Sparkles, X } from "lucide-react";
import { type ReactNode } from "react";

export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className}`} id={id}>
      {children}
    </section>
  );
}

export function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h3>{title}</h3>
        {meta && <span>{meta}</span>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ value }: { value: string }) {
  const key = value.toLowerCase().replaceAll("_", "-");
  return (
    <span className={`badge badge-${key}`}>
      {statusLabels[value] ?? value.replaceAll("_", " ")}
    </span>
  );
}

export function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Sparkles size={19} />
      </div>
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading">
      <span className="spinner" /> Loading hotel data…
    </div>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <span>{subtitle}</span>}
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <Card>
      <Empty
        title="Could not load this view"
        copy={message || "Please check your connection and try again."}
      />
    </Card>
  );
}
