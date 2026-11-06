export type CropListing = {
  id: number; user_id: number; crop_name: string; category: string; quantity: number;
  quantity_remaining: number; unit: string; price_per_kg: number; quality_grade?: string | null;
  location: string; post_cultivation_photo: string; status: string;
};

export type MachineListing = {
  listing_id: number; owner_id: number; machine_type: string; price_per_unit: number; pricing_unit: string;
  location: string; machine_photos?: string | null; status: string;
};

export type StorageListing = {
  listing_id: number; owner_id: number; storage_type: string; price: number; pricing_unit: string;
  total_capacity: number; location: string; storage_photo?: string | null;
  availability_indicator: string;
};

export type Role = "farmer" | "buyer" | "machine_owner" | "storage_owner";

export type User = {
  id: number; name: string; phone_number: string; email: string;
  address: string; location: string; trust_score?: number | null; roles: Role[];
};

export type AuthResponse = { access_token: string; token_type: string; user: User };

export type RegisterInput = {
  name: string; phone_number: string; email: string; address: string; location: string; roles: Role[];
};

export type Party = { id: number; name: string; location: string; phone_number?: string | null };

export type Order = {
  order_id: number; listing_id: number; buyer_id: number; farmer_id: number; quantity_ordered: number; total_price: number;
  status: string; ordered_at: string; completed_at?: string | null;
  listing_title?: string | null; listing_photo?: string | null; unit?: string | null; price_per_unit?: number | null;
  buyer?: Party | null; farmer?: Party | null;
};

export type Booking = {
  booking_id: number; booking_type: "machine" | "storage"; reference_id: number; requester_id: number; provider_id: number;
  start_date: string; end_date: string; total_price: number; status: string; created_at: string;
  listing_title?: string | null; listing_photo?: string | null; pricing_unit?: string | null;
  requester?: Party | null; provider?: Party | null;
};
