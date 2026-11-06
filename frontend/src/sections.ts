import { Sprout, Tractor, Warehouse } from "lucide-react";

export type Section = "crops" | "machinery" | "storage";

export const SECTIONS = [
  { key: "crops", label: "Crops", icon: Sprout, title: "Fresh harvests near you", noun: "crops" },
  { key: "machinery", label: "Machinery", icon: Tractor, title: "Rent farm equipment", noun: "machinery" },
  { key: "storage", label: "Storage", icon: Warehouse, title: "Find space for your produce", noun: "storage" },
] as const;

export const CROP_CATEGORIES = ["All", "Vegetables", "Fruits", "Grains"];
