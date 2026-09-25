export type CropListing = {
  id: number; user_id: number; crop_name: string; category: string; quantity: number;
  quantity_remaining: number; unit: string; price_per_kg: number; quality_grade?: string | null;
  location: string; post_cultivation_photo: string; status: string;
};

export type MachineListing = {
  listing_id: number; machine_type: string; price_per_unit: number; pricing_unit: string;
  location: string; machine_photos?: string | null; status: string;
};

export type StorageListing = {
  listing_id: number; storage_type: string; price: number; pricing_unit: string;
  total_capacity: number; location: string; storage_photo?: string | null;
  availability_indicator: string;
};
