import { useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Sprout,
  Tractor,
  Warehouse,
  X,
} from "lucide-react";
import { api, mediaUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import type { CropListing, MachineListing, StorageListing, BuyerRequirement } from "../types";

export type EditableListing =
  | { type: "crop"; item: CropListing }
  | { type: "machine"; item: MachineListing }
  | { type: "storage"; item: StorageListing }
  | { type: "buyer"; item: BuyerRequirement };

export function EditListingModal({
  data,
  onClose,
  onSuccess,
}: {
  data: EditableListing;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crop states
  const cropItem = data.type === "crop" ? data.item : null;
  const [cropName, setCropName] = useState(cropItem?.crop_name ?? "");
  const [category, setCategory] = useState(cropItem?.category ?? "Grains");
  const [cropQuantity, setCropQuantity] = useState(cropItem?.quantity?.toString() ?? "10");
  const [cropUnit, setCropUnit] = useState(cropItem?.unit ?? "tons");
  const [pricePerKg, setPricePerKg] = useState(cropItem?.price_per_kg?.toString() ?? "100");
  const [qualityGrade, setQualityGrade] = useState(cropItem?.quality_grade ?? "A grade");
  const [cropLocation, setCropLocation] = useState(cropItem?.location ?? "");
  const [cropStatus, setCropStatus] = useState(cropItem?.status ?? "Available");
  const [newCropPhoto, setNewCropPhoto] = useState<File | null>(null);

  // Machine states
  const machineItem = data.type === "machine" ? data.item : null;
  const [machineType, setMachineType] = useState(machineItem?.machine_type ?? "Tractor");
  const [machinePricingUnit, setMachinePricingUnit] = useState(machineItem?.pricing_unit ?? "Per Acre");
  const [machinePrice, setMachinePrice] = useState(machineItem?.price_per_unit?.toString() ?? "1200");
  const [machineCondition, setMachineCondition] = useState(machineItem?.machine_condition ?? "Good");
  const [operatorIncluded, setOperatorIncluded] = useState(machineItem?.operator_included ?? true);
  const [machineLocation, setMachineLocation] = useState(machineItem?.location ?? "");
  const [machineStatus, setMachineStatus] = useState(machineItem?.status ?? "Available");
  const [newMachinePhoto, setNewMachinePhoto] = useState<File | null>(null);

  // Storage states
  const storageItem = data.type === "storage" ? data.item : null;
  const [storageType, setStorageType] = useState(storageItem?.storage_type ?? "Cold Storage");
  const [totalCapacity, setTotalCapacity] = useState(storageItem?.total_capacity?.toString() ?? "500");
  const [storagePricingUnit, setStoragePricingUnit] = useState(storageItem?.pricing_unit ?? "Per Month");
  const [storagePrice, setStoragePrice] = useState(storageItem?.price?.toString() ?? "250");
  const [storageLocation, setStorageLocation] = useState(storageItem?.location ?? "");
  const [availabilityIndicator, setAvailabilityIndicator] = useState(
    storageItem?.availability_indicator ?? "Plenty of Space"
  );
  const [temperatureRange, setTemperatureRange] = useState(storageItem?.temperature_range ?? "2°C to 8°C");
  const [newStoragePhoto, setNewStoragePhoto] = useState<File | null>(null);

  // Buyer Requirement states
  const buyerItem = data.type === "buyer" ? data.item : null;
  const [reqCropType, setReqCropType] = useState(buyerItem?.crop_type ?? "");
  const [reqQty, setReqQty] = useState(buyerItem?.quantity_needed?.toString() ?? "50");
  const [reqUnit, setReqUnit] = useState(buyerItem?.unit ?? "tons");
  const [reqBudgetMin, setReqBudgetMin] = useState(buyerItem?.budget_min?.toString() ?? "1000");
  const [reqBudgetMax, setReqBudgetMax] = useState(buyerItem?.budget_max?.toString() ?? "2500");
  const [reqLocation, setReqLocation] = useState(buyerItem?.delivery_location ?? "");
  const [reqDeadline, setReqDeadline] = useState(
    buyerItem?.deadline ? new Date(buyerItem.deadline).toISOString().split("T")[0] : ""
  );
  const [reqStatus, setReqStatus] = useState(buyerItem?.status ?? "Open");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setLoading(true);

    try {
      if (data.type === "crop" && cropItem) {
        const formData = new FormData();
        formData.append("user_id", user.id.toString());
        formData.append("crop_name", cropName);
        formData.append("category", category);
        formData.append("quantity", cropQuantity);
        formData.append("unit", cropUnit);
        formData.append("price_per_kg", pricePerKg);
        formData.append("quality_grade", qualityGrade);
        formData.append("location", cropLocation);
        formData.append("status", cropStatus);
        if (newCropPhoto) {
          formData.append("post_cultivation_photo", newCropPhoto);
        }
        await api.crops.update(cropItem.id, formData);
        onSuccess(`Crop listing '${cropName}' updated successfully!`);
      } else if (data.type === "machine" && machineItem) {
        const formData = new FormData();
        formData.append("owner_id", user.id.toString());
        formData.append("machine_type", machineType);
        formData.append("pricing_unit", machinePricingUnit);
        formData.append("price_per_unit", machinePrice);
        formData.append("machine_condition", machineCondition);
        formData.append("operator_included", operatorIncluded.toString());
        formData.append("location", machineLocation);
        formData.append("status", machineStatus);
        if (newMachinePhoto) {
          formData.append("machine_photo", newMachinePhoto);
        }
        await api.machines.update(machineItem.listing_id, formData);
        onSuccess(`Equipment listing '${machineType}' updated successfully!`);
      } else if (data.type === "storage" && storageItem) {
        const formData = new FormData();
        formData.append("owner_id", user.id.toString());
        formData.append("storage_type", storageType);
        formData.append("total_capacity", totalCapacity);
        formData.append("pricing_unit", storagePricingUnit);
        formData.append("price", storagePrice);
        formData.append("location", storageLocation);
        formData.append("availability_indicator", availabilityIndicator);
        formData.append("temperature_range", temperatureRange);
        if (newStoragePhoto) {
          formData.append("storage_photo", newStoragePhoto);
        }
        await api.storage.update(storageItem.listing_id, formData);
        onSuccess(`Storage facility '${storageType}' updated successfully!`);
      } else if (data.type === "buyer" && buyerItem) {
        await api.buyers.update(buyerItem.id, user.id, {
          crop_type: reqCropType,
          quantity_needed: parseFloat(reqQty) || 0,
          unit: reqUnit,
          budget_min: parseFloat(reqBudgetMin) || 0,
          budget_max: parseFloat(reqBudgetMax) || 0,
          delivery_location: reqLocation,
          deadline: reqDeadline,
          status: reqStatus,
        });
        onSuccess(`Procurement demand for '${reqCropType}' updated successfully!`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update listing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 overflow-y-auto max-h-[92vh]">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#e6f2e2] text-[#1d5a2b]">
            <Pencil className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {data.type === "crop"
                ? "Edit Crop Listing"
                : data.type === "machine"
                ? "Edit Machinery Listing"
                : data.type === "storage"
                ? "Edit Storage Facility"
                : "Edit Procurement Demand"}
            </h2>
            <p className="text-xs text-slate-500">
              Changes reflect immediately on the marketplace
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* CROP FORM */}
          {data.type === "crop" && cropItem && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Crop Name</label>
                <input
                  type="text"
                  required
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    {["Grains", "Vegetables", "Fruits", "Perishable", "Pulses", "Commercial"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Quality Grade</label>
                  <input
                    type="text"
                    value={qualityGrade}
                    onChange={(e) => setQualityGrade(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Quantity</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={cropQuantity}
                    onChange={(e) => setCropQuantity(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Unit</label>
                  <select
                    value={cropUnit}
                    onChange={(e) => setCropUnit(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    {["tons", "kg", "quintals", "bags"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Price (₹/unit)</label>
                  <input
                    type="number"
                    required
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Location</label>
                  <input
                    type="text"
                    required
                    value={cropLocation}
                    onChange={(e) => setCropLocation(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Listing Status</label>
                  <select
                    value={cropStatus}
                    onChange={(e) => setCropStatus(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    <option value="Available">Available</option>
                    <option value="Partially Sold">Partially Sold</option>
                    <option value="Sold">Sold Out</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Update Photo (Optional)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  {cropItem.post_cultivation_photo && (
                    <img
                      src={mediaUrl(cropItem.post_cultivation_photo) || ""}
                      alt="Current"
                      className="size-12 rounded-xl object-cover border border-slate-200"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewCropPhoto(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              </div>
            </>
          )}

          {/* MACHINERY FORM */}
          {data.type === "machine" && machineItem && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Machine / Model</label>
                <input
                  type="text"
                  required
                  value={machineType}
                  onChange={(e) => setMachineType(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Rate (₹)</label>
                  <input
                    type="number"
                    required
                    value={machinePrice}
                    onChange={(e) => setMachinePrice(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Pricing Basis</label>
                  <select
                    value={machinePricingUnit}
                    onChange={(e) => setMachinePricingUnit(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    {["Per Acre", "Per Hour", "Per Day"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Condition</label>
                  <select
                    value={machineCondition}
                    onChange={(e) => setMachineCondition(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={machineStatus}
                    onChange={(e) => setMachineStatus(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    <option value="Available">Available</option>
                    <option value="Booked">Booked</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Location</label>
                <input
                  type="text"
                  required
                  value={machineLocation}
                  onChange={(e) => setMachineLocation(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Update Photo (Optional)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  {machineItem.machine_photos && (
                    <img
                      src={mediaUrl(machineItem.machine_photos) || ""}
                      alt="Current"
                      className="size-12 rounded-xl object-cover border border-slate-200"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewMachinePhoto(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              </div>
            </>
          )}

          {/* STORAGE FORM */}
          {data.type === "storage" && storageItem && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Facility Type</label>
                <input
                  type="text"
                  required
                  value={storageType}
                  onChange={(e) => setStorageType(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Capacity (MT)</label>
                  <input
                    type="number"
                    required
                    value={totalCapacity}
                    onChange={(e) => setTotalCapacity(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={storagePrice}
                    onChange={(e) => setStoragePrice(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Space Availability</label>
                  <select
                    value={availabilityIndicator}
                    onChange={(e) => setAvailabilityIndicator(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    <option value="Plenty of Space">Plenty of Space</option>
                    <option value="Limited Space">Limited Space</option>
                    <option value="Full">Full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Temperature</label>
                  <input
                    type="text"
                    value={temperatureRange}
                    onChange={(e) => setTemperatureRange(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Location</label>
                <input
                  type="text"
                  required
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Update Photo (Optional)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  {storageItem.storage_photo && (
                    <img
                      src={mediaUrl(storageItem.storage_photo) || ""}
                      alt="Current"
                      className="size-12 rounded-xl object-cover border border-slate-200"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewStoragePhoto(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
              </div>
            </>
          )}

          {/* BUYER REQUIREMENT FORM */}
          {data.type === "buyer" && buyerItem && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Crop Required</label>
                <input
                  type="text"
                  required
                  value={reqCropType}
                  onChange={(e) => setReqCropType(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Quantity</label>
                  <input
                    type="number"
                    required
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Unit</label>
                  <select
                    value={reqUnit}
                    onChange={(e) => setReqUnit(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    {["tons", "quintals", "kg", "bags"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Min Budget (₹)</label>
                  <input
                    type="number"
                    value={reqBudgetMin}
                    onChange={(e) => setReqBudgetMin(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Max Budget (₹)</label>
                  <input
                    type="number"
                    value={reqBudgetMax}
                    onChange={(e) => setReqBudgetMax(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Delivery Location</label>
                  <input
                    type="text"
                    required
                    value={reqLocation}
                    onChange={(e) => setReqLocation(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={reqStatus}
                    onChange={(e) => setReqStatus(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                  >
                    <option value="Open">Open</option>
                    <option value="Fulfilled">Fulfilled</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Deadline</label>
                <input
                  type="date"
                  required
                  value={reqDeadline}
                  onChange={(e) => setReqDeadline(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-[#1d5a2b] text-white font-bold text-xs hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
