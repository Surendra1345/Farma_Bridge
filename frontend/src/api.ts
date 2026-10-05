import type {
  User,
  UserRole,
  CropListing,
  MachineListing,
  StorageListing,
  BuyerRequirement,
  Order,
  Booking,
  Review,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") errorDetail = data.detail;
      else if (Array.isArray(data.detail)) errorDetail = data.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
    } catch {
      errorDetail = `${response.status} ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }
  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  // Users & Auth
  users: {
    register: (payload: {
      name: string;
      phone_number: string;
      email: string;
      password: string;
      address: string;
      location: string;
    }) =>
      request<User>("/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    login: (identifier: string, password: string) =>
      request<User>("/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      }),
    get: (userId: number) => request<User>(`/users/${userId}`),
    sendOtp: (email: string) =>
      request<{ message: string }>("/users/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    verifyOtp: (email: string, otp: string) =>
      request<User>("/users/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      }),
    getRoles: (userId: number) => request<UserRole[]>(`/users/${userId}/roles`),
    addRole: (userId: number, role_type: string) =>
      request<UserRole>(`/users/${userId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_type }),
      }),
    updateRole: (userId: number, role_type: string, active: boolean) =>
      request<UserRole>(`/users/${userId}/roles/${role_type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      }),
    deactivateRole: (userId: number, role_type: string) =>
      request<void>(`/users/${userId}/roles/${role_type}`, {
        method: "DELETE",
      }),
  },

  // Crop Listings (Farmers)
  crops: {
    browse: (params?: { category?: string; crop_name?: string; min_price?: number; max_price?: number; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.category && params.category !== "All") q.append("category", params.category);
      if (params?.crop_name) q.append("crop_name", params.crop_name);
      if (params?.min_price) q.append("min_price", params.min_price.toString());
      if (params?.max_price) q.append("max_price", params.max_price.toString());
      if (params?.status) q.append("status", params.status);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return request<CropListing[]>(`/crop-listings${queryStr}`);
    },
    get: (id: number) => request<CropListing>(`/crop-listings/${id}`),
    create: (formData: FormData) =>
      request<CropListing>("/crop-listings", {
        method: "POST",
        body: formData,
      }),
    update: (id: number, formData: FormData) =>
      request<CropListing>(`/crop-listings/${id}`, {
        method: "PUT",
        body: formData,
      }),
    delete: (id: number, userId: number) =>
      request<void>(`/crop-listings/${id}?user_id=${userId}`, {
        method: "DELETE",
      }),
  },

  // Machinery Listings
  machines: {
    browse: (params?: { machine_type?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.machine_type) q.append("machine_type", params.machine_type);
      if (params?.status) q.append("status", params.status);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return request<MachineListing[]>(`/machine-listings${queryStr}`);
    },
    get: (id: number) => request<MachineListing>(`/machine-listings/${id}`),
    create: (formData: FormData) =>
      request<MachineListing>("/machine-listings", {
        method: "POST",
        body: formData,
      }),
    update: (id: number, formData: FormData) =>
      request<MachineListing>(`/machine-listings/${id}`, {
        method: "PUT",
        body: formData,
      }),
    delete: (id: number, ownerId: number) =>
      request<void>(`/machine-listings/${id}?owner_id=${ownerId}`, {
        method: "DELETE",
      }),
  },

  // Storage Listings
  storage: {
    browse: (params?: { storage_type?: string; availability?: string }) => {
      const q = new URLSearchParams();
      if (params?.storage_type) q.append("storage_type", params.storage_type);
      if (params?.availability) q.append("availability", params.availability);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return request<StorageListing[]>(`/storage-listings${queryStr}`);
    },
    get: (id: number) => request<StorageListing>(`/storage-listings/${id}`),
    create: (formData: FormData) =>
      request<StorageListing>("/storage-listings", {
        method: "POST",
        body: formData,
      }),
    update: (id: number, formData: FormData) =>
      request<StorageListing>(`/storage-listings/${id}`, {
        method: "PUT",
        body: formData,
      }),
    delete: (id: number, ownerId: number) =>
      request<void>(`/storage-listings/${id}?owner_id=${ownerId}`, {
        method: "DELETE",
      }),
  },

  // Buyer Requirements
  buyers: {
    browse: (params?: { crop_type?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.crop_type) q.append("crop_type", params.crop_type);
      if (params?.status) q.append("status", params.status);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return request<BuyerRequirement[]>(`/buyer-requirements${queryStr}`);
    },
    get: (id: number) => request<BuyerRequirement>(`/buyer-requirements/${id}`),
    create: (userId: number, payload: {
      crop_type: string;
      quantity_needed: number;
      unit: string;
      quality_grade?: string;
      budget_min?: number;
      budget_max?: number;
      delivery_location: string;
      deadline: string;
    }) =>
      request<BuyerRequirement>(`/buyer-requirements?user_id=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (id: number, userId: number, payload: {
      crop_type: string;
      quantity_needed: number;
      unit: string;
      quality_grade?: string;
      budget_min?: number;
      budget_max?: number;
      delivery_location: string;
      deadline: string;
      status?: string;
    }) =>
      request<BuyerRequirement>(`/buyer-requirements/${id}?user_id=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    delete: (id: number, userId: number) =>
      request<void>(`/buyer-requirements/${id}?user_id=${userId}`, {
        method: "DELETE",
      }),
  },

  // Orders
  orders: {
    browse: (params?: { buyer_id?: number; farmer_id?: number; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.buyer_id) q.append("buyer_id", params.buyer_id.toString());
      if (params?.farmer_id) q.append("farmer_id", params.farmer_id.toString());
      if (params?.status) q.append("status", params.status);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return request<Order[]>(`/orders${queryStr}`);
    },
    get: (orderId: number) => request<Order>(`/orders/${orderId}`),
    create: (buyerId: number, listingId: number, quantity: number) =>
      request<Order>(`/orders?buyer_id=${buyerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, quantity_ordered: quantity }),
      }),
    updateStatus: (orderId: number, userId: number, status: string) =>
      request<Order>(`/orders/${orderId}/status?user_id=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
  },

  // Bookings
  bookings: {
    browse: (params?: { requester_id?: number; provider_id?: number; booking_type?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.requester_id) q.append("requester_id", params.requester_id.toString());
      if (params?.provider_id) q.append("provider_id", params.provider_id.toString());
      if (params?.booking_type) q.append("booking_type", params.booking_type);
      if (params?.status) q.append("status", params.status);
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return request<Booking[]>(`/bookings${queryStr}`);
    },
    create: (requesterId: number, payload: {
      booking_type: "machine" | "storage";
      reference_id: number;
      start_date: string;
      end_date: string;
      total_price: number;
    }) =>
      request<Booking>(`/bookings?requester_id=${requesterId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    updateStatus: (bookingId: number, userId: number, status: string) =>
      request<Booking>(`/bookings/${bookingId}/status?user_id=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
  },

  // Reviews
  reviews: {
    browse: (
      params?:
        | number
        | {
            reviewed_user_id?: number;
            reviewer_id?: number;
            context_type?: string;
            context_id?: number;
          }
    ) => {
      const q = new URLSearchParams();
      if (typeof params === "number") {
        q.append("reviewed_user_id", params.toString());
      } else if (params) {
        if (params.reviewed_user_id) q.append("reviewed_user_id", params.reviewed_user_id.toString());
        if (params.reviewer_id) q.append("reviewer_id", params.reviewer_id.toString());
        if (params.context_type) q.append("context_type", params.context_type);
        if (params.context_id) q.append("context_id", params.context_id.toString());
      }
      const queryStr = q.toString() ? `?${q.toString()}` : "";
      return request<Review[]>(`/reviews${queryStr}`);
    },
    create: (reviewerId: number, payload: {
      reviewed_user_id: number;
      rating: number;
      comment?: string;
      context_type?: string;
      context_id?: number;
    }) =>
      request<Review>(`/reviews?reviewer_id=${reviewerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  },

  // Reports
  reports: {
    create: (reporterId: number, payload: {
      reported_user_id: number;
      reason: string;
      description?: string;
    }) =>
      request<{ report_id: number; status: string }>(`/user-reports?reporter_id=${reporterId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  },
};

export const mediaUrl = (path?: string | null) => {
  if (!path) return undefined;
  const cleanPath = path.replace(/\\/g, "/");
  if (cleanPath.startsWith("http")) return cleanPath;
  return cleanPath;
};
