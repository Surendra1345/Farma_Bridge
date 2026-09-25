import type { CropListing, MachineListing, StorageListing } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error("Could not load marketplace listings.");
  return response.json() as Promise<T>;
}

export const marketplaceApi = {
  crops: () => get<CropListing[]>("/crop-listings"),
  machines: () => get<MachineListing[]>("/machine-listings"),
  storage: () => get<StorageListing[]>("/storage-listings"),
};

export const mediaUrl = (path?: string | null) => {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
};
