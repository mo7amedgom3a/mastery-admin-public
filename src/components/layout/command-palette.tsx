/* oxlint-disable react/only-export-components, react/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";

import { flatItems, navigation } from "@/config/navigation";
import {
  adminSearch,
  searchKeys,
  type AdminCustomer,
  type AdminInstructor,
  type AdminOrder,
  type AdminSearchHit,
  type AdminSearchKind,
  type Product,
} from "@/lib/api";
import { customerHref, orderHref, productHref } from "@/lib/refs";
import { translate, useLang } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { SearchIcon, type AnimatedIconHandle } from "@/components/icons/animated";
import { Icon } from "@/components/ui/icon";

type PaletteState = {
  open: boolean;
  initialQuery: string;
  setOpen: (open: boolean, initialQuery?: string) => void;
  openWithQuery: (query: string) => void;
};

export const usePaletteStore = create<PaletteState>((set) => ({
  open: false,
  initialQuery: "",
  setOpen: (open, initialQuery = "") => set({ open, initialQuery: open ? initialQuery : "" }),
  openWithQuery: (query) => set({ open: true, initialQuery: query }),
}));

export function useCommandPalette() {
  const open = usePaletteStore((state) => state.open);
  const setOpen = usePaletteStore((state) => state.setOpen);
  const openWithQuery = usePaletteStore((state) => state.openWithQuery);
  return {
    open,
    show: () => setOpen(true),
    showWithQuery: (q: string) => openWithQuery(q),
    close: () => setOpen(false),
  };
}

export type Result = {
  id: string;
  label: string;
  path: string;
  href: string;
  icon: string;
  source?: "b2c" | "legacy";
};

const ACTIONS: { ar: string; en: string; href: string; permission: string; icon: string; hint?: { ar: string; en: string } }[] = [
  { ar: "إنشاء دورة", en: "Create course", href: "/learning/courses/new", permission: "courses.create", icon: "plus" },
  { ar: "إنشاء دبلوم مباشر", en: "Create live diploma", href: "/learning/live-diplomas/new", permission: "courses.create", icon: "video" },
  { ar: "إنشاء باقة تعليمية", en: "Create bundle", href: "/learning/bundles/new", permission: "packages.create", icon: "layers" },
  { ar: "إنشاء حزمة مجمّعة", en: "Create package", href: "/learning/packages/new", permission: "courses.create", icon: "folder" },
  { ar: "إنشاء استشارة", en: "Create consultation", href: "/learning/consultations/new", permission: "consultations.read", icon: "calendar" },
  { ar: "إنشاء باقة اشتراك", en: "Create subscription plan", href: "/subscriptions/plans/new", permission: "subscriptionsWrite.write", icon: "refresh" },
  { ar: "إنشاء كوبون", en: "Create coupon", href: "/sales/coupons/new", permission: "coupons.create", icon: "tag" },
  { ar: "إضافة مدرب", en: "Add instructor", href: "/learning/instructors/new", permission: "instructors.write", icon: "user" },
  { ar: "إصدار استرداد لطلب", en: "Issue a refund", href: "/sales/orders", permission: "refunds.create", icon: "refund", hint: { ar: "اختر الطلب ثم «استرداد»", en: "Pick the order, then Refund" } },
  { ar: "الرد على أسئلة المتدربين", en: "Answer trainee questions", href: "/learning/qa", permission: "qa.read", icon: "message" },
  { ar: "مراجعة طلبات الصرف", en: "Review payout requests", href: "/marketing/payouts", permission: "affiliates.read", icon: "card" },
  { ar: "دعوة عضو فريق", en: "Invite a team member", href: "/settings/team", permission: "settings.read", icon: "users" },
];

type KindMeta = {
  ar: string;
  en: string;
  icon: string;
};

export const KIND_META: Record<AdminSearchKind, KindMeta> = {
  course: { ar: "الدورات", en: "Courses", icon: "book" },
  diploma: { ar: "الدبلومات", en: "Diplomas", icon: "award" },
  live_diploma: { ar: "الدبلومات المباشرة", en: "Live diplomas", icon: "video" },
  package: { ar: "الحزم التعليمية", en: "Packages", icon: "layers" },
  bundle: { ar: "الباقات المجمّعة", en: "Bundles", icon: "folder" },
  instructor: { ar: "المدرّبون", en: "Instructors", icon: "user" },
  student: { ar: "الطلاب والعملاء", en: "Students & customers", icon: "users" },
  order: { ar: "الطلبات", en: "Orders", icon: "receipt" },
  consultation: { ar: "الاستشارات", en: "Consultations", icon: "calendar" },
  consultant: { ar: "المستشارون", en: "Consultants", icon: "user" },
  expert: { ar: "الخبراء", en: "Experts", icon: "user" },
  subscription_plan: { ar: "باقات الاشتراك", en: "Subscription plans", icon: "refresh" },
  subscriber: { ar: "المشتركون", en: "Subscribers", icon: "users" },
  coupon: { ar: "الكوبونات", en: "Coupons", icon: "tag" },
  offer: { ar: "العروض", en: "Offers", icon: "zap" },
  ticket: { ar: "تذاكر الدعم", en: "Support tickets", icon: "ticket" },
  category: { ar: "التصنيفات", en: "Categories", icon: "folder" },
  affiliate: { ar: "المسوقون بالعمولة", en: "Affiliates", icon: "megaphone" },
  certificate: { ar: "الشهادات", en: "Certificates", icon: "award" },
};

const KIND_ORDER: AdminSearchKind[] = [
  "course",
  "diploma",
  "live_diploma",
  "package",
  "bundle",
  "instructor",
  "student",
  "order",
  "consultation",
  "expert",
  "consultant",
  "subscription_plan",
  "subscriber",
  "coupon",
  "offer",
  "category",
  "ticket",
  "affiliate",
  "certificate",
];

const QUICK_FILTERS: { id: string; kinds: string; ar: string; en: string }[] = [
  { id: "all", kinds: "", ar: "الكل", en: "All" },
  { id: "course", kinds: "course", ar: "دورات", en: "Courses" },
  { id: "diploma", kinds: "diploma,live_diploma", ar: "دبلومات", en: "Diplomas" },
  { id: "package", kinds: "package", ar: "حزم", en: "Packages" },
  { id: "bundle", kinds: "bundle", ar: "باقات", en: "Bundles" },
  { id: "instructor", kinds: "instructor,consultant,expert", ar: "مدربون وخبراء", en: "Instructors" },
  { id: "student", kinds: "student,subscriber", ar: "طلاب وعملاء", en: "Students" },
  { id: "order", kinds: "order,coupon,offer", ar: "طلبات وكوبونات", en: "Orders & coupons" },
];

/** Extracts any already-cached resources from React Query so known items appear instantly before the API responds. */
function searchCachedResources(queryClient: ReturnType<typeof useQueryClient>, q: string): AdminSearchHit[] {
  if (!q) return [];
  const lower = q.toLowerCase();
  const hits: AdminSearchHit[] = [];
  const seen = new Set<string>();
  const push = (hit: AdminSearchHit) => {
    const key = `${hit.kind}:${hit.ref}`;
    if (!seen.has(key)) {
      seen.add(key);
      hits.push(hit);
    }
  };

  // 1. Cached catalog products
  for (const [, data] of queryClient.getQueriesData<{ items?: Product[] }>({ queryKey: ["products"] })) {
    for (const item of data?.items ?? []) {
      const hay = [item.title, item.slug, item.instructor, item.category, item.ref].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(lower)) {
        const kind = (item.product_type as AdminSearchKind) || "course";
        const ref = item.ref ?? `b2c:${item.product_id}`;
        push({
          kind: kind in KIND_META ? kind : "course",
          id: String(item.product_id ?? item.legacy_id ?? ref),
          ref,
          source: item.source === "legacy" ? "legacy" : "b2c",
          title: item.title || item.slug || ref,
          subtitle: [item.instructor, item.category, item.status].filter(Boolean).join(" · "),
          status: item.status,
          href: productHref(ref),
          image_url: item.square_image ?? item.image,
        });
      }
    }
  }

  // 2. Cached instructors
  for (const [, data] of queryClient.getQueriesData<{ items?: AdminInstructor[] } | AdminInstructor[]>({ queryKey: ["learning", "instructors"] })) {
    const list = Array.isArray(data) ? data : (data?.items ?? []);
    for (const row of list) {
      const name = row.name ?? (row as unknown as { display_name?: string }).display_name ?? "";
      const email = row.email ?? "";
      const spec = row.specialization ?? (row as unknown as { specialized?: string }).specialized ?? "";
      if ([name, email, spec].join(" ").toLowerCase().includes(lower)) {
        const id = row.legacy_trainer_id;
        if (id != null) {
          push({
            kind: "instructor",
            id: String(id),
            ref: `legacy:instructor:${id}`,
            source: "legacy",
            title: name || `Instructor #${id}`,
            subtitle: [spec, email].filter(Boolean).join(" · "),
            href: `/learning/instructors/${id}`,
          });
        }
      }
    }
  }

  // 3. Cached customers / students
  for (const [, data] of queryClient.getQueriesData<{ items?: AdminCustomer[] }>({ queryKey: ["customers"] })) {
    for (const cust of data?.items ?? []) {
      const hay = [cust.full_name, cust.email, cust.phone, cust.ref, cust.legacy_user_id].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(lower)) {
        push({
          kind: "student",
          id: String(cust.customer_id ?? cust.legacy_user_id ?? cust.ref),
          ref: cust.ref,
          source: cust.source,
          title: cust.full_name || cust.email || cust.ref,
          subtitle: [cust.email, cust.phone, cust.country_code].filter(Boolean).join(" · "),
          status: cust.status,
          href: customerHref(cust.ref),
        });
      }
    }
  }

  // 4. Cached orders
  for (const [, data] of queryClient.getQueriesData<{ items?: AdminOrder[] }>({ queryKey: ["orders"] })) {
    for (const ord of data?.items ?? []) {
      const hay = [ord.customer_email, ord.ref, ord.order_id, ord.legacy_order_id].filter(Boolean).join(" ").toLowerCase();
      if (hay.includes(lower)) {
        push({
          kind: "order",
          id: String(ord.order_id ?? ord.legacy_order_id ?? ord.ref),
          ref: ord.ref,
          source: ord.source,
          title: `Order #${ord.legacy_order_id ?? String(ord.order_id ?? ord.ref).slice(0, 8)}`,
          subtitle: [ord.customer_email, ord.status].filter(Boolean).join(" · "),
          status: ord.status,
          href: orderHref(ord.ref),
        });
      }
    }
  }

  return hits;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const lang = useLang();
  const queryClient = useQueryClient();
  const initialQuery = usePaletteStore((state) => state.initialQuery);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<AnimatedIconHandle>(null);
  const t = (ar: string, en: string) => translate(lang, ar, en);

  const term = query.trim();
  const qLower = term.toLowerCase();

  // Compute local matches (navigation pages, quick actions, and React Query cache)
  const localMatches = useMemo(() => {
    const match = (...texts: (string | undefined | null)[]) =>
      !qLower || texts.some((value) => (value ?? "").toLowerCase().includes(qLower));

    const pages: Result[] =
      activeFilter === "all"
        ? flatItems(navigation)
            .filter((item) => (!item.permission || can(item.permission)) && match(item.title.ar, item.title.en, item.module.title.ar, item.module.title.en, item.href))
            .slice(0, qLower ? 8 : 6)
            .map<Result>((item) => ({
              id: `page:${item.href}`,
              label: translate(lang, item.title.ar, item.title.en),
              path: `${translate(lang, item.module.title.ar, item.module.title.en)} / ${translate(lang, item.section.title.ar, item.section.title.en)}`,
              href: item.href,
              icon: item.module.icon,
            }))
        : [];

    const actions: Result[] =
      activeFilter === "all"
        ? ACTIONS.filter((a) => can(a.permission) && match(a.ar, a.en, a.href)).map<Result>((a) => ({
            id: `action:${a.href}:${a.en}`,
            label: translate(lang, a.ar, a.en),
            path: a.hint ? translate(lang, a.hint.ar, a.hint.en) : "",
            href: a.href,
            icon: a.icon,
          }))
        : [];

    const cachedHits = searchCachedResources(queryClient, qLower);
    return { pages, actions, cachedHits };
  }, [qLower, lang, activeFilter, queryClient, open]);

  const hasLocalResourceMatch =
    localMatches.pages.length > 0 || localMatches.actions.length > 0 || localMatches.cachedHits.length > 0;

  // Debounce the search term; if no local resource is found at all, request the API even faster (60ms vs 180ms).
  useEffect(() => {
    if (!term) {
      setDebouncedQuery("");
      return;
    }
    const delay = hasLocalResourceMatch ? 180 : 60;
    const handle = window.setTimeout(() => {
      setDebouncedQuery(term);
    }, delay);
    return () => window.clearTimeout(handle);
  }, [term, hasLocalResourceMatch]);

  const selectedFilterMeta = QUICK_FILTERS.find((f) => f.id === activeFilter) ?? QUICK_FILTERS[0];
  const apiTerm = debouncedQuery || (!hasLocalResourceMatch ? term : "");

  // Automatically request the unified admin search API when the user enters a query (or immediately if not found locally)
  const adminSearchQuery = useQuery({
    queryKey: searchKeys.admin({
      q: apiTerm,
      kinds: selectedFilterMeta.kinds || undefined,
      limit_per_kind: selectedFilterMeta.kinds ? 10 : 5,
    }),
    queryFn: () =>
      adminSearch({
        q: apiTerm,
        kinds: selectedFilterMeta.kinds || undefined,
        limit_per_kind: selectedFilterMeta.kinds ? 10 : 5,
      }),
    enabled: open && apiTerm.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const groups = useMemo(() => {
    const out: [string, Result[]][] = [];
    const allowedKinds = selectedFilterMeta.kinds
      ? new Set(selectedFilterMeta.kinds.split(","))
      : null;

    // Merge cached hits + live API hits, deduplicated by kind + ref
    const mergedByKind = new Map<AdminSearchKind, Result[]>();
    const seenRefs = new Set<string>();

    const allHits: AdminSearchHit[] = [
      ...(adminSearchQuery.data?.items ?? []),
      ...(term.length >= 1 ? localMatches.cachedHits : []),
    ];

    for (const hit of allHits) {
      if (allowedKinds && !allowedKinds.has(hit.kind)) continue;
      const dedupKey = `${hit.kind}:${hit.ref}`;
      if (seenRefs.has(dedupKey)) continue;
      seenRefs.add(dedupKey);

      const meta = KIND_META[hit.kind] ?? { ar: "نتائج", en: "Results", icon: "file" };
      const list = mergedByKind.get(hit.kind) ?? [];
      const sourceLabel = hit.source === "legacy" ? t("قديم", "Legacy") : "B2C";
      const pathParts = [hit.subtitle, sourceLabel].filter(Boolean);
      list.push({
        id: dedupKey,
        label: hit.title,
        path: pathParts.join(" · "),
        href: hit.href,
        icon: meta.icon,
        source: hit.source,
      });
      mergedByKind.set(hit.kind, list);
    }

    for (const kind of KIND_ORDER) {
      const items = mergedByKind.get(kind);
      if (items?.length) {
        const meta = KIND_META[kind];
        out.push([t(meta.ar, meta.en), items]);
      }
    }

    if (localMatches.pages.length) {
      out.push([t("الصفحات", "Pages"), localMatches.pages]);
    }
    if (localMatches.actions.length) {
      out.push([t("إجراءات سريعة", "Quick actions"), localMatches.actions]);
    }

    if (term.length >= 2) {
      out.push([
        t("بحث متقدم", "Full search"),
        [
          {
            id: `full-search:${term}`,
            label: t(`عرض كل نتائج البحث عن «${term}»`, `Search all catalog & instructors for "${term}"`),
            path: "/search",
            href: `/search?q=${encodeURIComponent(term)}`,
            icon: "search",
          },
        ],
      ]);
    }

    return out;
  }, [
    term,
    lang,
    selectedFilterMeta.kinds,
    adminSearchQuery.data,
    localMatches.pages,
    localMatches.actions,
    localMatches.cachedHits,
  ]);

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery || "");
      setDebouncedQuery(initialQuery || "");
      setActiveFilter("all");
      setSel(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        iconRef.current?.startAnimation();
        if (initialQuery) {
          inputRef.current?.select();
        }
      });
    }
  }, [open, initialQuery]);

  useEffect(() => {
    setSel((value) => Math.min(value, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    navigate(href);
  };

  const isSearchingDb = adminSearchQuery.isFetching && term.length >= 1;

  return (
    <div className="ma-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ma-palette" role="dialog" aria-modal="true" aria-label={t("البحث الشامل", "Command search")}>
        <div className="ma-palette__search">
          <SearchIcon ref={iconRef} size={20} className="ma-palette__icon" />
          <input
            ref={inputRef}
            className="ma-palette__input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
            aria-autocomplete="list"
            aria-label={t("البحث الشامل", "Command search")}
            placeholder={t(
              "ابحث عن دورة، دبلوم، حزمة، باقة، مدرب، طالب، طلب، كوبون أو صفحة…",
              "Search courses, diplomas, packages, bundles, instructors, students, orders, pages…",
            )}
            value={query}
            onFocus={() => iconRef.current?.startAnimation()}
            onBlur={() => iconRef.current?.stopAnimation()}
            onChange={(event) => {
              setQuery(event.target.value);
              setSel(0);
              iconRef.current?.startAnimation();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                setSel((v) => (v + 1) % Math.max(flat.length, 1));
                event.preventDefault();
              } else if (event.key === "ArrowUp") {
                setSel((v) => (v - 1 + flat.length) % Math.max(flat.length, 1));
                event.preventDefault();
              } else if (event.key === "Enter" && flat[sel]) {
                go(flat[sel].href);
              } else if (event.key === "Escape") {
                onClose();
              } else if (event.key === "Tab") {
                event.preventDefault();
                const currentIdx = QUICK_FILTERS.findIndex((f) => f.id === activeFilter);
                const nextIdx = (currentIdx + (event.shiftKey ? QUICK_FILTERS.length - 1 : 1)) % QUICK_FILTERS.length;
                setActiveFilter(QUICK_FILTERS[nextIdx].id);
                setSel(0);
              }
            }}
          />
          {isSearchingDb ? (
            <span className="ma-palette__status">
              {t("جاري البحث…", "Searching DB…")}
            </span>
          ) : null}
          <span className="ma-kbd" aria-hidden="true">Esc</span>
        </div>

        {/* Category Filter Bar — wrapped cleanly inside the border layout */}
        <div
          className="ma-palette__filters"
          role="tablist"
          aria-label={t("تصفية حسب النوع", "Filter by resource type")}
        >
          {QUICK_FILTERS.map((filter) => {
            const selected = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                className="ma-palette__filter"
                aria-selected={selected}
                onClick={() => {
                  setActiveFilter(filter.id);
                  setSel(0);
                  inputRef.current?.focus();
                }}
              >
                {t(filter.ar, filter.en)}
              </button>
            );
          })}
        </div>

        <ul className="ma-palette__list" id="pal-list" role="listbox">
          {flat.length ? (
            groups.map(([group, items]) => (
              <li key={group} role="presentation" className="ma-palette__group">
                <div className="ma-palette__group-title">{group}</div>
                <ul className="ma-palette__sublist" role="presentation">
                  {items.map((item) => {
                    const index = flat.indexOf(item);
                    return (
                      <li
                        key={item.id}
                        role="option"
                        id={`pal-${index}`}
                        className="ma-palette__item"
                        aria-selected={index === sel}
                        onMouseEnter={() => setSel(index)}
                        onClick={() => go(item.href)}
                      >
                        <Icon name={item.icon} />
                        <span className="ma-palette__label">{item.label}</span>
                        {item.path ? <span className="ma-palette__path">{item.path}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          ) : isSearchingDb ? (
            <li className="ma-palette__empty" role="presentation">
              {t("جاري البحث في قاعدة البيانات…", "Searching platform database…")}
            </li>
          ) : (
            <li className="ma-palette__empty" role="presentation">
              {t("لا توجد نتائج مطابقة", "No matching results")}
            </li>
          )}
        </ul>
        <div className="ma-palette__foot">
          <span>
            <span className="ma-kbd">↑↓</span> {t("تنقل", "move")}
          </span>
          <span>
            <span className="ma-kbd">Tab</span> {t("تبديل الفئة", "filter")}
          </span>
          <span>
            <span className="ma-kbd">Enter</span> {t("فتح", "open")}
          </span>
          <span>
            <span className="ma-kbd">Esc</span> {t("إغلاق", "close")}
          </span>
        </div>
      </div>
    </div>
  );
}
