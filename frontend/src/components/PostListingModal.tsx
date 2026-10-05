import { useState, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  PackagePlus,
  Sprout,
  Tractor,
  Upload,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

export function PostListingModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { user, ensureRole } = useAuth();
  const [activeTab, setActiveTab] = useState<"crop" | "machine" | "storage" | "buyer">("crop");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common or specific fields
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop fields
  const [cropName, setCropName] = useState("");
  const [category, setCategory] = useState("Vegetables");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [pricePerKg, setPricePerKg] = useState("");
  const [qualityGrade, setQualityGrade] = useState("Grade A");
  const [cropLocation, setCropLocation] = useState(user?.location || "");
  const [postPhoto, setPostPhoto] = useState<File | null>(null);

  // Machine fields
  const [machineType, setMachineType] = useState("Tractor 50 HP");
  const [machinePricingUnit, setMachinePricingUnit] = useState("hour");
  const [machinePrice, setMachinePrice] = useState("");
  const [operatorIncluded, setOperatorIncluded] = useState(true);
  const [machineCondition, setMachineCondition] = useState("Excellent");
  const [machineLocation, setMachineLocation] = useState(user?.location || "");
  const [machinePhoto, setMachinePhoto] = useState<File | null>(null);

  // Storage fields
  const [storageType, setStorageType] = useState("Cold Storage");
  const [storageCapacity, setStorageCapacity] = useState("");
  const [storagePricingUnit, setStoragePricingUnit] = useState("month");
  const [storagePrice, setStoragePrice] = useState("");
  const [temperatureRange, setTemperatureRange] = useState("2°C - 8°C");
  const [storageLocation, setStorageLocation] = useState(user?.location || "");
  const [storagePhoto, setStoragePhoto] = useState<File | null>(null);

  // Buyer requirement fields
  const [buyerCropType, setBuyerCropType] = useState("");
  const [buyerQty, setBuyerQty] = useState("");
  const [buyerUnit, setBuyerUnit] = useState("kg");
  const [budgetMax, setBudgetMax] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState(user?.location || "");

  // Submit Crop Listing
  const handleCropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!postPhoto) {
      setError("Please upload a harvest photo of the crop.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureRole("farmer");
      const fd = new FormData();
      fd.append("user_id", user.id.toString());
      fd.append("crop_name", cropName);
      fd.append("category", category);
      fd.append("quantity", quantity);
      fd.append("unit", unit);
      fd.append("price_per_kg", pricePerKg);
      fd.append("quality_grade", qualityGrade);
      fd.append("location", cropLocation);
      fd.append("post_cultivation_photo", postPhoto);

      await api.crops.create(fd);
      onSuccess(`Crop listing for "${cropName}" published successfully!`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create crop listing.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Machine Listing
  const handleMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!machinePhoto) {
      setError("Please upload a photo of your equipment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureRole("machine_owner");
      const fd = new FormData();
      fd.append("owner_id", user.id.toString());
      fd.append("machine_type", machineType);
      fd.append("pricing_unit", machinePricingUnit);
      fd.append("price_per_unit", machinePrice);
      fd.append("operator_included", operatorIncluded ? "true" : "false");
      fd.append("machine_condition", machineCondition);
      fd.append("location", machineLocation);
      fd.append("machine_photo", machinePhoto);

      await api.machines.create(fd);
      onSuccess(`Machinery "${machineType}" listed for rent!`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create machinery listing.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Storage Listing
  const handleStorageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!storagePhoto) {
      setError("Please upload a photo of your facility.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureRole("storage_owner");
      const fd = new FormData();
      fd.append("owner_id", user.id.toString());
      fd.append("storage_type", storageType);
      fd.append("total_capacity", storageCapacity);
      fd.append("pricing_unit", storagePricingUnit);
      fd.append("price", storagePrice);
      fd.append("temperature_range", temperatureRange);
      fd.append("location", storageLocation);
      fd.append("storage_photo", storagePhoto);

      await api.storage.create(fd);
      onSuccess(`Storage space "${storageType}" published!`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create storage listing.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Buyer Requirement
  const handleBuyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!deadline) {
      setError("Please specify the required delivery deadline.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await ensureRole("buyer");
      await api.buyers.create(user.id, {
        crop_type: buyerCropType,
        quantity_needed: parseFloat(buyerQty),
        unit: buyerUnit,
        budget_max: budgetMax ? parseInt(budgetMax, 10) : undefined,
        deadline,
        delivery_location: deliveryLocation,
      });
      onSuccess(`Buyer requirement for "${buyerCropType}" posted!`);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to post requirement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 overflow-y-auto max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="size-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#ff962e]/15 text-[#d8731c]">
            <PackagePlus className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Post a Listing</h2>
            <p className="text-xs text-slate-500">Sell harvests, rent machinery, offer storage or post buyer needs</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="mt-5 grid grid-cols-4 p-1 bg-slate-100 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab("crop"); setError(null); }}
            className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === "crop" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sprout className="size-3.5" />
            <span>Crop</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("machine"); setError(null); }}
            className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === "machine" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Tractor className="size-3.5" />
            <span>Machinery</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("storage"); setError(null); }}
            className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === "storage" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Warehouse className="size-3.5" />
            <span>Storage</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("buyer"); setError(null); }}
            className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === "buyer" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="size-3.5" />
            <span>Buyer Need</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. CROP LISTING FORM */}
        {activeTab === "crop" && (
          <form onSubmit={handleCropSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Crop Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Sona Masoori Rice, Fresh Tomatoes"
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
                  <option value="Grains">Grains & Cereals</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Fruits">Fruits</option>
                  <option value="Perishable">Perishable Produce</option>
                  <option value="Pulses">Pulses & Legumes</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Quality Grade</label>
                <select
                  value={qualityGrade}
                  onChange={(e) => setQualityGrade(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                >
                  <option value="Grade A">Grade A (Premium)</option>
                  <option value="Grade B">Grade B (Standard)</option>
                  <option value="Organic">Organic Certified</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Quantity</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                >
                  <option value="kg">kg</option>
                  <option value="quintal">quintal</option>
                  <option value="ton">ton</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Price / {unit}</label>
                <input
                  type="number"
                  required
                  placeholder="₹ 50"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Farm Location</label>
              <input
                type="text"
                required
                placeholder="Village / District (e.g. Warangal, Telangana)"
                value={cropLocation}
                onChange={(e) => setCropLocation(e.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">Harvest Photo (Mandatory)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 border-2 border-dashed border-slate-200 hover:border-[#1d5a2b] hover:bg-[#f7faf5] rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
              >
                <Upload className="size-5 text-slate-400" />
                <p className="text-xs font-medium text-slate-700">
                  {postPhoto ? postPhoto.name : "Click to select crop photo (JPEG, PNG, WEBP)"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setPostPhoto(e.target.files[0]);
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Publish Crop Listing"}
            </button>
          </form>
        )}

        {/* 2. MACHINERY FORM */}
        {activeTab === "machine" && (
          <form onSubmit={handleMachineSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Machine Type / Model</label>
              <input
                type="text"
                required
                placeholder="e.g. Mahindra Tractor 575 DI, Paddy Harvester"
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Pricing Unit</label>
                <select
                  value={machinePricingUnit}
                  onChange={(e) => setMachinePricingUnit(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                >
                  <option value="hour">Per Hour</option>
                  <option value="day">Per Day</option>
                  <option value="acre">Per Acre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Price (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="500"
                  value={machinePrice}
                  onChange={(e) => setMachinePrice(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
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
                  <option value="Brand New">Brand New</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good Working">Good Working</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="operator"
                  checked={operatorIncluded}
                  onChange={(e) => setOperatorIncluded(e.target.checked)}
                  className="size-4 text-[#1d5a2b] rounded focus:ring-0"
                />
                <label htmlFor="operator" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Operator Included
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Available Location</label>
              <input
                type="text"
                required
                placeholder="District / Service Area"
                value={machineLocation}
                onChange={(e) => setMachineLocation(e.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">Equipment Photo</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 border-2 border-dashed border-slate-200 hover:border-[#1d5a2b] hover:bg-[#f7faf5] rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
              >
                <Upload className="size-5 text-slate-400" />
                <p className="text-xs font-medium text-slate-700">
                  {machinePhoto ? machinePhoto.name : "Select machine photo"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setMachinePhoto(e.target.files[0]);
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "List Machinery for Rent"}
            </button>
          </form>
        )}

        {/* 3. STORAGE FORM */}
        {activeTab === "storage" && (
          <form onSubmit={handleStorageSubmit} className="mt-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Storage Type</label>
                <select
                  value={storageType}
                  onChange={(e) => setStorageType(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                >
                  <option value="Cold Storage">Cold Storage</option>
                  <option value="Dry Storage">Dry Warehouse</option>
                  <option value="Both Cold & Dry">Both Cold & Dry</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Total Capacity (MT)</label>
                <input
                  type="number"
                  required
                  placeholder="500"
                  value={storageCapacity}
                  onChange={(e) => setStorageCapacity(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Pricing Unit</label>
                <select
                  value={storagePricingUnit}
                  onChange={(e) => setStoragePricingUnit(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                >
                  <option value="day">Per Day</option>
                  <option value="week">Per Week</option>
                  <option value="month">Per Month</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Price (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="1500"
                  value={storagePrice}
                  onChange={(e) => setStoragePrice(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Temperature Range</label>
                <input
                  type="text"
                  placeholder="e.g. 2°C to 10°C"
                  value={temperatureRange}
                  onChange={(e) => setTemperatureRange(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Facility Location</label>
                <input
                  type="text"
                  required
                  placeholder="City / Highway / Hub"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">Facility Photo</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 border-2 border-dashed border-slate-200 hover:border-[#1d5a2b] hover:bg-[#f7faf5] rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
              >
                <Upload className="size-5 text-slate-400" />
                <p className="text-xs font-medium text-slate-700">
                  {storagePhoto ? storagePhoto.name : "Select warehouse photo"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setStoragePhoto(e.target.files[0]);
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Publish Storage Facility"}
            </button>
          </form>
        )}

        {/* 4. BUYER REQUIREMENT FORM */}
        {activeTab === "buyer" && (
          <form onSubmit={handleBuyerSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Crop Needed</label>
              <input
                type="text"
                required
                placeholder="e.g. Red Chilli (Teja), Basmati Paddy"
                value={buyerCropType}
                onChange={(e) => setBuyerCropType(e.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Quantity Needed</label>
                <input
                  type="number"
                  required
                  placeholder="100"
                  value={buyerQty}
                  onChange={(e) => setBuyerQty(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Unit</label>
                <select
                  value={buyerUnit}
                  onChange={(e) => setBuyerUnit(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm bg-white"
                >
                  <option value="kg">kg</option>
                  <option value="quintal">quintal</option>
                  <option value="ton">ton</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Max Budget (₹/unit)</label>
                <input
                  type="number"
                  placeholder="Optional"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Required By (Deadline)</label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Delivery Location</label>
                <input
                  type="text"
                  required
                  placeholder="Market / Warehouse Hub"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1d5a2b] text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-3.5 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Post Requirement"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
