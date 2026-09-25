import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, Bike, ChevronRight, CircleUserRound, Container, Leaf, MapPin,
  Menu, PackagePlus, Search, Sprout, Star, Tractor, Warehouse, X,
} from "lucide-react";
import { marketplaceApi, mediaUrl } from "./api";
import type { CropListing, MachineListing, StorageListing } from "./types";

type Section = "crops" | "machinery" | "storage";

const sectionMeta: Record<Section, { label: string; icon: typeof Sprout; hint: string }> = {
  crops: { label: "Crops", icon: Sprout, hint: "Fresh harvests near you" },
  machinery: { label: "Machinery", icon: Tractor, hint: "Rent farm equipment" },
  storage: { label: "Storage", icon: Warehouse, hint: "Find space for your produce" },
};

const sampleCrops: CropListing[] = [
  { id: 0, user_id: 0, crop_name: "Fresh seasonal produce", category: "Vegetables", quantity: 120, quantity_remaining: 120, unit: "kg", price_per_kg: 42, location: "Local farms", post_cultivation_photo: "", status: "Available" },
  { id: -1, user_id: 0, crop_name: "Quality grains", category: "Grains", quantity: 250, quantity_remaining: 250, unit: "kg", price_per_kg: 35, location: "Nearby growers", post_cultivation_photo: "", status: "Available" },
];

