import { useState, useEffect } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Quote,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Star,
  Tag,
  Tractor,
  Trash2,
  User as UserIcon,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, mediaUrl } from "../api";
import { EditListingModal, type EditableListing } from "./EditListingModal";
import type { Order, Booking, CropListing, MachineListing, StorageListing, BuyerRequirement, Review } from "../types";

export function DashboardModal({
  onClose,
  onOpenReview,
  onNotification,
  onOpenPost,
  initialTab,
  onExploreMarket,
}: {
  onClose: () => void;
  onOpenReview: (
    targetUserId: number,
    contextType: string,
    contextId: number,
    productTitle?: string,
    targetUserName?: string
  ) => void;
  onNotification: (msg: string) => void;
  onOpenPost?: () => void;
  initialTab?: "listings" | "purchases" | "sales" | "bookings" | "reviews" | "profile";
  onExploreMarket?: () => void;
}) {
  const { user, roles, logout, ensureRole, toggleRole, refreshUser } = useAuth();
  const [tab, setTab] = useState<"listings" | "purchases" | "sales" | "bookings" | "reviews" | "profile">(
    initialTab || "listings"
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // User reviews & customer feedback
  const [receivedReviews, setReceivedReviews] = useState<Review[]>([]);
  const [givenReviews, setGivenReviews] = useState<Review[]>([]);
  const [reviewSubTab, setReviewSubTab] = useState<"received" | "given">("received");

  // User's own posted listings
  const [myCrops, setMyCrops] = useState<CropListing[]>([]);
  const [myMachines, setMyMachines] = useState<MachineListing[]>([]);
  const [myStorage, setMyStorage] = useState<StorageListing[]>([]);
  const [myRequirements, setMyRequirements] = useState<BuyerRequirement[]>([]);

  // Edit modal target
  const [editingItem, setEditingItem] = useState<EditableListing | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [roleToggling, setRoleToggling] = useState<string | null>(null);

  const fetchOrdersAndBookings = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      // 1. My purchases
      const myPurchases = await api.orders.browse({ buyer_id: user.id });
      setOrders(myPurchases);

      // 2. My sales (as farmer)
      const mySales = await api.orders.browse({ farmer_id: user.id });
      setSales(mySales);

      // 3. Bookings as requester or provider
      const myBookings = await api.bookings.browse({ requester_id: user.id });
      const incomingBookings = await api.bookings.browse({ provider_id: user.id });
      const combined = [...myBookings, ...incomingBookings.filter(b => b.requester_id !== user.id)];
      setBookings(combined);

      // 4. My posted listings
      const allCrops = await api.crops.browse();
      setMyCrops(allCrops.filter(c => c.user_id === user.id));

      const allMachines = await api.machines.browse();
      setMyMachines(allMachines.filter(m => m.owner_id === user.id));

      const allStorage = await api.storage.browse();
      setMyStorage(allStorage.filter(s => s.owner_id === user.id));

      const allBuyers = await api.buyers.browse();
      setMyRequirements(allBuyers.filter(b => b.user_id === user.id));

      // 5. Reviews and customer feedback
      const revsReceived = await api.reviews.browse({ reviewed_user_id: user.id });
      setReceivedReviews(revsReceived);

      const revsGiven = await api.reviews.browse({ reviewer_id: user.id });
      setGivenReviews(revsGiven);
    } catch (err) {
      console.error("Failed to load user records:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteListing = async (
    type: "crop" | "machine" | "storage" | "buyer",
    id: number,
    name: string
  ) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to remove '${name}'? This action cannot be undone.`)) {
      return;
    }
    setActionLoading(id);
    try {
      if (type === "crop") await api.crops.delete(id, user.id);
      else if (type === "machine") await api.machines.delete(id, user.id);
      else if (type === "storage") await api.storage.delete(id, user.id);
      else if (type === "buyer") await api.buyers.delete(id, user.id);
      onNotification(`'${name}' was successfully deleted.`);
      await fetchOrdersAndBookings();
    } catch (err: any) {
      alert(err.message || "Failed to delete listing.");
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchOrdersAndBookings();
  }, [user]);

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    if (!user) return;
    setActionLoading(orderId);
    try {
      await api.orders.updateStatus(orderId, user.id, status);
      onNotification(`Order #${orderId} marked as ${status}!`);
      await fetchOrdersAndBookings();
    } catch (err: any) {
      alert(err.message || "Failed to update order status.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: number, status: string) => {
    if (!user) return;
    setActionLoading(bookingId);
    try {
      await api.bookings.updateStatus(bookingId, user.id, status);
      onNotification(`Booking #${bookingId} marked as ${status}!`);
      await fetchOrdersAndBookings();
    } catch (err: any) {
      alert(err.message || "Failed to update booking status.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddRole = async (roleName: string) => {
    try {
      await ensureRole(roleName);
      onNotification(`Role "${roleName}" activated on your profile!`);
    } catch (err: any) {
      alert(err.message || "Failed to add role.");
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 overflow-y-auto max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="size-5" />
        </button>

        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-[#f4f8f2] border border-[#d6e7d1]">
          <div className="flex items-center gap-3.5">
            <div className="grid size-14 place-items-center rounded-2xl bg-[#1d5a2b] text-white font-bold text-xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  <Star className="size-3 fill-current text-amber-600" />
                  {user.trust_score ? `${user.trust_score} Trust` : "5.0 New"}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>User #{user.id}</span> · 
                <span className="flex items-center gap-1"><MapPin className="size-3" />{user.location}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { refreshUser(); fetchOrdersAndBookings(); }}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Refresh records"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={() => { logout(); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition"
            >
              <LogOut className="size-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* Roles Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Active Roles:</span>
          {roles.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eaf4e5] text-[#1d5a2b]"
            >
              <ShieldCheck className="size-3.5" />
              {r.role_type.replace("_", " ").toUpperCase()}
            </span>
          ))}
          {/* Quick role adder */}
          {!roles.some(r => r.role_type === "farmer") && (
            <button
              onClick={() => handleAddRole("farmer")}
              className="text-[11px] font-bold text-[#1d5a2b] bg-white border border-[#1d5a2b] hover:bg-[#eaf4e5] px-2.5 py-1 rounded-full transition"
            >
              + Enable Farmer Role
            </button>
          )}
          {!roles.some(r => r.role_type === "buyer") && (
            <button
              onClick={() => handleAddRole("buyer")}
              className="text-[11px] font-bold text-[#1d5a2b] bg-white border border-[#1d5a2b] hover:bg-[#eaf4e5] px-2.5 py-1 rounded-full transition"
            >
              + Enable Buyer Role
            </button>
          )}
        </div>

        {/* Dashboard Tabs */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 p-1 bg-slate-100 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setTab("listings")}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition ${
              tab === "listings" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Listings ({myCrops.length + myMachines.length + myStorage.length + myRequirements.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("purchases")}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition ${
              tab === "purchases" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("sales")}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition ${
              tab === "sales" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Crop Sales ({sales.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("bookings")}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition ${
              tab === "bookings" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Bookings ({bookings.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("reviews")}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
              tab === "reviews" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Star className="size-3.5 fill-amber-500 text-amber-500 shrink-0" />
            <span>Feedback ({receivedReviews.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("profile")}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition ${
              tab === "profile" ? "bg-white text-[#1d5a2b] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Profile & Roles
          </button>
        </div>

        {/* Content body */}
        <div className="mt-5">
          {loadingData ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="size-6 animate-spin text-[#1d5a2b]" />
              <p className="text-xs">Loading records from database...</p>
            </div>
          ) : (
            <>
              {/* TAB 0: MY POSTED LISTINGS */}
              {tab === "listings" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Your Active Marketplace Listings</h3>
                      <p className="text-[11px] text-slate-500">
                        Edit details, adjust prices, or remove items you have posted.
                      </p>
                    </div>
                    {onOpenPost && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenPost();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition shadow-sm"
                      >
                        <Plus className="size-3.5" />
                        <span>Post New</span>
                      </button>
                    )}
                  </div>

                  {/* Banner to easily jump into buying mode from other farmers */}
                  <div className="bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-[#1d5a2b] text-white grid place-items-center shrink-0 shadow-xs">
                        <ShoppingBag className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Looking to buy crops or hire machinery from other farmers?</p>
                        <p className="text-[11px] text-slate-600">
                          As a farmer or buyer, you can browse listings from fellow users and order directly.
                        </p>
                      </div>
                    </div>
                    {onExploreMarket && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onExploreMarket();
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1d5a2b] hover:bg-[#154620] text-white text-xs font-bold transition shrink-0 shadow-xs"
                      >
                        <ShoppingBag className="size-3.5" />
                        <span>Explore Marketplace →</span>
                      </button>
                    )}
                  </div>

                  {myCrops.length === 0 &&
                  myMachines.length === 0 &&
                  myStorage.length === 0 &&
                  myRequirements.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Package className="mx-auto size-8 text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">No active listings posted yet</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Your posted harvests, machinery rentals, and warehouse listings will appear here so you can easily edit or track them.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                        {onOpenPost && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenPost();
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition shadow-sm"
                          >
                            <Plus className="size-3.5" />
                            <span>Post New Listing</span>
                          </button>
                        )}
                        {onExploreMarket && (
                          <button
                            onClick={() => {
                              onClose();
                              onExploreMarket();
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-xs"
                          >
                            <ShoppingBag className="size-3.5 text-[#1d5a2b]" />
                            <span>Explore Other Farmers' Listings</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* 1. User Crops */}
                  {myCrops.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Sprout className="size-3.5 text-emerald-600" />
                        <span>Crop Harvests ({myCrops.length})</span>
                      </h4>
                      <div className="grid gap-2.5">
                        {myCrops.map((c) => (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              {c.post_cultivation_photo ? (
                                <img
                                  src={mediaUrl(c.post_cultivation_photo) || ""}
                                  alt={c.crop_name}
                                  className="size-14 rounded-xl object-cover border border-slate-100 shrink-0"
                                />
                              ) : (
                                <div className="size-14 rounded-xl bg-emerald-50 text-2xl grid place-items-center shrink-0">
                                  🌾
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">{c.crop_name}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      c.status === "Available"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {c.status}
                                  </span>
                                  <span className="text-[11px] text-slate-400">#{c.id}</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  <strong>₹{c.price_per_kg}</strong> / {c.unit} · {c.quantity_remaining} {c.unit} left (of {c.quantity})
                                </p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="size-3" />
                                  <span>{c.location}</span> · <span>Category: {c.category}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => setEditingItem({ type: "crop", item: c })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-[#1d5a2b] hover:bg-[#eaf4e5] text-slate-700 hover:text-[#1d5a2b] text-xs font-bold transition"
                              >
                                <Pencil className="size-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteListing("crop", c.id, c.crop_name)}
                                disabled={actionLoading === c.id}
                                className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                                title="Delete listing"
                              >
                                {actionLoading === c.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. User Machinery */}
                  {myMachines.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Tractor className="size-3.5 text-blue-600" />
                        <span>Machinery & Equipment ({myMachines.length})</span>
                      </h4>
                      <div className="grid gap-2.5">
                        {myMachines.map((m) => (
                          <div
                            key={m.listing_id}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              {m.machine_photos ? (
                                <img
                                  src={mediaUrl(m.machine_photos) || ""}
                                  alt={m.machine_type}
                                  className="size-14 rounded-xl object-cover border border-slate-100 shrink-0"
                                />
                              ) : (
                                <div className="size-14 rounded-xl bg-blue-50 text-2xl grid place-items-center shrink-0">
                                  🚜
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">{m.machine_type}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      m.status === "Available"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {m.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  <strong>₹{m.price_per_unit}</strong> / {m.pricing_unit} · Condition: {m.machine_condition || "Good"}
                                </p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="size-3" />
                                  <span>{m.location}</span> · <span>{m.operator_included ? "Driver included" : "Self drive"}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => setEditingItem({ type: "machine", item: m })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition"
                              >
                                <Pencil className="size-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteListing("machine", m.listing_id, m.machine_type)}
                                disabled={actionLoading === m.listing_id}
                                className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                                title="Delete listing"
                              >
                                {actionLoading === m.listing_id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. User Storage */}
                  {myStorage.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Warehouse className="size-3.5 text-purple-600" />
                        <span>Storage & Warehouses ({myStorage.length})</span>
                      </h4>
                      <div className="grid gap-2.5">
                        {myStorage.map((s) => (
                          <div
                            key={s.listing_id}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3">
                              {s.storage_photo ? (
                                <img
                                  src={mediaUrl(s.storage_photo) || ""}
                                  alt={s.storage_type}
                                  className="size-14 rounded-xl object-cover border border-slate-100 shrink-0"
                                />
                              ) : (
                                <div className="size-14 rounded-xl bg-purple-50 text-2xl grid place-items-center shrink-0">
                                  🏢
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">{s.storage_type}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                    {s.availability_indicator}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  <strong>₹{s.price}</strong> / {s.pricing_unit} · Total Capacity: {s.total_capacity} MT
                                </p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="size-3" />
                                  <span>{s.location}</span> · <span>Temp: {s.temperature_range || "Ambient"}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => setEditingItem({ type: "storage", item: s })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-purple-600 hover:bg-purple-50 text-slate-700 hover:text-purple-700 text-xs font-bold transition"
                              >
                                <Pencil className="size-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteListing("storage", s.listing_id, s.storage_type)}
                                disabled={actionLoading === s.listing_id}
                                className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                                title="Delete listing"
                              >
                                {actionLoading === s.listing_id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. User Buyer Requirements */}
                  {myRequirements.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <FileText className="size-3.5 text-amber-600" />
                        <span>Procurement Demands ({myRequirements.length})</span>
                      </h4>
                      <div className="grid gap-2.5">
                        {myRequirements.map((b) => (
                          <div
                            key={b.id}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">
                                  Demand: {b.quantity_needed} {b.unit} of {b.crop_type}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    b.status === "Open"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Budget: ₹{b.budget_min ?? 0} - ₹{b.budget_max ?? 0} · Delivery: {b.delivery_location}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Deadline: {new Date(b.deadline).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => setEditingItem({ type: "buyer", item: b })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-600 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-xs font-bold transition"
                              >
                                <Pencil className="size-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteListing("buyer", b.id, b.crop_type)}
                                disabled={actionLoading === b.id}
                                className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                                title="Delete listing"
                              >
                                {actionLoading === b.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 1: PURCHASES */}
              {tab === "purchases" && (
                <div className="space-y-3">
                  {orders.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <ShoppingBag className="mx-auto size-8 text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">No orders placed yet</p>
                      <p className="text-xs text-slate-400">Browse harvest listings to buy fresh produce.</p>
                    </div>
                  ) : (
                    orders.map((o) => (
                      <div
                        key={o.order_id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">Order #{o.order_id}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                o.status === "Confirmed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : o.status === "Pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : o.status === "Completed"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {o.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Listing #{o.listing_id} · Quantity: <strong>{o.quantity_ordered} kg</strong> · Total: <strong>₹{o.total_price}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {o.status === "Pending" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(o.order_id, "Cancelled")}
                              disabled={actionLoading === o.order_id}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition"
                            >
                              Cancel
                            </button>
                          )}
                          {o.status === "Confirmed" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(o.order_id, "Completed")}
                              disabled={actionLoading === o.order_id}
                              className="px-3 py-1.5 rounded-lg bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition"
                            >
                              Mark Received
                            </button>
                          )}
                          {o.status === "Completed" && (
                            (() => {
                              const alreadyReviewed = givenReviews.find(
                                (r) => r.context_type === "order" && r.context_id === o.order_id
                              );
                              if (alreadyReviewed) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                                    <Star className="size-3 fill-amber-500 text-amber-500" />
                                    <span>Rated {alreadyReviewed.rating}★</span>
                                  </span>
                                );
                              }
                              return (
                                <button
                                  onClick={() =>
                                    onOpenReview(
                                      o.farmer_id,
                                      "order",
                                      o.order_id,
                                      `Listing #${o.listing_id} Produce`
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition flex items-center gap-1 shadow-sm"
                                >
                                  <Star className="size-3 fill-current" />
                                  <span>Leave Feedback</span>
                                </button>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: SALES (INCOMING ORDERS FOR FARMER) */}
              {tab === "sales" && (
                <div className="space-y-3">
                  {sales.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Package className="mx-auto size-8 text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">No incoming crop orders yet</p>
                      <p className="text-xs text-slate-400">Post a harvest listing to receive purchase offers from buyers.</p>
                    </div>
                  ) : (
                    sales.map((o) => (
                      <div
                        key={o.order_id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">Sale Order #{o.order_id}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                o.status === "Confirmed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : o.status === "Pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : o.status === "Completed"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {o.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Buyer #{o.buyer_id} · Quantity: <strong>{o.quantity_ordered} kg</strong> · Revenue: <strong>₹{o.total_price}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {o.status === "Pending" && (
                            <>
                              <button
                                onClick={() => handleUpdateOrderStatus(o.order_id, "Confirmed")}
                                disabled={actionLoading === o.order_id}
                                className="px-3 py-1.5 rounded-lg bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition flex items-center gap-1"
                              >
                                <CheckCircle2 className="size-3.5" />
                                Confirm & Reserve Stock
                              </button>
                              <button
                                onClick={() => handleUpdateOrderStatus(o.order_id, "Cancelled")}
                                disabled={actionLoading === o.order_id}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {o.status === "Confirmed" && (
                            <button
                              onClick={() => handleUpdateOrderStatus(o.order_id, "Completed")}
                              disabled={actionLoading === o.order_id}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                            >
                              Complete Delivery
                            </button>
                          )}
                        </div>

                        {/* Customer feedback received on this sale */}
                        {(() => {
                          const fb = receivedReviews.find(
                            (r) => r.context_type === "order" && r.context_id === o.order_id
                          );
                          if (!fb) return null;
                          return (
                            <div className="mt-3 w-full p-3 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-50/70 to-orange-50 border border-amber-200/90 flex items-start justify-between gap-3 shadow-sm">
                              <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-xl bg-amber-100 text-amber-900 shrink-0 mt-0.5 shadow-sm">
                                  <Star className="size-4 fill-amber-500 text-amber-500" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900">
                                      Customer Feedback:
                                    </span>
                                    <span className="text-xs font-extrabold text-amber-800">
                                      {fb.rating} / 5 Stars
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      from <strong>{fb.reviewer_name || `Buyer #${o.buyer_id}`}</strong>
                                    </span>
                                  </div>
                                  {fb.comment && (
                                    <p className="text-xs text-slate-800 mt-1 italic font-medium bg-white/70 px-2.5 py-1 rounded-lg border border-amber-100">
                                      "{fb.comment}"
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => setTab("reviews")}
                                className="text-xs text-[#1d5a2b] font-bold hover:underline shrink-0 self-center"
                              >
                                View All Feedback →
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: BOOKINGS */}
              {tab === "bookings" && (
                <div className="space-y-3">
                  {bookings.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Calendar className="mx-auto size-8 text-slate-300" />
                      <p className="mt-2 text-sm font-semibold text-slate-700">No machinery or storage bookings</p>
                    </div>
                  ) : (
                    bookings.map((b) => (
                      <div
                        key={b.booking_id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {b.booking_type === "machine" ? "🚜 Machinery" : "🏢 Storage"} #{b.booking_id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                b.status === "Confirmed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : b.status === "Pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Total: <strong>₹{b.total_price}</strong> · From: {new Date(b.start_date).toLocaleDateString()} to {new Date(b.end_date).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Provider actions */}
                        {b.provider_id === user.id && b.status === "Pending" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleUpdateBookingStatus(b.booking_id, "Confirmed")}
                              disabled={actionLoading === b.booking_id}
                              className="px-3 py-1.5 rounded-lg bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition"
                            >
                              Accept Booking
                            </button>
                            <button
                              onClick={() => handleUpdateBookingStatus(b.booking_id, "Cancelled")}
                              disabled={actionLoading === b.booking_id}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {b.provider_id === user.id && b.status === "Confirmed" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleUpdateBookingStatus(b.booking_id, "Completed")}
                              disabled={actionLoading === b.booking_id}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                            >
                              Mark Completed
                            </button>
                          </div>
                        )}
                        {b.status === "Completed" && (
                          <div className="flex items-center gap-2 shrink-0">
                            {(() => {
                              const targetUserId = b.requester_id === user.id ? b.provider_id : b.requester_id;
                              const alreadyReviewed = givenReviews.find(
                                (r) => r.context_type === "booking" && r.context_id === b.booking_id
                              );
                              if (alreadyReviewed) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                                    <Star className="size-3 fill-amber-500 text-amber-500" />
                                    <span>Rated {alreadyReviewed.rating}★</span>
                                  </span>
                                );
                              }
                              return (
                                <button
                                  onClick={() =>
                                    onOpenReview(
                                      targetUserId,
                                      "booking",
                                      b.booking_id,
                                      b.booking_type === "machine" ? "Machinery Service" : "Storage Space"
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition flex items-center gap-1 shadow-sm"
                                >
                                  <Star className="size-3 fill-current" />
                                  <span>Leave Feedback</span>
                                </button>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: FEEDBACK & REVIEWS */}
              {tab === "reviews" && (
                <div className="space-y-4">
                  {/* Summary Banner */}
                  <div className="p-5 rounded-3xl bg-gradient-to-br from-[#1d5a2b] to-[#14421e] text-white shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 size-48 rounded-full bg-white/10 pointer-events-none blur-xl" />
                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-extrabold shadow-sm">
                            <Star className="size-3.5 fill-current" />
                            {user.trust_score ? `${user.trust_score.toFixed(1)} / 5.0 Trust Rating` : "5.0 / 5.0"}
                          </span>
                          <span className="text-xs text-green-200">
                            {receivedReviews.length} Verified Customer Reviews
                          </span>
                        </div>
                        <h3 className="text-xl font-bold mt-2 text-white">
                          Customer Feedback & Product Reviews
                        </h3>
                        <p className="text-xs text-green-100/80 mt-1 max-w-md">
                          Review feedback left by buyers and clients for your produce, equipment rentals, and storage facilities.
                        </p>
                      </div>

                      {/* Subtab Toggle Buttons */}
                      <div className="flex bg-white/15 p-1 rounded-xl backdrop-blur-sm shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => setReviewSubTab("received")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            reviewSubTab === "received"
                              ? "bg-white text-[#1d5a2b] shadow-sm"
                              : "text-white/80 hover:text-white"
                          }`}
                        >
                          Received ({receivedReviews.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewSubTab("given")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            reviewSubTab === "given"
                              ? "bg-white text-[#1d5a2b] shadow-sm"
                              : "text-white/80 hover:text-white"
                          }`}
                        >
                          Given ({givenReviews.length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Subtab 1: Received Reviews */}
                  {reviewSubTab === "received" && (
                    <div className="space-y-3">
                      {receivedReviews.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-6">
                          <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 grid place-items-center mx-auto mb-3">
                            <Star className="size-6 fill-current" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-800">No customer feedback yet</h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                            When buyers purchase your harvests or book your machinery/storage, their verified feedback and ratings will appear here with the product name and feedback details.
                          </p>
                        </div>
                      ) : (
                        receivedReviews.map((r) => (
                          <div
                            key={r.review_id}
                            className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#174d24] text-xs font-bold">
                                  <Sprout className="size-3.5" />
                                  <span>Product / Service:</span>
                                  <strong className="underline underline-offset-2">{r.product_title || "Harvest Delivery"}</strong>
                                </span>
                                {r.context_type && (
                                  <span className="text-[11px] text-slate-500 font-semibold">
                                    ({r.context_type.toUpperCase()} #{r.context_id})
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {new Date(r.created_at).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>

                            {/* Rating and Comment */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`size-4 ${
                                        star <= r.rating
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-slate-200 fill-slate-200"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs font-extrabold text-slate-800">
                                  {r.rating} / 5 Stars
                                </span>
                              </div>

                              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 text-slate-800 text-sm relative">
                                <Quote className="size-3.5 text-amber-500 absolute top-2.5 left-2.5 opacity-60" />
                                <p className="pl-4 font-medium leading-relaxed">
                                  "{r.comment || "Rated without written comment."}"
                                </p>
                              </div>
                            </div>

                            {/* Reviewer signature */}
                            <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <div className="size-6 rounded-full bg-slate-200 grid place-items-center font-bold text-[10px] text-slate-700">
                                  {(r.reviewer_name || "U").charAt(0).toUpperCase()}
                                </div>
                                <span>
                                  Feedback from: <strong className="text-slate-900">{r.reviewer_name || `User #${r.reviewer_id}`}</strong>
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                                <ShieldCheck className="size-3.5" />
                                Verified Transaction
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Subtab 2: Given Reviews */}
                  {reviewSubTab === "given" && (
                    <div className="space-y-3">
                      {givenReviews.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-6">
                          <Star className="size-8 text-slate-300 mx-auto mb-2" />
                          <h4 className="text-sm font-bold text-slate-800">You haven't left any feedback yet</h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                            When you complete crop orders or machine rentals, you can rate and review your experience with the farmer or service provider.
                          </p>
                        </div>
                      ) : (
                        givenReviews.map((r) => (
                          <div
                            key={r.review_id}
                            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">
                                You reviewed: {r.reviewed_user_name || `User #${r.reviewed_user_id}`}
                              </span>
                              <span className="text-slate-400">
                                {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`size-3.5 ${
                                    star <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                                  }`}
                                />
                              ))}
                              <span className="text-xs font-semibold text-slate-700 ml-1">
                                {r.rating} / 5
                              </span>
                              {r.product_title && (
                                <span className="ml-2 text-xs text-slate-500">
                                  for <strong>{r.product_title}</strong>
                                </span>
                              )}
                            </div>
                            {r.comment && (
                              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                "{r.comment}"
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PROFILE & ROLES */}
              {tab === "profile" && (
                <div className="space-y-4">
                  {/* Account Details */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-700">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">User ID / ID#:</span>
                      <span className="font-bold text-slate-900">#{user.id}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">Phone Number:</span>
                      <span className="font-bold">{user.phone_number}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">Email Address:</span>
                      <span className="font-bold">{user.email}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-500">Address:</span>
                      <span className="font-bold">{user.address}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="font-semibold text-slate-500">Marketplace Region:</span>
                      <span className="font-bold">{user.location}</span>
                    </div>
                  </div>

                  {/* Trade Roles Management */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Trade Roles & Permissions</h4>
                        <p className="text-[11px] text-slate-500">
                          Roles determine which services you can list or order. You can hold multiple roles at once.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {[
                        {
                          id: "farmer",
                          title: "🌾 Farmer / Grower",
                          desc: "List produce, sell harvests, manage inventory",
                        },
                        {
                          id: "buyer",
                          title: "🛒 Agricultural Buyer",
                          desc: "Order crops, post procurement requirements",
                        },
                        {
                          id: "machine_owner",
                          title: "🚜 Machinery Fleet Owner",
                          desc: "List tractors, harvesters, rent equipment",
                        },
                        {
                          id: "storage_owner",
                          title: "🏢 Storage / Warehouse Owner",
                          desc: "List cold storages, grain silos, warehouses",
                        },
                      ].map((item) => {
                        const active = roles.some((r) => r.role_type === item.id && !r.deactivated_at);
                        const isWorking = roleToggling === item.id;

                        const handleToggle = async () => {
                          setRoleToggling(item.id);
                          try {
                            await toggleRole(item.id, !active);
                            onNotification(
                              active
                                ? `Role '${item.title}' deactivated.`
                                : `Role '${item.title}' activated! You can now use these features.`
                            );
                          } catch (err: any) {
                            alert(err.message || "Failed to update role status.");
                          } finally {
                            setRoleToggling(null);
                          }
                        };

                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition ${
                              active
                                ? "bg-emerald-50/60 border-emerald-200"
                                : "bg-slate-50 border-slate-200 opacity-75"
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{item.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    active
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                            </div>

                            <button
                              type="button"
                              onClick={handleToggle}
                              disabled={isWorking}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                                active
                                  ? "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                  : "bg-[#1d5a2b] text-white hover:bg-[#154620]"
                              } disabled:opacity-50`}
                            >
                              {isWorking ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : active ? (
                                "Disable"
                              ) : (
                                "Activate"
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editingItem && (
        <EditListingModal
          data={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={(msg) => {
            onNotification(msg);
            fetchOrdersAndBookings();
          }}
        />
      )}
    </div>
  );
}
