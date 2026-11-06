import type {
  AuthResponse, Booking, CropListing, MachineListing, Order, RegisterInput, Role, StorageListing, User,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

// The auth provider registers these so api.ts stays free of React.
let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};
export const configureApi = (opts: { getToken: () => string | null; onUnauthorized: () => void }) => {
  getToken = opts.getToken; onUnauthorized = opts.onUnauthorized;
};

function messageFrom(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401 && token) onUnauthorized();   // expired or invalid session
    throw new ApiError(messageFrom(body), response.status);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

const get = <T,>(path: string) => request<T>(path);
const send = <T,>(method: string, path: string, body: unknown) =>
  request<T>(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
type Fields = Record<string, string | number | File | undefined>;
const sendForm = <T,>(method: string, path: string, fields: Fields) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== "") form.append(key, value as string | Blob);
  return request<T>(path, { method, body: form });
};
const upload = <T,>(path: string, fields: Fields) => sendForm<T>("POST", path, fields);

export const marketplaceApi = {
  crops: () => get<CropListing[]>("/crop-listings"),
  machines: () => get<MachineListing[]>("/machine-listings"),
  storage: () => get<StorageListing[]>("/storage-listings"),
};

export const authApi = {
  sendOtp: (email: string) => send<{ message: string }>("POST", "/users/send-otp", { email }),
  verifyOtp: (email: string, otp: string) => send<AuthResponse>("POST", "/users/verify-otp", { email, otp }),
  register: (input: RegisterInput) => send<User>("POST", "/users/register", input),
  me: () => get<User>("/users/me"),
  addRole: (role_type: Role) => send<unknown>("POST", "/users/me/roles", { role_type }),
  updateProfile: (changes: Partial<Pick<User, "name" | "phone_number" | "address" | "location">>) => send<User>("PATCH", "/users/me", changes),
};

export const tradeApi = {
  myOrders: () => get<Order[]>("/orders"),
  myBookings: () => get<Booking[]>("/bookings"),
  setOrderStatus: (id: number, status: string) => send<Order>("PATCH", `/orders/${id}/status`, { status }),
  setBookingStatus: (id: number, status: string) => send<Booking>("PATCH", `/bookings/${id}/status`, { status }),
  placeOrder: (listing_id: number, quantity_ordered: number) => send<Order>("POST", "/orders", { listing_id, quantity_ordered }),
  book: (booking_type: "machine" | "storage", reference_id: number, start_date: string, end_date: string) =>
    send<Booking>("POST", "/bookings", { booking_type, reference_id, start_date, end_date }),
  postCrop: (f: Fields) => upload<CropListing>("/crop-listings", f),
  postMachine: (f: Fields) => upload<MachineListing>("/machine-listings", f),
  postStorage: (f: Fields) => upload<StorageListing>("/storage-listings", f),
  updateCrop: (id: number, f: Fields) => sendForm<CropListing>("PUT", `/crop-listings/${id}`, f),
  updateMachine: (id: number, f: Fields) => sendForm<MachineListing>("PUT", `/machine-listings/${id}`, f),
  updateStorage: (id: number, f: Fields) => sendForm<StorageListing>("PUT", `/storage-listings/${id}`, f),
  setCropStatus: (id: number, status: string) => request<CropListing>(`/crop-listings/${id}/availability?status=${encodeURIComponent(status)}`, { method: "PATCH" }),
  setMachineStatus: (id: number, status: string) => request<MachineListing>(`/machine-listings/${id}/status?status=${encodeURIComponent(status)}`, { method: "PATCH" }),
  setStorageStatus: (id: number, value: string) => request<StorageListing>(`/storage-listings/${id}/availability?availability_indicator=${encodeURIComponent(value)}`, { method: "PATCH" }),
  remove: (kind: "crop" | "machine" | "storage", id: number) =>
    request<void>(`/${kind}-listings/${id}`, { method: "DELETE" }),
};

export const mediaUrl = (path?: string | null) => {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
};
