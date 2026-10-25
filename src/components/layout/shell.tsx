/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { navigation, flatItems, matchActive, type NavModule } from "@/config/navigation";
import { adminSearch, searchKeys } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAdminAuth } from "@/lib/auth/store";
import { useLang, useLangStore, translate, useT } from "@/lib/i18n";
import { MenuIcon, SearchIcon, type AnimatedIconHandle } from "@/components/icons/animated";
import { Icon } from "@/components/ui/icon";
import { IconButton, Avatar } from "@/components/ui/kit";
import { Button as BaseButton } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf } from "@/lib/status";
import { CommandPalette, KIND_META, useCommandPalette, usePaletteStore } from "./command-palette";

const COLLAPSED_KEY = "admin.sidebarCollapsed";
const NAV_STATE_KEY = "admin.navState";

function readCollapsed(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(COLLAPSED_KEY) === "1";
}

type NavState = {
  /** `${moduleId}:${sectionIndex}` → open. Missing means "default": open only when it holds the active page. */
  openSections: Record<string, boolean>;
  /** `${moduleId}:${itemHref}` → open. Missing means "default": open only when the item or a child is active. */
  openSubMenus: Record<string, boolean>;
};

const EMPTY_NAV_STATE: NavState = { openSections: {}, openSubMenus: {} };

