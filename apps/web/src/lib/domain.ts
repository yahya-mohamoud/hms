import { type Page, type Guest } from "../types";
import { DoorOpen, ChartNoAxesCombined, BedDouble, CalendarDays, Users, Receipt, FileText, ClipboardList } from "lucide-react";

export const statusLabels: Record<string, string> = {
  CASH: "Cash",
  COOPAY_EBIRR: "Coopay Ebirr",
  EBIRR_KAAFI: "Ebirr Kaafi",
  CBE_BANK: "CBE Bank",
  OTHER: "Other",
  MOBILE_MONEY: "Mobile money",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  DIRTY: "Dirty",
  CLEAN: "Clean",
  INSPECTED: "Inspected",
  OUT_OF_ORDER: "Out of order",
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  HOUSEKEEPING: "Worker account",
};

export const nav: { label: Page; icon: typeof DoorOpen }[] = [
  { label: "Overview", icon: ChartNoAxesCombined },
  { label: "Rooms", icon: BedDouble },
  { label: "Reservations", icon: CalendarDays },
  { label: "Guests", icon: Users },
  { label: "In-house", icon: DoorOpen },
  { label: "Expenses", icon: Receipt },
  { label: "Reports", icon: FileText },
  { label: "Team", icon: ClipboardList },
];

export const today = () => new Date().toLocaleDateString("en-CA");

export const money = (value: number | string | undefined) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const dateLabel = (
  value?: string | null,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
        undefined,
        options,
      )
    : "—";

export const guestName = (guest: Guest) => `${guest.firstName} ${guest.lastName}`;

export const expenseCategories = [
  "UTILITIES",
  "SUPPLIES",
  "MAINTENANCE",
  "FOOD",
  "TRANSPORT",
  "SALARIES",
  "TAXES",
  "OTHER",
];

export const expenseCategoryLabel = (category: string) =>
  category.charAt(0) + category.slice(1).toLowerCase().replaceAll("_", " ");

export const paymentMethodOptions = [
  "CASH",
  "COOPAY_EBIRR",
  "EBIRR_KAAFI",
  "CBE_BANK",
  "OTHER",
  "MOBILE_MONEY",
  "CARD",
  "BANK_TRANSFER",
];

export function shiftDay(value: string, amount: number) {
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return d.toLocaleDateString("en-CA");
}

export function shiftMonth(value: string, amount: number) {
  const d = new Date(`${value}-15T12:00:00`);
  d.setMonth(d.getMonth() + amount);
  return d.toLocaleDateString("en-CA").slice(0, 7);
}

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}
