import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { marketplaceApi } from "./api";
import type { CropListing } from "./types";
import { SECTIONS, type Section } from "./sections";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Filters } from "./components/Filters";
import { ListingCard } from "./components/ListingCard";
import { BottomNav } from "./components/BottomNav";
import { AuthSheet } from "./components/AuthSheet";
import { AccountSheet, type AccountTab } from "./components/AccountSheet";
import { MenuSheet } from "./components/Sheets";
import { BookSheet, BuySheet, PostSheet, type Bookable, type PostKind } from "./components/ActionSheets";
import { useAuth } from "./auth";
import { EmptyState, ErrorState, LoadingCards } from "./components/States";

type Overlay = "auth" | "account" | "menu" | null;
// What the user is trying to do. Needs a signed-in user, so it waits behind the sign-in sheet.
type Action = { type: "buy"; crop: CropListing } | { type: "book"; target: Bookable } | { type: "post"; kind: PostKind };

/** "Per Hour" -> "per hour", "hour" -> "per hour" (avoids "per Per Hour"). */
const perUnit = (unit: string) => (/^per\s/i.test(unit) ? unit.toLowerCase() : `per ${unit.toLowerCase()}`);

const matches = (term: string, ...fields: (string | undefined)[]) =>
  !term || fields.join(" ").toLowerCase().includes(term.toLowerCase());

export default function App() {
  const [section, setSection] = useState<Section>("crops");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const queries = {
    crops: useQuery({ queryKey: ["crops"], queryFn: marketplaceApi.crops }),
    machinery: useQuery({ queryKey: ["machines"], queryFn: marketplaceApi.machines }),
    storage: useQuery({ queryKey: ["storage"], queryFn: marketplaceApi.storage }),
  };
  const active = queries[section];
  const meta = SECTIONS.find((s) => s.key === section)!;
  const Icon = meta.icon;
  const { user } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [accountTab, setAccountTab] = useState<AccountTab>("profile");
  const openAccount = (tab: AccountTab = "profile") => { setAccountTab(tab); setOverlay(user ? "account" : "auth"); };
  // Signed out -> ask to sign in first; the action resumes automatically afterwards.
  const [pending, setPending] = useState<Action | null>(null);
  const start = (next: Action) => { if (user) setAction(next); else { setPending(next); setOverlay("auth"); } };
  const dismissAuth = () => { setOverlay(null); setPending(null); };   // user gave up: forget the pending action
  const postKind: PostKind = section === "machinery" ? "machine" : section === "storage" ? "storage" : "crop";
  useEffect(() => { if (user && pending) { setAction(pending); setPending(null); } }, [user, pending]);
  const requireAuth = () => start({ type: "post", kind: postKind });

  const changeSection = (next: Section) => { setSection(next); setSearch(""); setCategory("All"); };
  const clearFilters = () => { setSearch(""); setCategory("All"); };

  // Not memoized on purpose: the card handlers close over `user`, which changes on sign-in/out.
  const cards = (() => {
    if (section === "crops") {
      return (queries.crops.data ?? [])
        .filter((c) => matches(search, c.crop_name, c.category, c.location) && (category === "All" || c.category.toLowerCase() === category.toLowerCase()))
        .map((c) => (
          <ListingCard key={c.id} title={c.crop_name} subtitle={`${c.category} · ${c.quantity_remaining} ${c.unit} left`} location={c.location}
            price={`₹${c.price_per_kg}`} priceUnit="per kg" image={c.post_cultivation_photo} fallbackIcon={Icon}
            badge={c.quality_grade ? `Grade ${c.quality_grade}` : undefined} own={c.user_id === user?.id} unavailable={c.status === "Sold" || c.quantity_remaining <= 0 ? "Sold out" : undefined} onManage={() => openAccount("listings")} actionLabel="Buy / contact grower" onAction={() => start({ type: "buy", crop: c })} />
        ));
    }
    if (section === "machinery") {
      return (queries.machinery.data ?? [])
        .filter((m) => matches(search, m.machine_type, m.location))
        .map((m) => (
          <ListingCard key={m.listing_id} title={m.machine_type} location={m.location} price={`₹${m.price_per_unit}`} priceUnit={perUnit(m.pricing_unit)}
            image={m.machine_photos} fallbackIcon={Icon} badge={m.status} own={m.owner_id === user?.id} unavailable={m.status === "Booked" ? "Currently booked" : undefined} onManage={() => openAccount("listings")} actionLabel="Book machinery" onAction={() => start({ type: "book", target: { kind: "machine", listing: m } })} />
        ));
    }
    return (queries.storage.data ?? [])
      .filter((s) => matches(search, s.storage_type, s.location))
      .map((s) => (
        <ListingCard key={s.listing_id} title={s.storage_type} subtitle={`Capacity ${s.total_capacity}`} location={s.location} price={`₹${s.price}`}
          priceUnit={perUnit(s.pricing_unit)} image={s.storage_photo} fallbackIcon={Icon} badge={s.availability_indicator} own={s.owner_id === user?.id} unavailable={s.availability_indicator === "Full" ? "Full right now" : undefined} onManage={() => openAccount("listings")} actionLabel="Book storage" onAction={() => start({ type: "book", target: { kind: "storage", listing: s } })} />
      ));
  })();

  return (
    <div className="min-h-dvh bg-[#f7f8f3] pb-24 text-slate-900 md:pb-12">
      <Header section={section} onSection={changeSection} onMenu={() => setOverlay("menu")} onAccount={() => openAccount()} />

      <main className="mx-auto max-w-6xl space-y-6 px-5 pt-6 md:px-10">
        <Hero onStartSelling={requireAuth} />
        <Filters noun={meta.noun} search={search} onSearch={setSearch} showCategories={section === "crops"} category={category} onCategory={setCategory} />

        <section aria-labelledby="results-title">
          <p className="text-sm font-semibold text-[#d8731c]">Marketplace</p>
          <h2 id="results-title" className="mb-4 text-2xl font-bold">{meta.title}</h2>
          {active.isLoading ? <LoadingCards />
            : active.isError ? <ErrorState onRetry={() => active.refetch()} />
            : cards.length === 0 ? <EmptyState noun={meta.noun} filtered={!!search || category !== "All"} onClear={clearFilters} />
            : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>}
        </section>
      </main>

      <BottomNav section={section} onSection={changeSection} onPost={requireAuth} onAccount={() => openAccount()} />

      {overlay === "auth" && <AuthSheet onClose={dismissAuth} onSuccess={() => setOverlay(null)} />}
      {overlay === "account" && <AccountSheet tab={accountTab} onClose={() => setOverlay(null)} onPost={requireAuth} />}
      {action?.type === "buy" && <BuySheet crop={action.crop} onClose={() => setAction(null)} onViewOrders={() => { setAction(null); openAccount("purchases"); }} />}
      {action?.type === "book" && <BookSheet target={action.target} onClose={() => setAction(null)} onViewOrders={() => { setAction(null); openAccount("purchases"); }} />}
      {action?.type === "post" && <PostSheet initial={action.kind} onClose={() => setAction(null)} />}
      {overlay === "menu" && <MenuSheet onClose={() => setOverlay(null)} onSection={changeSection} />}
    </div>
  );
}