function App() {
  const [section, setSection] = useState<Section>("crops");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [accountOpen, setAccountOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const crops = useQuery({ queryKey: ["crops"], queryFn: marketplaceApi.crops });
  const machines = useQuery({ queryKey: ["machines"], queryFn: marketplaceApi.machines });
  const storage = useQuery({ queryKey: ["storage"], queryFn: marketplaceApi.storage });
  const loading = crops.isLoading || machines.isLoading || storage.isLoading;

  const cropResults = useMemo(() => {
    const candidates = crops.data?.length ? crops.data : sampleCrops;
    return candidates.filter((item) => {
      const term = search.toLowerCase();
      const matchesSearch = !term || [item.crop_name, item.category, item.location].join(" ").toLowerCase().includes(term);
      return matchesSearch && (category === "All" || item.category.toLowerCase() === category.toLowerCase());
    });
  }, [crops.data, search, category]);

  const openAuth = () => setAuthOpen(true);
  const meta = sectionMeta[section];

  return (
    <main className="min-h-dvh bg-[#f7f8f3] pb-28 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-[#f7f8f3]/95 px-5 py-4 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button className="grid size-11 place-items-center rounded-2xl bg-[#eaf4e5] text-[#1d5a2b]" aria-label="AgriLink home" onClick={() => setSection("crops")}><Bike size={24} /></button>
          <div className="text-center"><p className="font-display text-2xl font-extrabold tracking-tight text-[#174d24]">AgriLink</p><p className="hidden text-xs text-slate-500 sm:block">Your local farm marketplace</p></div>
          <div className="flex gap-1"><button className="icon-button" aria-label="Notifications"><Bell size={21} /></button><button className="icon-button md:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><button className="icon-button hidden md:grid" aria-label="Search" onClick={() => document.getElementById("listing-search")?.focus()}><Search size={22} /></button></div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-7 md:px-10">
        <div className="rounded-[2rem] bg-[#1d5a2b] px-6 py-7 text-white shadow-[0_16px_45px_-20px_rgba(28,82,40,.7)] md:flex md:items-center md:justify-between md:px-10">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Leaf size={14} /> Direct from local producers</span><h1 className="mt-4 max-w-xl text-3xl font-bold leading-tight md:text-4xl">Grow, trade and find what your farm needs.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-green-50">Browse freely. Create a listing, buy produce, or book equipment only after you sign in.</p></div>
          <button onClick={openAuth} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ff962e] px-5 py-3 text-sm font-bold text-[#1e3a22] transition hover:bg-[#ffab59] md:mt-0"><PackagePlus size={19} /> Start selling</button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-sm md:max-w-xl">
          {(Object.keys(sectionMeta) as Section[]).map((key) => {
            const ItemIcon = sectionMeta[key].icon;
            return <button key={key} onClick={() => setSection(key)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold transition sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${section === key ? "bg-[#e6f2e2] text-[#1d5a2b]" : "text-slate-500 hover:bg-slate-50"}`}><ItemIcon size={19} />{sectionMeta[key].label}</button>;
          })}
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#d8dfce] bg-white px-4 py-3 shadow-sm"><Search className="shrink-0 text-slate-500" size={22} /><input id="listing-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${meta.label.toLowerCase()}, farms, or locations...`} className="w-full bg-transparent text-base outline-none placeholder:text-slate-400" /></div>

        {section === "crops" && <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{["All", "Vegetables", "Fruits", "Grains"].map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${category === item ? "border-[#29622e] bg-[#29622e] text-white" : "border-[#d4dacb] bg-white text-slate-600"}`}>{item}</button>)}</div>}

        <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><p className="text-sm font-medium text-[#d8731c]">Marketplace</p><h2 className="text-2xl font-bold">{meta.hint}</h2></div><button className="inline-flex items-center gap-1 text-sm font-semibold text-[#1d5a2b]">See all <ChevronRight size={17} /></button></div>
          {loading ? <LoadingCards /> : section === "crops" ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{cropResults.map((listing) => <CropCard key={listing.id} listing={listing} onProtectedAction={openAuth} />)}</div> : section === "machinery" ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{(machines.data ?? []).map((listing) => <ServiceCard key={listing.listing_id} title={listing.machine_type} location={listing.location} price={`₹${listing.price_per_unit} / ${listing.pricing_unit}`} image={listing.machine_photos} label="Book machinery" onProtectedAction={openAuth} icon={<Tractor />} />)}{!machines.data?.length && <EmptyCard icon={<Tractor />} label="No machinery listed yet" />}</div> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{(storage.data ?? []).map((listing) => <ServiceCard key={listing.listing_id} title={listing.storage_type} location={listing.location} price={`₹${listing.price} / ${listing.pricing_unit}`} image={listing.storage_photo} label="Book storage" onProtectedAction={openAuth} icon={<Warehouse />} />)}{!storage.data?.length && <EmptyCard icon={<Warehouse />} label="No storage listed yet" />}</div>}
        </section>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-2 backdrop-blur"><div className="mx-auto flex max-w-md items-center justify-between"><NavButton active icon={<Sprout />} label="Browse" onClick={() => setSection("crops")} /><NavButton icon={<PackagePlus />} label="Post" accent onClick={openAuth} /><NavButton icon={<CircleUserRound />} label="Account" onClick={() => setAccountOpen(true)} /></div></nav>

      {(accountOpen || authOpen || menuOpen) && <div className="fixed inset-0 z-40 bg-slate-950/30" onClick={() => { setAccountOpen(false); setAuthOpen(false); setMenuOpen(false); }} />}
      {authOpen && <AuthSheet onClose={() => setAuthOpen(false)} />}
      {accountOpen && <AccountSheet onClose={() => setAccountOpen(false)} onSignIn={openAuth} />}
      {menuOpen && <aside className="fixed right-0 top-0 z-50 h-dvh w-72 bg-white p-6 shadow-2xl"><button className="ml-auto grid size-10 place-items-center rounded-full bg-slate-100" onClick={() => setMenuOpen(false)}><X size={20} /></button><p className="mt-10 text-sm font-semibold text-[#d8731c]">EXPLORE</p>{(["crops", "machinery", "storage"] as Section[]).map((key) => { const ItemIcon = sectionMeta[key].icon; return <button key={key} className="flex w-full items-center gap-3 border-b py-4 text-left font-semibold" onClick={() => { setSection(key); setMenuOpen(false); }}><ItemIcon size={20} />{sectionMeta[key].label}</button>; })}</aside>}
    </main>
  );
}

function CropCard({ listing, onProtectedAction }: { listing: CropListing; onProtectedAction: () => void }) {
  const image = mediaUrl(listing.post_cultivation_photo);
  return <article className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_35px_-22px_rgba(28,41,31,.45)]"><div className="relative h-48 bg-[linear-gradient(145deg,#d5e5b8,#84aa56)]">{image ? <img src={image} alt={listing.crop_name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-6xl">🌱</div>}<span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-sm font-bold text-[#8f591e] shadow"><Star size={16} fill="currentColor" /> 4.8</span></div><div className="p-5"><div className="flex gap-3"><div className="min-w-0 flex-1"><h3 className="text-xl font-bold leading-tight">{listing.crop_name}</h3><p className="mt-1 text-sm text-slate-500">{listing.category} · {listing.quantity_remaining} {listing.unit} available</p></div><p className="whitespace-nowrap text-xl font-extrabold text-[#e78223]">₹{listing.price_per_kg}<span className="block text-right text-xs font-medium text-slate-500">/ kg</span></p></div><p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={17} />{listing.location}</p><button onClick={onProtectedAction} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#174d24] py-3.5 text-sm font-bold text-white transition hover:bg-[#0f3e1c]"><Container size={19} /> Buy / contact grower</button></div></article>;
}

function ServiceCard({ title, location, price, image, label, onProtectedAction, icon }: { title: string; location: string; price: string; image?: string | null; label: string; onProtectedAction: () => void; icon: ReactNode }) {
  const src = mediaUrl(image);
  return <article className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_35px_-22px_rgba(28,41,31,.45)]"><div className="grid h-40 place-items-center bg-[#e8f1e0] text-[#326d32]">{src ? <img src={src} alt={title} className="h-full w-full object-cover" /> : <span className="scale-[2]">{icon}</span>}</div><div className="p-5"><h3 className="text-xl font-bold">{title}</h3><p className="mt-1 text-sm text-slate-500"><MapPin className="mr-1 inline" size={15} />{location}</p><p className="mt-4 text-lg font-extrabold text-[#e78223]">{price}</p><button onClick={onProtectedAction} className="mt-4 w-full rounded-xl border border-[#1d5a2b] py-3 text-sm font-bold text-[#1d5a2b]">{label}</button></div></article>;
}

function EmptyCard({ icon, label }: { icon: ReactNode; label: string }) { return <div className="col-span-full grid min-h-60 place-items-center rounded-3xl border-2 border-dashed border-[#ccd9c4] bg-white text-center text-slate-500"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#edf5e9] text-[#266330]">{icon}</span><p className="mt-3 font-semibold">{label}</p><p className="mt-1 text-sm">Be the first to add one.</p></div></div>; }
function LoadingCards() { return <div className="grid gap-5 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl bg-slate-200" />)}</div>; }
function NavButton({ icon, label, active, accent, onClick }: { icon: ReactNode; label: string; active?: boolean; accent?: boolean; onClick: () => void }) { return <button onClick={onClick} className={`flex min-w-16 flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-semibold ${accent ? "-mt-8 bg-[#ff962e] py-3 text-[#19391f] shadow-lg" : active ? "text-[#1d5a2b]" : "text-slate-500"}`}>{icon}<span>{label}</span></button>; }
function AuthSheet({ onClose }: { onClose: () => void }) { return <section className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[2rem] bg-white p-6 shadow-2xl"><button className="float-right text-slate-400" onClick={onClose}><X /></button><span className="grid size-12 place-items-center rounded-2xl bg-[#e9f3e5] text-[#1d5a2b]"><Leaf /></span><h2 className="mt-4 text-2xl font-bold">Sign in to continue</h2><p className="mt-2 text-sm leading-6 text-slate-600">Browsing is open to everyone. Verify your account to buy, post listings, book equipment, or contact a grower.</p><button className="mt-6 w-full rounded-xl bg-[#174d24] py-3.5 font-bold text-white">Continue with email</button><p className="mt-3 text-center text-xs text-slate-500">New here? Create your AgriLink account in a minute.</p></section>; }
function AccountSheet({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) { return <section className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[2rem] bg-white p-6 shadow-2xl"><button className="float-right text-slate-400" onClick={onClose}><X /></button><span className="grid size-12 place-items-center rounded-full bg-[#e9f3e5] text-[#1d5a2b]"><CircleUserRound /></span><h2 className="mt-4 text-2xl font-bold">Your account</h2><p className="mt-2 text-sm text-slate-600">Sign in to see your profile, listings, orders and bookings.</p><button onClick={() => { onClose(); onSignIn(); }} className="mt-6 w-full rounded-xl bg-[#174d24] py-3.5 font-bold text-white">Sign in or create account</button></section>; }

export default App;
