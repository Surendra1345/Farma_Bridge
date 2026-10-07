import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bike,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Container,
  FileText,
  Filter,
  Leaf,
  MapPin,
  Menu,
  PackagePlus,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Tractor,
  UserCheck,
  Warehouse,
  Pencil,
  Phone,
  ShoppingBag,
  Globe,
  X,
} from "lucide-react";
import { api, mediaUrl } from "./api";
import { useAuth } from "./context/AuthContext";
import type { CropListing, MachineListing, StorageListing, BuyerRequirement } from "./types";

import { AuthModal } from "./components/AuthModal";
import { PostListingModal } from "./components/PostListingModal";
import { OrderModal } from "./components/OrderModal";
import { BookingModal } from "./components/BookingModal";
import { DashboardModal } from "./components/DashboardModal";
import { ReviewModal } from "./components/ReviewModal";
import { ContactModal } from "./components/ContactModal";
import { BuyerReqCard } from "./components/BuyerReqCard";
import { EditListingModal, type EditableListing } from "./components/EditListingModal";
import { ToastContainer, type ToastMessage } from "./components/Toast";

type Section = "crops" | "machinery" | "storage" | "requirements";

const sectionMeta: Record<Section, { label: string; icon: typeof Sprout; hint: string }> = {
  crops: { label: "Crops", icon: Sprout, hint: "Fresh harvests available directly from farmers" },
  machinery: { label: "Machinery", icon: Tractor, hint: "Rent tractors, harvesters, and implements" },
  storage: { label: "Storage", icon: Warehouse, hint: "Find cold storage & warehouses for your yield" },
  requirements: { label: "Buyer Needs", icon: FileText, hint: "Active procurement demands from verified buyers" },
};

