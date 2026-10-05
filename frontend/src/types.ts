export type User = {
  id: number;
  name: string;
  phone_number: string;
  email: string;
  address: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  trust_score?: number | null;
};

export type UserRole = {
  id: number;
  user_id: number;
  role_type: "farmer" | "buyer" | "machine_owner" | "storage_owner" | string;
  activated_at?: string | null;
  deactivated_at?: string | null;
};

export type CropListing = {
  id: number;
  user_id: number;
  crop_name: string;
  category: string;
  quantity: number;
  quantity_remaining: number;
  unit: string;
  price_per_kg: number;
  quality_grade?: string | null;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  post_cultivation_photo: string;
  pre_cultivation_photo?: string | null;
  status: string;
  view_count: number;
  contact_count: number;
  posted_at?: string | null;
  expires_at?: string | null;
};

export type MachineListing = {
  listing_id: number;
  owner_id: number;
  machine_type: string;
  pricing_unit: string;
  price_per_unit: number;
  years_experience?: number | null;
  operator_included?: boolean | null;
  machine_condition?: string | null;
  location: string;
  machine_photos?: string | null;
  status: string;
  verified_badge: boolean;
};

export type StorageListing = {
  listing_id: number;
  owner_id: number;
  storage_type: string;
  total_capacity: number;
  pricing_unit: string;
  price: number;
  temperature_range?: string | null;
  years_in_operation?: number | null;
  additional_services?: string | null;
  location: string;
  storage_photo?: string | null;
  availability_indicator: string;
  verified_badge: boolean;
};

export type BuyerRequirement = {
  id: number;
  user_id: number;
  crop_type: string;
  quantity_needed: number;
  unit: string;
  quality_grade?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  delivery_location: string;
  deadline: string;
  status: string;
  posted_at?: string | null;
};

export type Order = {
  order_id: number;
  listing_id: number;
  buyer_id: number;
  farmer_id: number;
  quantity_ordered: number;
  total_price: number;
  status: "Pending" | "Confirmed" | "Completed" | "Cancelled";
  ordered_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type Booking = {
  booking_id: number;
  booking_type: "machine" | "storage";
  reference_id: number;
  requester_id: number;
  provider_id: number;
  start_date: string;
  end_date: string;
  total_price: number;
  status: "Pending" | "Confirmed" | "Completed" | "Cancelled";
  created_at: string;
};

export type Review = {
  review_id: number;
  reviewer_id: number;
  reviewed_user_id: number;
  rating: number;
  comment?: string | null;
  context_type?: string | null;
  context_id?: number | null;
  created_at: string;
  reviewer_name?: string | null;
  reviewed_user_name?: string | null;
  product_title?: string | null;
};