function readNavState(): NavState {
  if (typeof localStorage === "undefined") return EMPTY_NAV_STATE;
  try {
    const parsed = JSON.parse(localStorage.getItem(NAV_STATE_KEY) ?? "null") as Partial<NavState> | null;
    return {
      openSections: parsed?.openSections ?? {},
      openSubMenus: parsed?.openSubMenus ?? {},
    };
  } catch {
    return EMPTY_NAV_STATE;
  }
}

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const admin = useAdminAuth((state) => state.admin);
  const logout = useAdminAuth((state) => state.logout);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [navOpen, setNavOpen] = useState(false);
  const palette = useCommandPalette();
  const studio = useMatches().some((match) => (match.handle as { studio?: boolean } | undefined)?.studio);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Any navigation closes the mobile drawer.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Ctrl/⌘ K opens the command palette; Ctrl/⌘ B collapses the sidebar (NavModule).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        usePaletteStore.getState().setOpen(true);
      } else if (key === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const nav = useMemo(() => navigation.filter((m) => m.disabled || m.sections.length), []);
  const active = useMemo(() => matchActive(location.pathname, flatItems(nav)), [location.pathname, nav]);
  const activeModule = nav.find((m) => m.id === (active?.module.id ?? "")) ?? nav[0];

  const crumbs = useMemo(() => {
    if (!active) return [];
    const moduleHref = active.module.sections[0]?.items[0]?.href;
    const out: [string, string][] = [[translate(lang, active.module.title.ar, active.module.title.en), moduleHref]];
    if (active.parent && active.parent.href !== moduleHref) {
      out.push([translate(lang, active.parent.title.ar, active.parent.title.en), active.parent.href]);
    }
    if (active.href !== moduleHref && (!active.parent || active.href !== active.parent.href)) {
      out.push([translate(lang, active.title.ar, active.title.en), active.href]);
    }
    return out;
  }, [active, lang]);

  return (
    <div className={cn("ma-shell", studio && "is-studio", collapsed && "is-sidebar-collapsed", navOpen && "is-nav-open")}>
      <CommandPalette open={palette.open} onClose={palette.close} />

      <div className="ma-nav-drawer" id="nav-drawer">
        {/* Rail */}
        <nav className="ma-rail" aria-label={t("المجالات", "Domains")}>
          <Link className="ma-rail__logo" to="/dashboard" aria-label={t("ماستري أكاديمي - الرئيسية", "Mastery Academy home")}>
            <svg className="ma-logo" width="44" height="19" aria-hidden="true">
              <use href="#ma-mark" />
            </svg>
          </Link>
          {nav.map((m) => {
            const first = m.sections[0]?.items[0]?.href ?? m.href ?? "/dashboard";
            const current = m.id === activeModule.id;
            return (
              <Link
                key={m.id}
                className={cn("ma-rail__item", m.disabled && "is-disabled")}
                to={m.disabled ? "/dashboard" : first}
                onClick={(event) => {
                  if (m.disabled) {
                    event.preventDefault();
                    return;
                  }
                  // Any domain click reveals the contextual panel again, including the active one,
                  // so a collapsed sidebar can always be reopened from the rail.
                  setCollapsed(false);
                  setNavOpen(false);
                }}
                aria-current={current ? "true" : undefined}
                title={translate(useLangStore.getState().lang, m.title.ar, m.title.en)}
              >
                <Icon name={m.icon} />
                <span>{translate(useLangStore.getState().lang, m.title.ar, m.title.en)}</span>
              </Link>
            );
          })}
          <span className="ma-rail__spacer" />
          <ThemeToggle />
        </nav>

        {/* Sidebar */}
        <nav
          id="admin-sidebar"
          className="ma-sidebar"
          aria-label={translate(useLangStore.getState().lang, activeModule.title.ar, activeModule.title.en)}
        >
          <Sidebar module={activeModule} activeHref={active?.href} onCollapse={() => setCollapsed(true)} />
        </nav>
      </div>

      <div className="ma-scrim" onClick={() => setNavOpen(false)} />

      <div className="ma-main">
        <header className="ma-topbar">
          <span className="ma-topbar__mobile">
            <IconButton iconNode={<MenuIcon size={22} />} label={t("فتح القائمة", "Open menu")} onClick={() => setNavOpen(true)} />
          </span>
          {studio ? null : (
            <IconButton
              className="ma-topbar__sidebar"
              icon="panel"
              dirIcon
              label={collapsed ? t("توسيع القائمة الجانبية", "Expand sidebar") : t("طيّ القائمة الجانبية", "Collapse sidebar")}
              aria-expanded={!collapsed}
              aria-controls="admin-sidebar"
              aria-keyshortcuts="Control+B"
              onClick={() => setCollapsed((v) => !v)}
            />
          )}
          <nav className="ma-topbar__crumbs ma-breadcrumbs" aria-label={t("مسار التنقل", "Breadcrumb")}>
            <ol>
              {crumbs.map(([label, href], index) => {
                const last = index === crumbs.length - 1;
                return (
                  <li key={`${label}-${index}`}>
                    {index ? <Icon name="chevronEnd" className="ma-icon-dir" /> : null}
                    {last || !href ? (
                      <span aria-current={last ? "page" : undefined}>{label}</span>
                    ) : (
                      <Link to={href}>{label}</Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="ma-topbar__actions">
            <SearchButton label={t("بحث شامل أو أمر", "Search everything or jump to")} onClick={palette.show} />
            <LangToggle />
            <ThemeToggle />
            <AccountMenu email={admin?.email ?? ""} onSignOut={async () => {
              await logout();
              navigate("/login");
            }} />
          </div>
        </header>
        <main id="main" className={cn("ma-content", studio && "ma-content--wide")} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({ module, activeHref, onCollapse }: { module: NavModule; activeHref?: string; onCollapse?: () => void }) {
  const t = useT();
  const lang = useLang();
  const location = useLocation();
  const searchIcon = useRef<AnimatedIconHandle>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [navState, setNavState] = useState<NavState>(readNavState);

  // Persist section / sub-menu disclosure so the panel keeps the user's shape across reloads.
  useEffect(() => {
    try {
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify(navState));
    } catch {
      // Storage unavailable (private mode / quota) — fall back to in-memory state.
    }
  }, [navState]);

  // The in-panel search is scoped to the active domain; drop it when the domain changes.
  useEffect(() => {
    setQuery("");
    setDebouncedQuery("");
  }, [module.id]);

  // Navigating to a page reveals its section and parent item even if the user collapsed them.
  useEffect(() => {
    if (!activeHref) return;
    setNavState((prev) => {
      const openSections = { ...prev.openSections };
      const openSubMenus = { ...prev.openSubMenus };
      let changed = false;

      module.sections.forEach((section, si) => {
        const sectionKey = `${module.id}:${si}`;
        const holdsSection = section.items.some(
          (item) => item.href === activeHref || activeHref.startsWith(`${item.href}/`),
        );
        if (holdsSection && openSections[sectionKey] === false) {
          openSections[sectionKey] = true;
          changed = true;
        }

        for (const item of section.items) {
          if (!item.children?.length) continue;
          const itemKey = `${module.id}:${item.href}`;
          const holdsItem =
            item.href === activeHref ||
            activeHref.startsWith(`${item.href}/`) ||
            item.children.some((child) => child.href === activeHref || activeHref.startsWith(`${child.href}/`));
          if (holdsItem && openSubMenus[itemKey] === false) {
            openSubMenus[itemKey] = true;
            changed = true;
          }
        }
      });

      return changed ? { openSections, openSubMenus } : prev;
    });
  }, [activeHref, module.id, module.sections]);

  const rawTerm = query.trim();
  const q = rawTerm.toLowerCase();

  const matchingModuleSections = useMemo(() => {
    if (module.disabled) return [];
    return module.sections
      .map((section, si) => {
        const items = section.items.filter(
          (item) =>
            !q ||
            translate(lang, item.title.ar, item.title.en).toLowerCase().includes(q) ||
            item.title.en.toLowerCase().includes(q) ||
            item.title.ar.toLowerCase().includes(q) ||
            item.children?.some(
              (c) =>
                translate(lang, c.title.ar, c.title.en).toLowerCase().includes(q) ||
                c.title.en.toLowerCase().includes(q) ||
                c.title.ar.toLowerCase().includes(q),
            ),
        );
        return { section, si, items };
      })
      .filter(({ items }) => !q || items.length > 0);
  }, [module, q, lang]);

  // Also check other modules' pages when the query isn't found in the active module
  const otherDomainPages = useMemo(() => {
    if (!q || matchingModuleSections.length > 0) return [];
    return flatItems(navigation)
      .filter(
        (item) =>
          item.module.id !== module.id &&
          (translate(lang, item.title.ar, item.title.en).toLowerCase().includes(q) ||
            item.title.en.toLowerCase().includes(q) ||
            item.title.ar.toLowerCase().includes(q)),
      )
      .slice(0, 5);
  }, [q, matchingModuleSections.length, module.id, lang]);

  const notFoundLocally = Boolean(q && matchingModuleSections.length === 0 && otherDomainPages.length === 0);

  // Debounce query for automatic API fallback when not found in local sidebar pages
  useEffect(() => {
    if (!rawTerm || !notFoundLocally) {
      setDebouncedQuery("");
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedQuery(rawTerm);
    }, 150);
    return () => window.clearTimeout(handle);
  }, [rawTerm, notFoundLocally]);

  const fallbackSearch = useQuery({
    queryKey: searchKeys.admin({ q: debouncedQuery, limit_per_kind: 3 }),
    queryFn: () => adminSearch({ q: debouncedQuery, limit_per_kind: 3 }),
    enabled: notFoundLocally && debouncedQuery.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  if (module.disabled) {
    return (
      <>
        <div className="ma-sidebar__head">
          <h2 className="ma-sidebar__title">{translate(lang, module.title.ar, module.title.en)}</h2>
        </div>
        <p className="ma-sidebar__empty">{module.note ? translate(lang, module.note.ar, module.note.en) : ""}</p>
      </>
    );
  }

  const openGlobalWithQuery = () => {
    usePaletteStore.getState().openWithQuery(rawTerm);
  };

  return (
    <>
      <div className="ma-sidebar__head">
        <h2 className="ma-sidebar__title">{translate(lang, module.title.ar, module.title.en)}</h2>
        {onCollapse ? (
          <IconButton
            icon="panel"
            dirIcon
            label={t("طيّ القائمة الجانبية", "Collapse sidebar")}
            aria-expanded
            aria-controls="admin-sidebar"
            aria-keyshortcuts="Control+B"
            onClick={onCollapse}
          />
        ) : null}
      </div>
      <div className="ma-sidebar__search">
        <div className="ma-search">
          <SearchIcon ref={searchIcon} size={18} className="ma-search__icon" />
          <input
            className="ma-input ma-input--search"
            type="search"
            placeholder={t("ابحث في الصفحات أو المنصة…", "Search pages or platform…")}
            aria-label={t("ابحث في الصفحات أو المنصة", "Search pages or platform")}
            value={query}
            onFocus={() => searchIcon.current?.startAnimation()}
            onBlur={() => searchIcon.current?.stopAnimation()}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && rawTerm) {
                event.preventDefault();
                openGlobalWithQuery();
              }
            }}
          />
        </div>
      </div>
      <div className="ma-sidebar__nav">
        {matchingModuleSections.map(({ section, si, items }) => {
          const holdsActive = section.items.some((item) => item.href === activeHref);
          const key = `${module.id}:${si}`;
          // Default: only the section holding the current page is open; the rest stay collapsed
          // until the user opens them (their choice is persisted).
          const open = Boolean(navState.openSections[key] ?? holdsActive);
          return (
            <div className="ma-sidebar__section" key={key}>
              <button
                type="button"
                className="ma-sidebar__section-btn"
                aria-expanded={q ? true : open}
                onClick={() =>
                  setNavState((state) => ({
                    ...state,
                    openSections: { ...state.openSections, [key]: !open },
                  }))
                }
              >
                <Icon name="chevron" />
                {translate(lang, section.title.ar, section.title.en)}
              </button>
              <ul className="ma-sidebar__list" hidden={q ? false : !open}>
                {items.map((item) => {
                  const hasChildren = Boolean(item.children && item.children.length > 0);
                  const isChildActive = Boolean(
                    hasChildren &&
                      item.children!.some(
                        (c) =>
                          c.href === activeHref ||
                          location.pathname === c.href ||
                          (c.href !== item.href && location.pathname.startsWith(`${c.href}/`)),
                      ),
                  );
                  const isItemActive = item.href === activeHref || (!isChildActive && location.pathname === item.href);
                  const itemKey = `${module.id}:${item.href}`;
                  const isSubOpen = Boolean(q || (navState.openSubMenus[itemKey] ?? (isItemActive || isChildActive)));

                  return (
                    <li key={item.href} className={cn("ma-sidebar__item", hasChildren && "has-children")}>
                      <div className="ma-sidebar__row">
                        <NavLink
                          className={cn("ma-sidebar__link", (isItemActive || isChildActive) && "is-active")}
                          to={item.href}
                        >
                          <span>{translate(lang, item.title.ar, item.title.en)}</span>
                        </NavLink>
                        {hasChildren ? (
                          <button
                            type="button"
                            className="ma-sidebar__sub-toggle"
                            aria-expanded={isSubOpen}
                            aria-label={t("تبديل القائمة الفرعية", "Toggle sub-menu")}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNavState((state) => ({
                                ...state,
                                openSubMenus: { ...state.openSubMenus, [itemKey]: !isSubOpen },
                              }));
                            }}
                          >
                            <Icon name="chevron" className="ma-sidebar__sub-chevron" />
                          </button>
                        ) : null}
                      </div>
                      {hasChildren && isSubOpen ? (
                        <ul className="ma-sidebar__sublist">
                          {item.children!.map((child) => {
                            const isThisChildActive =
                              child.href === activeHref ||
                              location.pathname === child.href ||
                              location.pathname.startsWith(`${child.href}/`);
                            return (
                              <li key={child.href}>
                                <NavLink
                                  className={cn("ma-sidebar__sublink", isThisChildActive && "is-active")}
                                  to={child.href}
                                >
                                  <span>{translate(lang, child.title.ar, child.title.en)}</span>
                                </NavLink>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {otherDomainPages.length > 0 ? (
          <div className="ma-sidebar__section">
            <div className="ma-sidebar__section-btn" aria-expanded="true">
              <Icon name="chevron" />
              {t("صفحات في أقسام أخرى", "Other domains")}
            </div>
            <ul className="ma-sidebar__list">
              {otherDomainPages.map((item) => (
                <li key={item.href}>
                  <NavLink className="ma-sidebar__link" to={item.href} onClick={() => setQuery("")}>
                    <span>{translate(lang, item.title.ar, item.title.en)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {notFoundLocally ? (
          <div className="ma-sidebar__section">
            <div className="ma-sidebar__section-btn" aria-expanded="true">
              <Icon name="search" />
              {fallbackSearch.isFetching
                ? t("جاري البحث في المنصة…", "Searching platform…")
                : t("نتائج من المنصة", "Platform results")}
            </div>
            <ul className="ma-sidebar__list">
              {(fallbackSearch.data?.items ?? []).slice(0, 8).map((hit) => {
                const meta = KIND_META[hit.kind];
                return (
                  <li key={`${hit.kind}:${hit.ref}`}>
                    <NavLink
                      className="ma-sidebar__link"
                      to={hit.href}
                      onClick={() => setQuery("")}
                      title={hit.subtitle ?? hit.title}
                    >
                      <Icon name={meta?.icon ?? "file"} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hit.title}
                      </span>
                    </NavLink>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  className="ma-sidebar__link"
                  style={{ width: "100%", textAlign: "start", background: "none", border: "none", cursor: "pointer" }}
                  onClick={openGlobalWithQuery}
                >
                  <Icon name="search" />
                  <span>{t(`بحث شامل عن «${rawTerm}»…`, `Global search for "${rawTerm}"…`)}</span>
                </button>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}

function SearchButton({ label, onClick }: { label: string; onClick: () => void }) {
  const icon = useRef<AnimatedIconHandle>(null);
  return (
    <BaseButton
      variant="soft"
      size="sm"
      onClick={onClick}
      aria-keyshortcuts="Control+K Meta+K"
      onMouseEnter={() => icon.current?.startAnimation()}
      onMouseLeave={() => icon.current?.stopAnimation()}
    >
      <SearchIcon ref={icon} size={18} />
      <span className="ma-topbar__desktop">{label}</span>
      <span className="ma-kbd ma-topbar__desktop">Ctrl K</span>
    </BaseButton>
  );
}

function LangToggle() {
  const lang = useLang();
  const setLang = useLangStore((state) => state.setLang);
  return <IconButton icon="globe" label={lang === "ar" ? "English" : "العربية"} onClick={() => setLang(lang === "ar" ? "en" : "ar")} />;
}

function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="ma-btn ma-btn--bare ma-btn--icon ma-usermenu" aria-label={t("حسابي", "My account")}>
          <Avatar initials={email ? initialsOf(email) : "MA"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {email ? (
          <>
            <DropdownMenuLabel>
              <bdi>{email}</bdi>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={() => navigate("/settings/team")}>
          <Icon name="users" />
          {t("الفريق والأدوار", "Team & roles")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/settings/audit")}>
          <Icon name="history" />
          {t("سجل التدقيق", "Audit log")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <Icon name="logout" className="ma-icon-dir" />
          {t("تسجيل الخروج", "Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