function App() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("crops");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  // Modals state
  const [authOpen, setAuthOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Selected items for purchase / booking / review / edit
  const [selectedCrop, setSelectedCrop] = useState<CropListing | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<{ item: MachineListing | StorageListing; type: "machine" | "storage" } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    userId: number;
    contextType?: string;
    contextId?: number;
    productTitle?: string;
    targetUserName?: string;
  } | null>(null);
  const [contactTarget, setContactTarget] = useState<{ userId: number; title: string; subtitle?: string } | null>(null);
  const [editingListing, setEditingListing] = useState<EditableListing | null>(null);
  const [dashboardTab, setDashboardTab] = useState<"listings" | "purchases" | "sales" | "bookings" | "reviews" | "profile">("listings");

  // Marketplace feed scope: "market" (only other users), "mine" (only current user), "all" (everyone)
  const [feedScope, setFeedScope] = useState<"market" | "mine" | "all">("market");

  // Notifications (Toasts)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Queries
  const cropsQuery = useQuery({ queryKey: ["crops"], queryFn: () => api.crops.browse() });
  const machinesQuery = useQuery({ queryKey: ["machines"], queryFn: () => api.machines.browse() });
  const storageQuery = useQuery({ queryKey: ["storage"], queryFn: () => api.storage.browse() });
  const buyersQuery = useQuery({ queryKey: ["buyers"], queryFn: () => api.buyers.browse() });

  const loading =
    cropsQuery.isLoading ||
    machinesQuery.isLoading ||
    storageQuery.isLoading ||
    buyersQuery.isLoading;

  const refreshAll = () => {
    cropsQuery.refetch();
    machinesQuery.refetch();
    storageQuery.refetch();
    buyersQuery.refetch();
  };

  // Count items for active section across scopes
  const countsForSection = useMemo(() => {
    let allCount = 0;
    let mineCount = 0;
    let marketCount = 0;

    if (section === "crops") {
      const items = cropsQuery.data ?? [];
      allCount = items.length;
      if (user) {
        mineCount = items.filter((i) => i.user_id === user.id).length;
        marketCount = items.filter((i) => i.user_id !== user.id).length;
      }
    } else if (section === "machinery") {
      const items = machinesQuery.data ?? [];
      allCount = items.length;
      if (user) {
        mineCount = items.filter((i) => i.owner_id === user.id).length;
        marketCount = items.filter((i) => i.owner_id !== user.id).length;
      }
    } else if (section === "storage") {
      const items = storageQuery.data ?? [];
      allCount = items.length;
      if (user) {
        mineCount = items.filter((i) => i.owner_id === user.id).length;
        marketCount = items.filter((i) => i.owner_id !== user.id).length;
      }
    } else if (section === "requirements") {
      const items = buyersQuery.data ?? [];
      allCount = items.length;
      if (user) {
        mineCount = items.filter((i) => i.user_id === user.id).length;
        marketCount = items.filter((i) => i.user_id !== user.id).length;
      }
    }
    return { allCount, mineCount, marketCount };
  }, [section, cropsQuery.data, machinesQuery.data, storageQuery.data, buyersQuery.data, user]);

  // Filter crops
  const filteredCrops = useMemo(() => {
    const items = cropsQuery.data ?? [];
    return items.filter((item) => {
      if (user) {
        if (feedScope === "market" && item.user_id === user.id) return false;
        if (feedScope === "mine" && item.user_id !== user.id) return false;
      }
      const term = search.toLowerCase();
      const matchesSearch =
        !term || [item.crop_name, item.category, item.location].join(" ").toLowerCase().includes(term);
      const matchesCat = category === "All" || item.category.toLowerCase() === category.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [cropsQuery.data, search, category, feedScope, user]);

  // Filter machinery
  const filteredMachines = useMemo(() => {
    const items = machinesQuery.data ?? [];
    return items.filter((item) => {
      if (user) {
        if (feedScope === "market" && item.owner_id === user.id) return false;
        if (feedScope === "mine" && item.owner_id !== user.id) return false;
      }
      const term = search.toLowerCase();
      return !term || [item.machine_type, item.location, item.machine_condition].join(" ").toLowerCase().includes(term);
    });
  }, [machinesQuery.data, search, feedScope, user]);

  // Filter storage
  const filteredStorage = useMemo(() => {
    const items = storageQuery.data ?? [];
    return items.filter((item) => {
      if (user) {
        if (feedScope === "market" && item.owner_id === user.id) return false;
        if (feedScope === "mine" && item.owner_id !== user.id) return false;
      }
      const term = search.toLowerCase();
      return !term || [item.storage_type, item.location, item.availability_indicator].join(" ").toLowerCase().includes(term);
    });
  }, [storageQuery.data, search, feedScope, user]);

  // Filter buyer requirements
  const filteredRequirements = useMemo(() => {
    const items = buyersQuery.data ?? [];
    return items.filter((item) => {
      if (user) {
        if (feedScope === "market" && item.user_id === user.id) return false;
        if (feedScope === "mine" && item.user_id !== user.id) return false;
      }
      const term = search.toLowerCase();
      return !term || [item.crop_type, item.delivery_location].join(" ").toLowerCase().includes(term);
    });
  }, [buyersQuery.data, search, feedScope, user]);

  // Handlers
  const handleOpenPost = () => {
    if (!user) {
      setAuthOpen(true);
      showToast("Please sign in or select a demo account to post listings.", "info");
      return;
    }
    setPostOpen(true);
  };

  const handleBuyCrop = (crop: CropListing) => {
    if (!user) {
      setAuthOpen(true);
      showToast("Please sign in to place an order.", "info");
      return;
    }
    setSelectedCrop(crop);
  };

  const handleBookItem = (item: MachineListing | StorageListing, type: "machine" | "storage") => {
    if (!user) {
      setAuthOpen(true);
      showToast(`Please sign in to reserve ${type}.`, "info");
      return;
    }
    setSelectedBooking({ item, type });
  };

  const meta = sectionMeta[section];

  return (
    <main className="min-h-dvh bg-[#f7f8f3] pb-28 text-slate-900">
      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7f8f3]/95 px-5 py-3.5 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              className="grid size-11 place-items-center rounded-2xl bg-[#eaf4e5] text-[#1d5a2b] shadow-sm hover:scale-105 transition"
              aria-label="FarmaBridge Home"
              onClick={() => setSection("crops")}
            >
              <Bike size={24} />
            </button>
            <div>
              <p className="font-display text-2xl font-extrabold tracking-tight text-[#174d24]">FarmaBridge</p>
              <p className="hidden text-xs text-slate-500 sm:block">Agricultural Commerce & Logistics Network</p>
            </div>
          </div>

          {/* User & Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={() => setDashboardOpen(true)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white border border-[#cbe1c4] shadow-sm hover:border-[#1d5a2b] transition"
              >
                <div className="grid size-8 place-items-center rounded-xl bg-[#1d5a2b] text-white text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{user.name}</p>
                  <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                    <Star className="size-2.5 fill-current" />
                    {user.trust_score ? `${user.trust_score} Trust` : "Verified"}
                  </p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1d5a2b] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#154620] transition"
              >
                <CircleUserRound size={17} />
                <span>Sign In / Demo</span>
              </button>
            )}

            <button
              className="icon-button hidden md:grid"
              aria-label="Search"
              onClick={() => document.getElementById("listing-search")?.focus()}
            >
              <Search size={20} />
            </button>
            <button
              className="icon-button md:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <section className="mx-auto max-w-6xl px-5 pt-6 md:px-10">
        {/* Hero Banner */}
        <div className="rounded-[2.5rem] bg-[#1d5a2b] p-6 sm:p-8 md:p-10 text-white shadow-[0_20px_50px_-20px_rgba(28,82,40,.65)] md:flex md:items-center md:justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 size-72 rounded-full bg-white/5 pointer-events-none blur-xl" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Leaf size={14} /> Direct Agricultural Marketplace
            </span>
            <h1 className="mt-4 max-w-xl text-3xl font-bold leading-tight md:text-4xl">
              Buy harvests, rent machinery & store crops seamlessly.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-green-100/90">
              Browse verified local listings freely. Place orders with automatic stock reservations, or list your produce and equipment in one click.
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex flex-col sm:flex-row gap-3 relative z-10 shrink-0">
            <button
              onClick={handleOpenPost}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff962e] px-6 py-3.5 text-sm font-bold text-[#1e3a22] shadow-lg transition hover:bg-[#ffab59] hover:scale-102"
            >
              <PackagePlus size={19} />
              <span>Post Listing</span>
            </button>
            {user && (
              <button
                onClick={() => setDashboardOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/20 backdrop-blur-sm px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/30"
              >
                <span>My Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Section Tabs (Crops, Machinery, Storage, Buyer Needs) */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl bg-white p-2 shadow-sm border border-slate-200/60">
          {(Object.keys(sectionMeta) as Section[]).map((key) => {
            const ItemIcon = sectionMeta[key].icon;
            const count =
              key === "crops"
                ? cropsQuery.data?.length
                : key === "machinery"
                ? machinesQuery.data?.length
                : key === "storage"
                ? storageQuery.data?.length
                : buyersQuery.data?.length;

            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs sm:text-sm font-semibold transition ${
                  section === key
                    ? "bg-[#e6f2e2] text-[#1d5a2b] shadow-sm font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ItemIcon size={18} />
                <span>{sectionMeta[key].label}</span>
                {typeof count === "number" && (
                  <span
                    className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full ${
                      section === key ? "bg-[#1d5a2b] text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#d8dfce] bg-white px-4 py-3 shadow-sm focus-within:border-[#1d5a2b] transition">
          <Search className="shrink-0 text-slate-400" size={20} />
          <input
            id="listing-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${meta.label.toLowerCase()} by name, category, or location...`}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Pills for Crops */}
        {section === "crops" && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["All", "Grains", "Vegetables", "Fruits", "Perishable", "Pulses"].map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                  category === item
                    ? "border-[#1d5a2b] bg-[#1d5a2b] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {/* Section Content & Cards */}
        <section className="mt-8">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-wider uppercase text-[#d8731c]">Marketplace Directory</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">{meta.hint}</h2>
            </div>
            <button onClick={refreshAll} className="inline-flex items-center gap-1 text-xs font-bold text-[#1d5a2b] hover:underline self-start sm:self-end">
              <span>Refresh data</span>
            </button>
          </div>

          {/* Feed Scope Selector: Explore Market (Others) vs My Listings vs All */}
          {user && (
            <div className="mb-6 p-2 rounded-2xl bg-white/90 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setFeedScope("market")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    feedScope === "market"
                      ? "bg-[#1d5a2b] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ShoppingBag className="size-3.5" />
                  <span>Explore Market</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      feedScope === "market" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {countsForSection.marketCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeedScope("mine")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    feedScope === "mine"
                      ? "bg-[#1d5a2b] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sprout className="size-3.5" />
                  <span>My Listings</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      feedScope === "mine" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {countsForSection.mineCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeedScope("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    feedScope === "all"
                      ? "bg-[#1d5a2b] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Globe className="size-3.5" />
                  <span>All</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      feedScope === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {countsForSection.allCount}
                  </span>
                </button>
              </div>

              {/* Feed Scope Helper Tip */}
              <div className="text-xs text-slate-600 flex items-center gap-2 px-2">
                {feedScope === "market" && (
                  <span className="flex items-center gap-1">
                    <span>🛒 Browsing listings from <strong>other farmers & sellers</strong> ready to buy or book.</span>
                  </span>
                )}
                {feedScope === "mine" && (
                  <span className="flex items-center gap-1.5">
                    <span>🌾 Showing only <strong>your active listings</strong>.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDashboardTab("listings");
                        setDashboardOpen(true);
                      }}
                      className="text-[#1d5a2b] font-bold underline hover:text-[#154620]"
                    >
                      Manage in Account →
                    </button>
                  </span>
                )}
                {feedScope === "all" && (
                  <span>🌐 Showing all community and personal listings together.</span>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <LoadingCards />
          ) : (
            <>
              {/* 1. CROPS */}
              {section === "crops" && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredCrops.map((listing) => (
                    <CropCard
                      key={listing.id}
                      listing={listing}
                      isOwner={user?.id === listing.user_id}
                      onBuy={() => handleBuyCrop(listing)}
                      onManage={() => {
                        setDashboardTab("listings");
                        setDashboardOpen(true);
                      }}
                      onViewFeedback={() => {
                        setDashboardTab("reviews");
                        setDashboardOpen(true);
                      }}
                      onEdit={() => setEditingListing({ type: "crop", item: listing })}
                      onContact={() =>
                        setContactTarget({
                          userId: listing.user_id,
                          title: `${listing.crop_name} (${listing.quantity_remaining} ${listing.unit})`,
                          subtitle: `Rate: ₹${listing.price_per_kg}/${listing.unit} • ${listing.location}`,
                        })
                      }
                    />
                  ))}
                  {filteredCrops.length === 0 && (
                    <EmptyCard
                      icon={<Sprout />}
                      label={
                        feedScope === "mine"
                          ? "You haven't posted any crop harvests yet"
                          : feedScope === "market"
                          ? "No crop listings from other farmers match your filter"
                          : "No crop harvests found"
                      }
                      subtitle={
                        feedScope === "mine"
                          ? "Post your crop harvest to find buyers across wholesale and retail markets."
                          : "Check other categories or toggle feed to view all listings."
                      }
                      ctaLabel={feedScope === "mine" ? "Post Your Crop Harvest" : "Post Your Harvest"}
                      onCta={handleOpenPost}
                    />
                  )}
                </div>
              )}

              {/* 2. MACHINERY */}
              {section === "machinery" && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredMachines.map((m) => (
                    <ServiceCard
                      key={m.listing_id}
                      title={m.machine_type}
                      subtitle={`Condition: ${m.machine_condition || "Good"}`}
                      tag={m.operator_included ? "Operator Included" : "Self Drive"}
                      location={m.location}
                      price={`₹${m.price_per_unit} / ${m.pricing_unit}`}
                      image={m.machine_photos}
                      label="Book Machinery"
                      icon={<Tractor className="size-8" />}
                      isOwner={user?.id === m.owner_id}
                      onAction={() => handleBookItem(m, "machine")}
                      onManage={() => {
                        setDashboardTab("listings");
                        setDashboardOpen(true);
                      }}
                      onViewFeedback={() => {
                        setDashboardTab("reviews");
                        setDashboardOpen(true);
                      }}
                      onEdit={() => setEditingListing({ type: "machine", item: m })}
                      onContact={() =>
                        setContactTarget({
                          userId: m.owner_id,
                          title: m.machine_type,
                          subtitle: `Rate: ₹${m.price_per_unit}/${m.pricing_unit} • ${m.location}`,
                        })
                      }
                    />
                  ))}
                  {filteredMachines.length === 0 && (
                    <EmptyCard
                      icon={<Tractor />}
                      label={
                        feedScope === "mine"
                          ? "You haven't listed any farm machinery yet"
                          : feedScope === "market"
                          ? "No machinery listings from other providers match your filter"
                          : "No farm machinery listed yet"
                      }
                      subtitle={
                        feedScope === "mine"
                          ? "Rent out your tractor, harvester, or drone to earn extra income."
                          : "Check back later or post your own equipment for rent."
                      }
                      ctaLabel={feedScope === "mine" ? "List Your Machinery" : "List Equipment for Rent"}
                      onCta={handleOpenPost}
                    />
                  )}
                </div>
              )}

              {/* 3. STORAGE */}
              {section === "storage" && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredStorage.map((s) => (
                    <ServiceCard
                      key={s.listing_id}
                      title={s.storage_type}
                      subtitle={`Capacity: ${s.total_capacity} MT`}
                      tag={s.availability_indicator}
                      location={s.location}
                      price={`₹${s.price} / ${s.pricing_unit}`}
                      image={s.storage_photo}
                      label="Reserve Storage"
                      icon={<Warehouse className="size-8" />}
                      isOwner={user?.id === s.owner_id}
                      onAction={() => handleBookItem(s, "storage")}
                      onManage={() => {
                        setDashboardTab("listings");
                        setDashboardOpen(true);
                      }}
                      onViewFeedback={() => {
                        setDashboardTab("reviews");
                        setDashboardOpen(true);
                      }}
                      onEdit={() => setEditingListing({ type: "storage", item: s })}
                      onContact={() =>
                        setContactTarget({
                          userId: s.owner_id,
                          title: s.storage_type,
                          subtitle: `Rate: ₹${s.price}/${s.pricing_unit} • ${s.location}`,
                        })
                      }
                    />
                  ))}
                  {filteredStorage.length === 0 && (
                    <EmptyCard
                      icon={<Warehouse />}
                      label={
                        feedScope === "mine"
                          ? "You haven't listed any storage space yet"
                          : feedScope === "market"
                          ? "No storage or warehouses from other providers match your filter"
                          : "No storage facilities listed yet"
                      }
                      subtitle={
                        feedScope === "mine"
                          ? "List cold storage, silos, or dry godowns for nearby farmers to book."
                          : "Explore nearby facilities or post your own available space."
                      }
                      ctaLabel={feedScope === "mine" ? "List Storage Space" : "List Available Storage"}
                      onCta={handleOpenPost}
                    />
                  )}
                </div>
              )}

              {/* 4. BUYER REQUIREMENTS */}
              {section === "requirements" && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRequirements.map((r) => (
                    <BuyerReqCard
                      key={r.id}
                      req={r}
                      isOwner={user?.id === r.user_id}
                      onEdit={() => setEditingListing({ type: "buyer", item: r })}
                      onRespond={() => {
                        setContactTarget({
                          userId: r.user_id,
                          title: `Procurement Demand: ${r.quantity_needed} ${r.unit} of ${r.crop_type}`,
                          subtitle: `Location: ${r.delivery_location} • Budget: ₹${r.budget_min ?? 0} - ₹${r.budget_max ?? 0}`,
                        });
                      }}
                    />
                  ))}
                  {filteredRequirements.length === 0 && (
                    <EmptyCard
                      icon={<FileText />}
                      label={
                        feedScope === "mine"
                          ? "You haven't posted any procurement requests yet"
                          : feedScope === "market"
                          ? "No procurement demands from other buyers match your filter"
                          : "No active procurement requests"
                      }
                      subtitle={
                        feedScope === "mine"
                          ? "Post the crops, quality, and quantities you want to buy from farmers."
                          : "Check other categories or post your own procurement demand."
                      }
                      ctaLabel="Post a Buyer Requirement"
                      onCta={handleOpenPost}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </section>

      {/* Fixed Bottom Navigation (Mobile friendly) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 px-6 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <NavButton
            active={section === "crops"}
            icon={<Sprout />}
            label="Crops"
            onClick={() => setSection("crops")}
          />
          <NavButton
            active={section === "machinery"}
            icon={<Tractor />}
            label="Machinery"
            onClick={() => setSection("machinery")}
          />
          <NavButton
            accent
            icon={<PackagePlus />}
            label="Post"
            onClick={handleOpenPost}
          />
          <NavButton
            active={section === "storage"}
            icon={<Warehouse />}
            label="Storage"
            onClick={() => setSection("storage")}
          />
          <NavButton
            active={dashboardOpen}
            icon={<CircleUserRound />}
            label={user ? "Account" : "Sign In"}
            onClick={() => {
              if (user) setDashboardOpen(true);
              else setAuthOpen(true);
            }}
          />
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 h-dvh w-80 bg-white p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-display font-extrabold text-xl text-[#1d5a2b]">AgriLink</span>
                <button
                  className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800"
                  onClick={() => setMenuOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-8 space-y-1">
                {(Object.keys(sectionMeta) as Section[]).map((key) => {
                  const ItemIcon = sectionMeta[key].icon;
                  return (
                    <button
                      key={key}
                      className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left text-sm font-bold transition ${
                        section === key ? "bg-[#eaf4e5] text-[#1d5a2b]" : "text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => {
                        setSection(key);
                        setMenuOpen(false);
                      }}
                    >
                      <ItemIcon size={20} />
                      <span>{sectionMeta[key].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              {user ? (
                <button
                  onClick={() => { setMenuOpen(false); setDashboardOpen(true); }}
                  className="w-full py-3 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm"
                >
                  View My Account
                </button>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); setAuthOpen(true); }}
                  className="w-full py-3 rounded-xl bg-[#1d5a2b] text-white font-bold text-sm"
                >
                  Sign In / Demo
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Modals */}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={() => {
            showToast("Welcome to AgriLink! You are now logged in.", "success");
            refreshAll();
          }}
        />
      )}

      {postOpen && (
        <PostListingModal
          onClose={() => setPostOpen(false)}
          onSuccess={(msg) => {
            showToast(msg, "success");
            refreshAll();
          }}
        />
      )}

      {selectedCrop && (
        <OrderModal
          listing={selectedCrop}
          onClose={() => setSelectedCrop(null)}
          onSuccess={(msg) => {
            showToast(msg, "success");
            refreshAll();
          }}
        />
      )}

      {selectedBooking && (
        <BookingModal
          item={selectedBooking.item}
          type={selectedBooking.type}
          onClose={() => setSelectedBooking(null)}
          onSuccess={(msg) => {
            showToast(msg, "success");
            refreshAll();
          }}
        />
      )}

      {dashboardOpen && (
        <DashboardModal
          initialTab={dashboardTab}
          onClose={() => setDashboardOpen(false)}
          onOpenPost={() => setPostOpen(true)}
          onExploreMarket={() => setFeedScope("market")}
          onOpenReview={(userId, contextType, contextId, productTitle, targetUserName) => {
            setDashboardOpen(false);
            setReviewTarget({ userId, contextType, contextId, productTitle, targetUserName });
          }}
          onNotification={(msg) => {
            showToast(msg, "info");
            refreshAll();
          }}
        />
      )}

      {editingListing && (
        <EditListingModal
          data={editingListing}
          onClose={() => setEditingListing(null)}
          onSuccess={(msg) => {
            showToast(msg, "success");
            refreshAll();
          }}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          targetUserId={reviewTarget.userId}
          targetUserName={reviewTarget.targetUserName}
          contextType={reviewTarget.contextType}
          contextId={reviewTarget.contextId}
          productTitle={reviewTarget.productTitle}
          onClose={() => setReviewTarget(null)}
          onSuccess={(msg) => {
            showToast(msg, "success");
            refreshAll();
          }}
        />
      )}

      {contactTarget && (
        <ContactModal
          userId={contactTarget.userId}
          title={contactTarget.title}
          subtitle={contactTarget.subtitle}
          onClose={() => setContactTarget(null)}
        />
      )}
    </main>
  );
}

// Subcomponents
function CropCard({
  listing,
  isOwner,
  onBuy,
  onManage,
  onEdit,
  onContact,
  onViewFeedback,
}: {
  listing: CropListing;
  isOwner?: boolean;
  onBuy: () => void;
  onManage?: () => void;
  onEdit?: () => void;
  onContact?: () => void;
  onViewFeedback?: () => void;
}) {
  const image = mediaUrl(listing.post_cultivation_photo);
  const isAvailable = listing.quantity_remaining > 0 && listing.status !== "Sold";

  return (
    <article className="overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-[0_12px_35px_-22px_rgba(28,41,31,.25)] flex flex-col justify-between transition hover:shadow-md">
      <div>
        <div className="relative h-48 bg-gradient-to-br from-[#dcecc4] to-[#a3c577] overflow-hidden">
          {image ? (
            <img src={image} alt={listing.crop_name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-5xl">🌾</div>
          )}
          <button
            type="button"
            onClick={onViewFeedback || onManage}
            title="View customer reviews and feedback"
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-xl bg-white/95 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm backdrop-blur-sm hover:scale-105 transition"
          >
            <Star size={14} className="fill-amber-500 text-amber-500" />
            <span>4.9 ★</span>
          </button>
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-xl bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {listing.category}
          </span>
          {isOwner && (
            <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-xl bg-emerald-700/90 text-white px-2.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm">
              Your Listing
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">{listing.crop_name}</h3>
              <p className="mt-1 text-xs text-slate-500">
                Quality: <strong className="text-slate-700">{listing.quality_grade || "Grade A"}</strong>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl font-extrabold text-[#d8731c]">₹{listing.price_per_kg}</span>
              <span className="block text-right text-[11px] text-slate-400">/ {listing.unit}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-slate-400" />
              <span>{listing.location}</span>
            </span>
            <span className={`font-bold ${isAvailable ? "text-emerald-700" : "text-red-600"}`}>
              {isAvailable ? `${listing.quantity_remaining} ${listing.unit} left` : "Sold Out"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0 space-y-2">
        {isOwner ? (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Pencil className="size-3.5" />
                <span>Edit Harvest</span>
              </button>
            )}
            <button
              onClick={onManage}
              className={`${onEdit ? "flex-1" : "w-full"} py-3 rounded-xl bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition flex items-center justify-center gap-1.5`}
            >
              <span>Dashboard</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onBuy}
              disabled={!isAvailable}
              className="flex-1 py-3 rounded-xl bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Container size={15} />
              <span>{isAvailable ? "Buy / Order" : "Sold Out"}</span>
            </button>
            {onContact && (
              <button
                onClick={onContact}
                className="px-3.5 py-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                title="Contact Farmer"
              >
                <Phone size={15} className="text-[#1d5a2b]" />
                <span className="hidden sm:inline">Contact</span>
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ServiceCard({
  title,
  subtitle,
  tag,
  location,
  price,
  image,
  label,
  icon,
  isOwner,
  onAction,
  onManage,
  onEdit,
  onContact,
  onViewFeedback,
}: {
  title: string;
  subtitle: string;
  tag: string;
  location: string;
  price: string;
  image?: string | null;
  label: string;
  icon: ReactNode;
  isOwner?: boolean;
  onAction: () => void;
  onManage?: () => void;
  onEdit?: () => void;
  onContact?: () => void;
  onViewFeedback?: () => void;
}) {
  const src = mediaUrl(image);

  return (
    <article className="overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-[0_12px_35px_-22px_rgba(28,41,31,.25)] flex flex-col justify-between transition hover:shadow-md">
      <div>
        <div className="relative h-44 bg-[#e8f1e0] overflow-hidden grid place-items-center">
          {src ? (
            <img src={src} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[#326d32]">{icon}</span>
          )}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-xl bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm backdrop-blur-sm">
            {tag}
          </span>
          {isOwner && (
            <button
              type="button"
              onClick={onViewFeedback || onManage}
              title="View customer reviews and feedback"
              className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-xl bg-white/95 px-2 py-0.5 text-[11px] font-bold text-amber-800 shadow-sm backdrop-blur-sm hover:scale-105 transition"
            >
              <Star size={13} className="fill-amber-500 text-amber-500" />
              <span>Feedback</span>
            </button>
          )}
          {isOwner && (
            <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-xl bg-[#1d5a2b] text-white px-2.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm">
              Your Facility
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">{title}</h3>
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            </div>
            <p className="text-lg font-extrabold text-[#d8731c] shrink-0">{price}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-600">
            <MapPin size={14} className="text-slate-400" />
            <span>{location}</span>
          </div>
        </div>
      </div>

      <div className="p-5 pt-0">
        {isOwner ? (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Pencil className="size-3.5" />
                <span>Edit Listing</span>
              </button>
            )}
            <button
              onClick={onManage}
              className={`${onEdit ? "flex-1" : "w-full"} py-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center gap-1.5`}
            >
              <span>Dashboard</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onAction}
              className="flex-1 py-3 rounded-xl border-2 border-[#1d5a2b] text-[#1d5a2b] text-xs font-bold hover:bg-[#1d5a2b] hover:text-white transition flex items-center justify-center gap-1.5"
            >
              <span>{label}</span>
            </button>
            {onContact && (
              <button
                onClick={onContact}
                className="px-3.5 py-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                title="Contact Provider"
              >
                <Phone size={15} className="text-[#1d5a2b]" />
                <span className="hidden sm:inline">Call</span>
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyCard({
  icon,
  label,
  subtitle,
  ctaLabel,
  onCta,
}: {
  icon: ReactNode;
  label: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="col-span-full grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-[#ccd9c4] bg-white p-8 text-center text-slate-500">
      <div>
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#edf5e9] text-[#266330]">
          {icon}
        </span>
        <p className="mt-4 text-base font-bold text-slate-800">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{subtitle || "Be the first to list and connect with nearby farmers and buyers."}</p>
        {ctaLabel && onCta && (
          <button
            onClick={onCta}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#1d5a2b] text-white text-xs font-bold hover:bg-[#154620] transition inline-flex items-center gap-1.5"
          >
            <span>{ctaLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-80 animate-pulse rounded-3xl bg-slate-200" />
      ))}
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  accent,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-14 flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
        accent
          ? "-mt-8 bg-[#ff962e] py-3 px-4 text-[#19391f] shadow-lg hover:scale-105"
          : active
          ? "text-[#1d5a2b]"
          : "text-slate-400 hover:text-slate-700"
      }`}
    >
      <span className="size-5 flex items-center justify-center">{icon}</span>
      <span className="text-[11px]">{label}</span>
    </button>
  );
}

export default App;
