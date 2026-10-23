

export type Room = {
  id: string;
  number: string;
  type: string;
  status: string;
  baseRate: number | string;
  floor?: number | null;
  capacity?: number;
  stayCount?: number;
  notes?: string | null;
  stays?: Stay[];
};

export type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  notes?: string | null;
  preferences?: string | null;
};

export type Reservation = {
  id: string;
  confirmationCode: string;
  arrivalDate: string;
  departureDate: string;
  source: string;
  status: string;
  nightlyRate: number | string;
  depositAmount: number | string;
  depositMethod?: string;
  cancellationNote?: string | null;
  guest: Guest;
  room?: Room | null;
  roomId?: string | null;
  roomType?: string | null;
  groupName?: string | null;
  groupCode?: string | null;
};

export type Stay = {
  id: string;
  status: string;
  guest: Guest;
  room: Room;
  checkInAt: string;
  expectedCheckOut: string;
  nightlyRate: number | string;
  folio?: {
    id: string;
    folioNumber: string;
    items: { amount: number | string }[];
    payments: { amount: number | string }[];
  } | null;
};

export type Invoice = {
  hotel: string;
  folioNumber: string;
  guest: Guest;
  room: Room;
  checkIn: string;
  checkOut?: string | null;
  items: {
    description: string;
    quantity: number | string;
    unitPrice: number | string;
    amount: number | string;
  }[];
  payments: {
    method: string;
    reference?: string | null;
    receivedAt: string;
    amount: number | string;
  }[];
  total: number | string;
  paid: number | string;
  balance: number | string;
};

export type Dashboard = {
  date: string;
  arrivals: Reservation[];
  departures: Stay[];
  occupancy: { occupied: number; total: number; percent: number };
  inHouse: number;
  paymentsToday: number;
  rooms: Room[];
};

export type Expense = {
  id: string;
  category: string;
  description: string;
  payee?: string | null;
  amount: number | string;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  expenseDate: string;
  voidedAt?: string | null;
  voidReason?: string | null;
};

export type Page =
  | "Overview"
  | "Rooms"
  | "Reservations"
  | "Guests"
  | "In-house"
  | "Expenses"
  | "Reports"
  | "Team";
