/* Course details revamp: demo app. Plain script, no build, no network. State lives in `S`; the main area re-renders from it. */
(function () {
  "use strict";
  const C = window.COURSE;

  /* ---------- Helpers ---------- */
  const store = {
    get(k, d) { try { return localStorage.getItem("cd-" + k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("cd-" + k, v); } catch (e) { /* private mode */ } },
  };
  const S = {
    lang: store.get("lang", "ar"), theme: store.get("theme", "dark"),
    tab: "overview", view: "list", sec: "all", q: "",
    collapsed: {}, published: true, descFixed: false, editing: null, drag: null,
  };
  const TABS = ["overview", "content", "resources", "instructors", "related", "legacy"];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const L = (o) => (o && typeof o === "object" ? o[S.lang] : o);
  const t = (k) => { const v = T[k]; if (!v) return k; return v[S.lang === "ar" ? 0 : 1]; };
  const money = (n) => "$" + n.toFixed(2);
  const dur = (s) => { const m = Math.floor(s / 60), x = s % 60; return m + ":" + String(x).padStart(2, "0"); };
  const longDur = (s) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return S.lang === "ar" ? (h ? h + " س " : "") + m + " د" : (h ? h + "h " : "") + m + "m"; };
  const fdate = (iso, withTime) => new Intl.DateTimeFormat(S.lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(iso));
  const cleanDesc = (raw) => new DOMParser().parseFromString(raw, "text/html").body.textContent.trim();
  const allLessons = () => C.sections.flatMap((s) => s.lessons);
  const totalSec = () => allLessons().reduce((a, l) => a + l.sec, 0);
  const secSec = (s) => s.lessons.reduce((a, l) => a + l.sec, 0);
  const $ = (sel, root = document) => root.querySelector(sel);

  /* Content-quality checks on the curriculum (the old page showed none of these). */
  function issuesOf(l) {
    const out = [];
    const same = allLessons().filter((x) => L(x.title) === L(l.title) && x.sec === l.sec);
    if (same.length > 1 && same[0] !== l) out.push("dup");
    if (/\b[a-z]{5,}\b/i.test(l.title.ar) && /[؀-ۿ]/.test(l.title.ar)) out.push("test");
    return out;
  }
  const curriculumIssues = () => allLessons().flatMap((l) => issuesOf(l).map((k) => ({ k, l })));

  /* ---------- Strings ---------- */
  const T = {
    skip: ["تخطي إلى المحتوى", "Skip to content"],
    search: ["بحث أو أمر", "Search or command"],
    catalog: ["الكتالوج", "Catalog"],
    published: ["منشور", "Published"], draft: ["مسودة", "Draft"],
    openStudio: ["فتح الاستوديو", "Open studio"], unpublish: ["إلغاء النشر", "Unpublish"], publish: ["نشر", "Publish"],
    openCatalog: ["فتح في الكتالوج", "Open in catalog"],
    "tab.overview": ["نظرة عامة", "Overview"], "tab.content": ["محتوى الدورة", "Course content"],
    "tab.resources": ["المصادر والمحتوى", "Resources"], "tab.instructors": ["المدربون", "Instructors"],
    "tab.related": ["ذات صلة", "Related"], "tab.legacy": ["محتوى النظام القديم", "Legacy content"],
    price: ["السعر", "Price"], paidOrders: ["طلبات مدفوعة", "Paid orders"], curriculum: ["المنهج", "Curriculum"],
    duration: ["المدة الكلية", "Total duration"], updated: ["آخر تحديث", "Last updated"], created: ["أُنشئ", "Created"],
    sections: ["أقسام", "sections"], lessons: ["دروس", "lessons"], lesson: ["درس", "lesson"],
    free: ["مجانية", "Free"], notSet: ["غير محدد", "Not set"], set: ["تحديد", "Set"], add: ["إضافة", "Add"], edit: ["تعديل", "Edit"],
    productDetails: ["تفاصيل المنتج", "Product details"], accessCats: ["الوصول والتصنيفات", "Access & categories"],
    type: ["النوع", "Type"], id: ["المُعرّف", "ID"], trainer: ["المدرّب", "Instructor"], comparePrice: ["سعر المقارنة", "Compare-at price"],
    shortDesc: ["الوصف المختصر", "Short description"], accessDays: ["مدة الوصول (أيام)", "Access duration (days)"],
    extension: ["تفعيل التمديد", "Enable extension"], extPrice: ["سعر التمديد", "Extension price"], category: ["التصنيفات", "Categories"],
    no: ["لا", "No"], course: ["دورة", "Course"],
    prices: ["الأسعار", "Prices"], addPrice: ["إضافة سعر", "Add price"], noPrices: ["لا توجد خطط أسعار", "No price plans yet"],
    noPricesHint: ["أضف سعرًا للدورة أو اتركها مجانية عمدًا.", "Add a price, or keep the course free on purpose."],
    quality: ["جودة المحتوى", "Content quality"], curSummary: ["ملخص المنهج", "Curriculum at a glance"], timeline: ["النشاط", "Activity"],
    tlCreated: ["أُنشئت الدورة", "Course created"], tlUpdated: ["آخر تعديل", "Last edit"], tlPublished: ["منشورة في الكتالوج", "Live in the catalog"], tlDraft: ["غير منشورة", "Not published"],
    dupIssue: ["درس مكرر", "Duplicate lesson"], testIssue: ["عنوان يبدو تجريبيًا", "Title looks like test text"],
    priceIssue: ["السعر $0.00 رغم وجود طلبات مدفوعة", "Price is $0.00 despite paid orders"], shortIssue: ["الوصف المختصر فارغ", "Short description is empty"],
    allGood: ["لا توجد مشاكل في المنهج", "No curriculum problems"], fix: ["إصلاح", "Fix"], review: ["مراجعة", "Review"],
    completeness: ["اكتمال الدورة", "Course completeness"], status: ["الحالة", "Status"], visibility: ["الظهور", "Visibility"],
    cDesc: ["وصف الدورة", "Description"], cCover: ["صورة الغلاف", "Cover image"], cInstr: ["مدرب واحد على الأقل", "At least one instructor"],
    cCur: ["منهج بدروس", "Curriculum with lessons"], cPrice: ["سعر محدد", "Price set"], cShort: ["وصف مختصر", "Short description"], cAccess: ["مدة الوصول", "Access duration"],
    facts: ["معلومات سريعة", "Quick facts"], audience: ["الجمهور", "Audience"],
    expandAll: ["توسيع الكل", "Expand all"], collapseAll: ["طي الكل", "Collapse all"], addSection: ["إضافة قسم", "Add section"], addLesson: ["إضافة درس", "Add lesson"],
    searchLessons: ["ابحث في الدروس…", "Search lessons…"], allSections: ["كل الأقسام", "All sections"], noMatch: ["لا توجد دروس مطابقة", "No matching lessons"],
    moveUp: ["نقل للأعلى", "Move up"], moveDown: ["نقل للأسفل", "Move down"], del: ["حذف", "Delete"], rename: ["إعادة تسمية", "Rename"],
    listView: ["عرض قائمة", "List view"], gridView: ["عرض شبكة", "Grid view"], dragHint: ["اسحب لإعادة الترتيب", "Drag to reorder"],
    video: ["فيديو", "Video"], quiz: ["اختبار", "Quiz"], assignment: ["واجب", "Assignment"], live: ["مباشر", "Live"],
    description: ["الوصف", "Description"], descCleaned: ["تم تنظيف وسوم HTML من الوصف للعرض", "HTML tags were stripped from the description for display"],
    descRaw: ["القيمة المخزنة", "Stored value"], descFix: ["حفظ كنص نظيف", "Save as clean text"], descSaved: ["تم حفظ الوصف كنص نظيف", "Description saved as clean text"],
    media: ["الوسائط", "Media"], attachments: ["المرفقات", "Attachments"], upload: ["رفع ملف", "Upload a file"], legacySys: ["النظام القديم", "Legacy system"],
    legacyId: ["المعرّف القديم", "Legacy ID"], newInstr: ["إضافة مدرب", "Add instructor"], remove: ["إزالة", "Remove"], profile: ["عرض الملف", "View profile"],
    courses: ["دورات", "courses"], relatedCourses: ["دورات ومسارات مرتبطة", "Related courses & paths"], addRelated: ["إضافة دورة مرتبطة", "Add related course"],
    migrated: ["تم النقل", "Migrated"], pending: ["بانتظار النقل", "Pending"], migrate: ["نقل", "Migrate"], migrateAll: ["نقل الكل", "Migrate all"],
    item: ["العنصر", "Item"], cancel: ["إلغاء", "Cancel"], confirm: ["تأكيد", "Confirm"], save: ["حفظ", "Save"], undo: ["تراجع", "Undo"],
    pubTitle: ["نشر الدورة؟", "Publish course?"], unpubTitle: ["إلغاء نشر الدورة؟", "Unpublish course?"],
    pubBody: ["ستظهر الدورة في الكتالوج ويمكن شراؤها فورًا.", "The course will appear in the catalog and can be bought right away."],
    unpubBody: ["ستختفي الدورة من الكتالوج. الطلاب الحاليون يحتفظون بالوصول.", "The course disappears from the catalog. Current students keep access."],
    toastPub: ["تم نشر الدورة", "Course published"], toastUnpub: ["تم إلغاء النشر", "Course unpublished"],
    sectionName: ["اسم القسم", "Section name"], lessonName: ["عنوان الدرس", "Lesson title"], newSection: ["قسم جديد", "New section"], newLesson: ["درس جديد", "New lesson"],
    pickSection: ["القسم", "Section"], toastDone: ["تم", "Done"], deleted: ["تم حذف الدرس", "Lesson deleted"],
    cmdHint: ["انتقل إلى…", "Jump to…"], theme: ["تبديل السمة", "Toggle theme"], language: ["تغيير اللغة", "Switch language"],
    notImpl: ["هذه نسخة تجريبية", "This is a demo"], sameAs: ["نفس المنهج", "Same"], hours: ["س", "h"],
    cohort: ["عميل", "Customer"], more: ["المزيد", "More"], openedLegacy: ["فتح في النظام القديم", "Open in legacy"],
  };

  /* ---------- Icons ---------- */
  const P = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12l2-8H6.2"/>',
    book: '<path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7"/><path d="M18 14a6 6 0 013.5 6"/>',
    megaphone: '<path d="M3 10v4a1 1 0 001 1h3l8 5V4L7 9H4a1 1 0 00-1 1z"/><path d="M19 9a3 3 0 010 6"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    building: '<path d="M4 21V5l8-3v19"/><path d="M12 8l8 3v10"/><path d="M2 21h20"/><path d="M8 9h0M8 13h0M8 17h0M16 14h0M16 18h0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 010 18a14 14 0 010-18z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l5 5L20 7"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5"/><path d="M12 17h0"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11h6M9 15h4"/>',
    live: '<circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6 6 0 000 9M16.5 7.5a6 6 0 010 9M4.5 4.5a10 10 0 000 15M19.5 4.5a10 10 0 010 15"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h0"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>', chevronEnd: '<path d="M9 6l6 6-6 6"/>', arrowBack: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
    upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M4 3h16"/>', refresh: '<path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h0M3 12h0M3 18h0"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    forum: '<path d="M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z"/>', tag: '<path d="M20.6 13.4L13.4 20.6a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  };
  const ic = (n, cls = "") => `<svg class="cd-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.file}</svg>`;
  const LTYPE = { video: ["video", "sky"], quiz: ["quiz", "yellow"], assignment: ["clipboard", "lilac"], live: ["live", "pink"] };

  /* ---------- Shell ---------- */
  function renderShell() {
    const rail = [["home", "الرئيسية", "Home", 1], ["cart", "المبيعات", "Sales"], ["book", "التعلم", "Learning"], ["users", "العملاء", "Customers"], ["megaphone", "التسويق", "Marketing"], ["chart", "التقارير", "Reports"], ["sliders", "الإعدادات", "Settings"], ["building", "الشركات", "Companies", 0, 1]];
    $("#cd-rail").innerHTML = `<a class="cd-rail__logo" href="#/overview" aria-label="Mastery"><svg viewBox="0 0 40 40"><path d="M3 30l8-20 8 14 6-14 12 20-5 0-7-11-6 14-8-14-4 11z"/></svg></a>` +
      rail.map(([i, ar, en, a, d]) => `<a class="cd-rail__item ${a ? "is-active" : ""} ${d ? "is-disabled" : ""}" href="#/overview">${ic(i)}<span>${S.lang === "ar" ? ar : en}</span></a>`).join("");
    $("#cd-top").innerHTML = `<button class="cd-search" data-act="palette" aria-keyshortcuts="Control+K">${ic("search", "cd-ic--sm")}<span>${t("search")}</span><span class="cd-kbd cd-ltr">Ctrl K</span></button>
      <span class="cd-top__sp"></span>
      <button class="cd-iconbtn" data-act="theme" aria-label="${t("theme")}" title="${t("theme")}">${ic(S.theme === "dark" ? "sun" : "moon")}</button>
      <button class="cd-iconbtn" data-act="lang" aria-label="${t("language")}" title="${t("language")}">${ic("globe")}</button>
      <span class="cd-user cd-ltr" aria-hidden="true">AD</span>`;
  }

  /* ---------- Page chrome ---------- */
  function header() {
    const n = allLessons().length;
    return `<section class="cd-head">
      <a class="cd-crumb" href="#/overview" data-act="toast" data-msg="notImpl">${t("catalog")} <span class="cd-flip">${ic("arrowBack", "cd-ic--sm")}</span></a>
      <div class="cd-head__row">
        <div class="cd-title">
          <div class="cd-title__line"><h1>${esc(L(C.title))} <span class="cd-muted cd-ltr" style="font-weight:500">${esc(C.title.en === L(C.title) ? "" : C.title.en)}</span></h1>
            <span class="cd-chip ${S.published ? "cd-chip--ok" : "cd-chip--off"}">${t(S.published ? "published" : "draft")}</span><span class="cd-chip cd-chip--b2c">${C.audience}</span></div>
          <p class="cd-title__sub">${esc(L(C.category))} · ${t("course")}</p>
        </div>
        <div class="cd-actions">
          <button class="ma-btn ma-btn--soft" data-act="toast" data-msg="openCatalog">${ic("link")}${t("openCatalog")}</button>
          <button class="ma-btn ma-btn--secondary" data-act="toast" data-msg="notImpl">${ic("edit")}${t("openStudio")}</button>
          <button class="ma-btn ${S.published ? "ma-btn--danger-soft" : "ma-btn--primary"}" data-act="publish">${ic(S.published ? "x" : "check")}${t(S.published ? "unpublish" : "publish")}</button>
        </div>
      </div>
      <div class="cd-kpis" role="list">
        <div class="cd-kpi" role="listitem"><span class="cd-kpi__l">${ic("tag", "cd-ic--sm")}${t("price")}</span><span class="cd-kpi__v">${C.price ? money(C.price) : "$0.00"}</span><span class="cd-kpi__m">${C.price ? "" : t("free")}</span></div>
        <div class="cd-kpi" role="listitem"><span class="cd-kpi__l">${ic("cart", "cd-ic--sm")}${t("paidOrders")}</span><span class="cd-kpi__v">${C.paidOrders}</span><span class="cd-kpi__m">&nbsp;</span></div>
        <div class="cd-kpi" role="listitem"><span class="cd-kpi__l">${ic("layers", "cd-ic--sm")}${t("curriculum")}</span><span class="cd-kpi__v">${C.sections.length} / ${n}</span><span class="cd-kpi__m">${t("sections")} / ${t("lessons")}</span></div>
        <div class="cd-kpi" role="listitem"><span class="cd-kpi__l">${ic("clock", "cd-ic--sm")}${t("duration")}</span><span class="cd-kpi__v">${longDur(totalSec())}</span><span class="cd-kpi__m">${n} ${t("lessons")}</span></div>
        <div class="cd-kpi" role="listitem"><span class="cd-kpi__l">${ic("calendar", "cd-ic--sm")}${t("updated")}</span><span class="cd-kpi__v" style="font-size:20px">${fdate(C.updated)}</span><span class="cd-kpi__m">${t("created")} ${fdate(C.created)}</span></div>
      </div></section>`;
  }
  function tabbar() {
    const counts = { content: allLessons().length, instructors: C.instructors.length, related: C.related.length, legacy: C.legacy.filter((x) => !x.migrated).length };
    return `<div class="cd-tabbar" id="cd-tabbar"><div class="cd-tabs" role="tablist" aria-label="${esc(L(C.title))}">
      ${TABS.map((k) => `<a class="cd-tab" role="tab" id="tab-${k}" href="#/${k}" aria-selected="${k === S.tab}" tabindex="${k === S.tab ? 0 : -1}">${t("tab." + k)}${counts[k] ? `<span class="cd-tab__n">${counts[k]}</span>` : ""}</a>`).join("")}</div>
      <div class="cd-mini"><span class="cd-mini__t">${esc(L(C.title))}</span><button class="ma-btn ma-btn--sm ma-btn--soft" data-act="publish">${t(S.published ? "unpublish" : "publish")}</button></div></div>`;
  }

  /* ---------- Aside (shown beside every tab except resources/legacy which are wide) ---------- */
  function checklist() {
    const items = [
      [t("cDesc"), !!cleanDesc(C.descriptionRaw)], [t("cCover"), C.media.some((m) => m.kind === "cover")], [t("cInstr"), C.instructors.length > 0],
      [t("cCur"), allLessons().length > 0], [t("cPrice"), C.price > 0], [t("cShort"), !!C.shortDesc], [t("cAccess"), !!C.accessDays],
    ];
    const pct = Math.round((items.filter((i) => i[1]).length / items.length) * 100);
    return { items, pct };
  }
  function aside() {
    const { items, pct } = checklist();
    const ins = C.instructors[0];
    return `<aside class="cd-aside" aria-label="${t("facts")}">
      <div class="cd-card"><div class="cd-cover"><span class="cd-cover__big">CB</span><span class="ma-tag ma-tag--ink">${t("course")}</span><span class="ma-tag ma-tag--soft" style="background:var(--ink);color:#fff">${C.audience}</span></div>
        <div class="cd-card__b"><dl class="cd-dl">
          <div><dt>${t("status")}</dt><dd><span class="cd-chip ${S.published ? "cd-chip--ok" : "cd-chip--off"}">${t(S.published ? "published" : "draft")}</span></dd></div>
          <div><dt>${t("id")}</dt><dd class="cd-ltr">${C.id}</dd></div>
          <div><dt>${t("audience")}</dt><dd>${C.audience}</dd></div>
          <div><dt>${t("category")}</dt><dd>${esc(L(C.category))}</dd></div></dl>
          ${ins ? `<div class="cd-person"><span class="cd-avatar" style="--c:var(--${ins.color})">${esc(L(ins.name)[0])}</span><div><b>${esc(L(ins.name))}</b><small>${esc(L(ins.role))}</small></div></div>` : ""}
        </div></div>
      <div class="cd-card"><div class="cd-card__h"><h3>${t("completeness")}</h3><span class="cd-ring" style="--p:${pct}"><span>${pct}%</span></span></div>
        <div class="cd-card__b"><ul class="cd-check">${items.map(([l, ok]) => `<li class="${ok ? "" : "is-todo"}"><span class="cd-check__box">${ic("check", "cd-ic--sm")}</span>${l}${ok ? "" : `<button class="cd-link" data-act="toast" data-msg="notImpl">${t("set")}</button>`}</li>`).join("")}</ul></div></div>
    </aside>`;
  }

  /* ---------- Tabs ---------- */
  const unset = () => `<span class="cd-unset">${t("notSet")}</span>`;
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;

  function overview() {
    const issues = curriculumIssues();
    const max = Math.max(...C.sections.map(secSec));
    const extra = [];
    if (C.price === 0 && C.paidOrders > 0) extra.push(["bad", "tag", t("priceIssue"), ""]);
    if (!C.shortDesc) extra.push(["warn", "info", t("shortIssue"), ""]);
    const items = issues.map(({ k, l }) => ["warn", k === "dup" ? "layers" : "alert", t(k === "dup" ? "dupIssue" : "testIssue"), L(l.title), l.id]);
    const all = [...extra.map((e) => [e[0], e[1], e[2], e[3], null]), ...items];
    return `<div class="cd-bento">
      <section class="cd-card cd-s6"><div class="cd-card__h"><h2>${ic("info")}${t("productDetails")}</h2><button class="ma-btn ma-btn--sm ma-btn--soft" data-act="toast" data-msg="notImpl">${ic("edit", "cd-ic--sm")}${t("edit")}</button></div>
        <div class="cd-card__b"><dl class="cd-dl">
          ${row(t("type"), t("course"))}${row(t("id"), `<span class="cd-ltr">${C.id}</span>`)}${row(t("trainer"), esc(L(C.instructors[0].name)))}
          ${row(t("price"), money(C.price) + ` <span class="cd-chip cd-chip--warn cd-chip--plain" style="height:22px;font-size:12px">${t("free")}</span>`)}
          ${row(t("comparePrice"), unset())}${row(t("paidOrders"), C.paidOrders)}${row(t("created"), fdate(C.created, true))}${row(t("updated"), fdate(C.updated, true))}
        </dl></div></section>
      <section class="cd-card cd-s6"><div class="cd-card__h"><h2>${ic("sliders")}${t("accessCats")}</h2></div>
        <div class="cd-card__b"><dl class="cd-dl">
          ${row(t("shortDesc"), unset() + `<button class="cd-link" data-act="toast" data-msg="notImpl">${t("add")}</button>`)}
          ${row(t("accessDays"), unset())}${row(t("extension"), t("no"))}${row(t("extPrice"), unset())}
          ${row(t("category"), `<span class="ma-tag ma-tag--soft">${esc(L(C.category))}</span>`)}
        </dl></div></section>
      <section class="cd-card cd-s5"><div class="cd-card__h"><h2>${ic("clock")}${t("timeline")}</h2></div>
        <div class="cd-card__b"><ul class="cd-tl">
          <li><span class="cd-tl__dot" style="--c:var(--sky)"></span><div>${t("tlCreated")}<small>${fdate(C.created, true)}</small></div></li>
          <li><span class="cd-tl__dot" style="--c:var(--yellow)"></span><div>${t("tlUpdated")}<small>${fdate(C.updated, true)}</small></div></li>
          <li><span class="cd-tl__dot" style="--c:var(${S.published ? "--green" : "--pink"})"></span><div>${t(S.published ? "tlPublished" : "tlDraft")}<small>${C.audience}</small></div></li></ul></div></section>
      <section class="cd-card cd-s7"><div class="cd-card__h"><h2>${ic("layers")}${t("curSummary")}</h2><a class="cd-link" href="#/content">${t("tab.content")}</a></div>
        <div class="cd-card__b"><div class="cd-bars">${C.sections.map((s) => `<div class="cd-bar"><span class="cd-bar__t">${esc(L(s.title))}</span><span class="cd-bar__track"><span class="cd-bar__fill" style="width:${Math.round((secSec(s) / max) * 100)}%"></span></span><span class="cd-bar__v">${s.lessons.length} ${t("lessons")} · ${longDur(secSec(s))}</span></div>`).join("")}</div></div></section>
      <section class="cd-card cd-s5"><div class="cd-card__h"><h2>${ic("alert")}${t("quality")}</h2><span class="cd-chip cd-chip--warn cd-chip--plain cd-num">${all.length}</span></div>
        <div class="cd-card__b">${all.length ? all.slice(0, 5).map(([sev, i, title, sub, id]) => `<div class="cd-issue ${sev === "bad" ? "cd-issue--bad" : ""}"><span class="cd-issue__ic">${ic(i, "cd-ic--sm")}</span><div class="cd-issue__t">${title}${sub ? `<small>${esc(sub)}</small>` : ""}</div><button class="ma-btn ma-btn--sm ma-btn--soft" ${id ? `data-act="goto-lesson" data-id="${id}"` : `data-act="toast" data-msg="notImpl"`}>${t("review")}</button></div>`).join("") : `<div class="cd-issue cd-issue--ok"><span class="cd-issue__ic">${ic("check", "cd-ic--sm")}</span><div class="cd-issue__t">${t("allGood")}</div></div>`}</div></section>
      <section class="cd-card cd-s7"><div class="cd-card__h"><h2>${ic("tag")}${t("prices")}</h2><button class="ma-btn ma-btn--sm ma-btn--primary" data-act="toast" data-msg="notImpl">${ic("plus", "cd-ic--sm")}${t("addPrice")}</button></div>
        <div class="cd-card__b"><div class="cd-empty">${ic("tag")}<strong>${t("noPrices")}</strong><span>${t("noPricesHint")}</span></div></div></section>
    </div>`;
  }

  /* Course content: outline + lessons */
  function lessonHTML(l, si, li) {
    const [icon, color] = LTYPE[l.type] || LTYPE.video;
    const flags = issuesOf(l).map((k) => `<span class="cd-flag ${k === "dup" ? "cd-flag--dup" : ""}">${ic("alert", "cd-ic--sm")}${t(k === "dup" ? "dupIssue" : "testIssue")}</span>`).join("");
    const title = S.editing === l.id
      ? `<input class="cd-input cd-rename" data-rename="${l.id}" value="${esc(L(l.title))}" aria-label="${t("rename")}">`
      : `<div class="cd-lesson__t">${esc(L(l.title))}</div>`;
    return `<li class="cd-lesson" draggable="${S.view === "list"}" data-lesson="${l.id}" id="les-${l.id}">
      ${S.view === "list" ? `<span class="cd-lesson__grip" title="${t("dragHint")}">${ic("grip")}</span>` : ""}
      <span class="cd-lesson__ic" style="--c:var(--${color})">${ic(icon)}</span>
      <div class="cd-lesson__body">${title}<div class="cd-lesson__m"><span class="cd-lesson__dur">${ic("clock", "cd-ic--sm")}${dur(l.sec)}</span><span>${t(l.type)}</span>${flags}</div></div>
      <div class="cd-lesson__tools">
        <button class="cd-iconbtn" data-act="rename" data-id="${l.id}" aria-label="${t("rename")}" title="${t("rename")}">${ic("edit", "cd-ic--sm")}</button>
        <button class="cd-iconbtn" data-act="move" data-dir="-1" data-id="${l.id}" aria-label="${t("moveUp")}" title="${t("moveUp")}" ${li === 0 ? "disabled" : ""}>${ic("up", "cd-ic--sm")}</button>
        <button class="cd-iconbtn" data-act="move" data-dir="1" data-id="${l.id}" aria-label="${t("moveDown")}" title="${t("moveDown")}" ${false ? "disabled" : ""}>${ic("down", "cd-ic--sm")}</button>
        <button class="cd-iconbtn" data-act="del" data-id="${l.id}" aria-label="${t("del")}" title="${t("del")}">${ic("trash", "cd-ic--sm")}</button>
      </div></li>`;
  }
  function lessonsPane() {
    const q = S.q.trim().toLowerCase();
    const secs = C.sections.map((s, si) => ({ s, si })).filter(({ s }) => S.sec === "all" || S.sec === s.id);
    const html = secs.map(({ s, si }) => {
      const ls = s.lessons.map((l, li) => ({ l, li })).filter(({ l }) => !q || L(l.title).toLowerCase().includes(q));
      if (q && !ls.length) return "";
      const open = !S.collapsed[s.id];
      return `<section class="cd-sec" data-sec="${s.id}"><div class="cd-sec__h"><span class="cd-sec__n">${si + 1}</span><h3>${esc(L(s.title))}</h3>
        <span class="cd-muted cd-num" style="font-size:13px">${s.lessons.length} ${t("lessons")} · ${longDur(secSec(s))}</span>
        <div class="cd-sec__tools"><button class="ma-btn ma-btn--sm ma-btn--soft" data-act="add-lesson" data-id="${s.id}">${ic("plus", "cd-ic--sm")}${t("addLesson")}</button>
        <button class="cd-iconbtn" data-act="toggle-sec" data-id="${s.id}" aria-expanded="${open}" aria-label="${open ? t("collapseAll") : t("expandAll")}"><span style="display:grid;transform:rotate(${open ? 180 : 0}deg)">${ic("chevron")}</span></button></div></div>
        ${open ? `<ul class="cd-lessons ${S.view === "grid" ? "cd-lessons--grid" : ""}" data-list="${s.id}">${ls.map(({ l, li }) => lessonHTML(l, si, li)).join("")}</ul>` : ""}</section>`;
    }).join("");
    return html || `<div class="cd-empty">${ic("search")}<strong>${t("noMatch")}</strong></div>`;
  }
  function content() {
    const n = allLessons().length;
    return `<div class="cd-studio">
      <nav class="cd-card cd-outline" aria-label="${t("curriculum")}"><div class="cd-card__b" style="padding:12px;gap:2px">
        <button data-act="pick-sec" data-id="all" aria-current="${S.sec === "all"}"><span class="cd-outline__n">${ic("layers", "cd-ic--sm")}</span><span class="cd-outline__t"><span>${t("allSections")}</span><small>${n} ${t("lessons")} · ${longDur(totalSec())}</small></span></button>
        ${C.sections.map((s, i) => `<button data-act="pick-sec" data-id="${s.id}" aria-current="${S.sec === s.id}"><span class="cd-outline__n">${i + 1}</span><span class="cd-outline__t"><span>${esc(L(s.title))}</span><small>${s.lessons.length} ${t("lessons")} · ${longDur(secSec(s))}</small></span></button>`).join("")}
        <button class="ma-btn ma-btn--soft ma-btn--sm" style="margin-block-start:8px;justify-content:center" data-act="add-section">${ic("plus", "cd-ic--sm")}${t("addSection")}</button></div></nav>
      <div class="cd-page">
        <div class="cd-card"><div class="cd-toolbar">
          <input class="cd-input" id="cd-q" type="search" placeholder="${t("searchLessons")}" value="${esc(S.q)}" aria-label="${t("searchLessons")}">
          <button class="ma-btn ma-btn--sm ma-btn--soft" data-act="expand" data-v="1">${t("expandAll")}</button>
          <button class="ma-btn ma-btn--sm ma-btn--soft" data-act="expand" data-v="0">${t("collapseAll")}</button>
          <div class="cd-seg" role="group"><button data-act="view" data-v="list" aria-pressed="${S.view === "list"}" aria-label="${t("listView")}" title="${t("listView")}">${ic("list", "cd-ic--sm")}</button><button data-act="view" data-v="grid" aria-pressed="${S.view === "grid"}" aria-label="${t("gridView")}" title="${t("gridView")}">${ic("grid", "cd-ic--sm")}</button></div></div></div>
        <div class="cd-page" id="cd-lessons">${lessonsPane()}</div></div></div>`;
  }

  function resources() {
    const raw = C.descriptionRaw, clean = cleanDesc(raw);
    const hasHtml = raw !== clean;
    return `<div class="cd-bento">
      <section class="cd-card cd-s7"><div class="cd-card__h"><h2>${ic("file")}${t("description")}</h2><button class="ma-btn ma-btn--sm ma-btn--soft" data-act="toast" data-msg="notImpl">${ic("edit", "cd-ic--sm")}${t("edit")}</button></div>
        <div class="cd-card__b"><p class="cd-richtext">${esc(clean)}</p>
          ${hasHtml && !S.descFixed ? `<div class="ma-alert ma-alert--warning">${ic("alert")}<div><p class="ma-alert__title">${t("descCleaned")}</p><div class="cd-code" style="margin-block-start:8px;background:rgba(0,0,0,.08)">${esc(raw)}</div></div></div>
          <div><button class="ma-btn ma-btn--sm ma-btn--primary" data-act="fix-desc">${ic("check", "cd-ic--sm")}${t("descFix")}</button></div>` : ""}</div></section>
      <section class="cd-card cd-s5"><div class="cd-card__h"><h2>${ic("link")}${t("legacySys")}</h2></div>
        <div class="cd-card__b"><dl class="cd-dl">${row(t("legacyId"), `<span class="cd-ltr">${C.legacyId}</span>`)}${row(t("type"), `<span class="cd-ltr">${C.type}</span>`)}${row(t("id"), `<span class="cd-ltr">${C.id}</span>`)}</dl>
          <button class="ma-btn ma-btn--soft" data-act="toast" data-msg="openedLegacy">${ic("link")}${t("openedLegacy")}</button></div></section>
      <section class="cd-card cd-s7"><div class="cd-card__h"><h2>${ic("image")}${t("media")}</h2><span class="cd-chip cd-chip--plain cd-num">${C.media.length}</span></div>
        <div class="cd-card__b"><div class="cd-gallery">${C.media.map((m) => `<div class="cd-tile"><div class="cd-tile__m" style="--c:var(--${m.color})">${m.kind === "cover" ? `<span class="ma-tag ma-tag--ink">${t("cCover")}</span>` : ""}${ic("image")}</div><div class="cd-tile__f"><span>${esc(L(m.name))}</span><span class="cd-muted cd-ltr">${m.meta}</span></div></div>`).join("")}</div>
          <button class="cd-drop" data-act="toast" data-msg="notImpl">${ic("upload")}${t("upload")}</button></div></section>
      <section class="cd-card cd-s5"><div class="cd-card__h"><h2>${ic("file")}${t("attachments")}</h2><span class="cd-chip cd-chip--plain cd-num">${C.files.length}</span></div>
        <div class="cd-card__b"><div class="cd-files">${C.files.map((f) => `<div class="cd-file">${ic("file")}<span class="cd-file__t">${f.name}</span><span class="cd-muted cd-ltr" style="font-size:12px">${f.size}</span></div>`).join("")}</div>
          <button class="cd-drop" data-act="toast" data-msg="notImpl">${ic("upload")}${t("upload")}</button></div></section>
    </div>`;
  }

  function instructors() {
    return `<div class="cd-cards">${C.instructors.map((i) => `<div class="cd-card cd-pcard"><span class="cd-avatar cd-avatar--xl" style="--c:var(--${i.color})">${esc(L(i.name)[0])}</span><h3>${esc(L(i.name))}</h3><span class="cd-muted">${esc(L(i.role))}</span>
        <div class="cd-mini-stats"><span>${i.courses} ${t("courses")}</span></div>
        <div class="cd-actions"><button class="ma-btn ma-btn--sm ma-btn--soft" data-act="toast" data-msg="notImpl">${ic("user", "cd-ic--sm")}${t("profile")}</button><button class="ma-btn ma-btn--sm ma-btn--danger-soft" data-act="rm-instr" data-id="${i.id}">${ic("x", "cd-ic--sm")}${t("remove")}</button></div></div>`).join("")}
      <button class="cd-addtile" data-act="add-instr">${ic("plus")}<strong>${t("newInstr")}</strong></button></div>`;
  }

  function related() {
    return `<div class="cd-cards">${C.related.map((r) => `<div class="ma-card"><div class="ma-card__media" style="background:var(--${r.color})"><span class="ma-tag ma-tag--ink">${t(r.kind === "course" ? "course" : "course")}${r.kind === "diploma" ? " +" : ""}</span></div>
        <div class="ma-card__body"><h3 class="ma-card__title">${esc(L(r.title))}</h3><div class="ma-card__meta"><span>${ic("layers", "cd-ic--sm")}${r.lessons} ${t("lessons")}</span><span>${ic("tag", "cd-ic--sm")}${money(r.price)}</span></div></div>
        <div class="ma-card__foot"><button class="ma-btn ma-btn--sm ma-btn--soft" data-act="toast" data-msg="notImpl">${t("review")}</button><button class="ma-btn ma-btn--sm ma-btn--danger-soft" data-act="toast" data-msg="toastDone">${t("remove")}</button></div></div>`).join("")}
      <button class="cd-addtile" data-act="toast" data-msg="notImpl">${ic("plus")}<strong>${t("addRelated")}</strong></button></div>`;
  }

  function legacy() {
    return `<section class="cd-card"><div class="cd-card__h"><h2>${ic("refresh")}${t("tab.legacy")}</h2><button class="ma-btn ma-btn--sm ma-btn--primary" data-act="migrate" data-id="all">${t("migrateAll")}</button></div>
      <div class="cd-card__b cd-card__b--flush"><div class="cd-tablewrap"><table class="cd-table"><thead><tr><th>${t("legacyId")}</th><th>${t("item")}</th><th>${t("type")}</th><th>${t("status")}</th><th></th></tr></thead><tbody>
      ${C.legacy.map((g) => `<tr><td class="cd-ltr cd-num">${g.legacyId}</td><td>${esc(L(g.name))}</td><td><span class="ma-tag ma-tag--soft cd-ltr">${g.kind}</span></td>
        <td><span class="cd-chip ${g.migrated ? "cd-chip--ok" : "cd-chip--warn"}">${t(g.migrated ? "migrated" : "pending")}</span></td>
        <td style="text-align:end">${g.migrated ? "" : `<button class="ma-btn ma-btn--sm ma-btn--soft" data-act="migrate" data-id="${g.id}">${t("migrate")}</button>`}</td></tr>`).join("")}
      </tbody></table></div></div></section>`;
  }

  /* ---------- Render ---------- */
  function render() {
    document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === "ar" ? "rtl" : "ltr"; document.documentElement.dataset.theme = S.theme;
    document.title = L(C.title) + " · " + t("tab." + S.tab);
    renderShell();
    const pages = { overview, content, resources, instructors, related, legacy };
    const showAside = S.tab !== "legacy";
    $("#cd-content").innerHTML = header() + tabbar() + `<div class="cd-body ${showAside ? "" : "cd-body--wide"}"><div class="cd-page" role="tabpanel" aria-labelledby="tab-${S.tab}">${pages[S.tab]()}</div>${showAside ? aside() : ""}</div>`;
    onScroll();
  }
  const rerenderLessons = () => { const el = $("#cd-lessons"); if (el) el.innerHTML = lessonsPane(); };

  /* ---------- Toast / modal ---------- */
  function toast(msg, undo) {
    const el = document.createElement("div"); el.className = "cd-toast"; el.setAttribute("role", "status");
    el.innerHTML = `<span>${esc(msg)}</span>` + (undo ? `<button>${t("undo")}</button>` : "");
    if (undo) el.querySelector("button").onclick = () => { undo(); el.remove(); };
    $("#cd-toasts").appendChild(el); setTimeout(() => el.remove(), 4500);
  }
  function modal({ title, body, confirm, onConfirm, noConfirm }) {
    const m = $("#cd-modal");
    m.innerHTML = `<form method="dialog"><h2 class="cd-modal__h">${title}</h2><div class="cd-modal__b">${body}</div>
      <div class="cd-modal__f"><button class="ma-btn ma-btn--soft" value="cancel" formnovalidate>${t("cancel")}</button>${noConfirm ? "" : `<button class="ma-btn ma-btn--primary" value="ok">${confirm || t("confirm")}</button>`}</div></form>`;
    m.onclose = () => { if (m.returnValue === "ok" && onConfirm) onConfirm(m); m.returnValue = ""; };
    m.showModal();
    const f = m.querySelector("input,button.cd-pal-first"); if (f) f.focus();
  }
  function inputModal(title, label, value, cb) {
    modal({ title, body: `<label class="ma-label" style="color:var(--text)">${label}<input class="ma-input" name="v" value="${esc(value)}" required style="margin-block-start:8px"></label>`, confirm: t("save"),
      onConfirm: (m) => { const v = m.querySelector("input[name=v]").value.trim(); if (v) cb(v); } });
  }
  function palette() {
    const cmds = [...TABS.map((k) => ({ l: t("tab." + k), f: () => (location.hash = "#/" + k), i: "chevronEnd" })),
      { l: t(S.published ? "unpublish" : "publish"), f: () => act("publish"), i: S.published ? "x" : "check" }, { l: t("addLesson"), f: () => { location.hash = "#/content"; setTimeout(() => act("add-lesson", { id: C.sections[0].id }), 0); }, i: "plus" },
      { l: t("theme"), f: () => act("theme"), i: "sun" }, { l: t("language"), f: () => act("lang"), i: "globe" }];
    modal({ title: t("cmdHint"), noConfirm: true, body: `<input class="ma-input" id="cd-pq" placeholder="${t("search")}"><div class="cd-pal" id="cd-pal"></div>` });
    const list = $("#cd-pal"), inp = $("#cd-pq");
    const draw = () => { list.innerHTML = ""; cmds.filter((c) => c.l.toLowerCase().includes(inp.value.toLowerCase())).forEach((c) => { const b = document.createElement("button"); b.type = "button"; b.innerHTML = ic(c.i, "cd-ic--sm") + esc(c.l); b.onclick = () => { $("#cd-modal").close(); c.f(); }; list.appendChild(b); }); };
    inp.oninput = draw; draw(); inp.focus();
    inp.onkeydown = (e) => { if (e.key === "Enter") { const b = list.querySelector("button"); if (b) b.click(); } };
  }

  /* ---------- Data helpers ---------- */
  const findLesson = (id) => { for (const s of C.sections) { const i = s.lessons.findIndex((l) => l.id === id); if (i > -1) return { s, i, l: s.lessons[i] }; } return null; };
  let uid = 100;

  /* ---------- Actions ---------- */
  function act(a, d = {}) {
    switch (a) {
      case "theme": S.theme = S.theme === "dark" ? "light" : "dark"; store.set("theme", S.theme); render(); break;
      case "lang": S.lang = S.lang === "ar" ? "en" : "ar"; store.set("lang", S.lang); render(); break;
      case "palette": palette(); break;
      case "toast": toast(t(d.msg || "toastDone")); break;
      case "publish": modal({ title: t(S.published ? "unpubTitle" : "pubTitle"), body: t(S.published ? "unpubBody" : "pubBody"), confirm: t(S.published ? "unpublish" : "publish"),
        onConfirm: () => { S.published = !S.published; render(); toast(t(S.published ? "toastPub" : "toastUnpub")); } }); break;
      case "pick-sec": S.sec = d.id; render(); break;
      case "view": S.view = d.v; render(); break;
      case "expand": C.sections.forEach((s) => (S.collapsed[s.id] = d.v === "0")); render(); break;
      case "toggle-sec": S.collapsed[d.id] = !S.collapsed[d.id]; rerenderLessons(); break;
      case "rename": S.editing = d.id; rerenderLessons(); { const i = $(`[data-rename="${d.id}"]`); if (i) { i.focus(); i.select(); } } break;
      case "move": { const f = findLesson(d.id), dir = +d.dir; if (!f) break; const j = f.i + dir;
        if (j >= 0 && j < f.s.lessons.length) { f.s.lessons.splice(f.i, 1); f.s.lessons.splice(j, 0, f.l); } else {
          const si = C.sections.indexOf(f.s) + dir, tgt = C.sections[si]; if (tgt) { f.s.lessons.splice(f.i, 1); dir < 0 ? tgt.lessons.push(f.l) : tgt.lessons.unshift(f.l); } }
        render(); setTimeout(() => { const b = $(`#les-${d.id} [data-dir="${d.dir}"]`); if (b) b.focus(); }, 0); break; }
      case "del": { const f = findLesson(d.id); if (!f) break; f.s.lessons.splice(f.i, 1); render();
        toast(t("deleted"), () => { f.s.lessons.splice(f.i, 0, f.l); render(); }); break; }
      case "add-lesson": inputModal(t("addLesson"), t("lessonName"), t("newLesson"), (v) => { const s = C.sections.find((x) => x.id === d.id); s.lessons.push({ id: "n" + uid++, title: { ar: v, en: v }, sec: 300, type: "video" }); S.collapsed[s.id] = false; render(); }); break;
      case "add-section": inputModal(t("addSection"), t("sectionName"), t("newSection"), (v) => { C.sections.push({ id: "s" + uid++, title: { ar: v, en: v }, lessons: [] }); render(); }); break;
      case "goto-lesson": location.hash = "#/content"; S.sec = "all"; S.q = ""; render(); setTimeout(() => { const el = $("#les-" + d.id); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("is-over"); setTimeout(() => el.classList.remove("is-over"), 1800); } }, 30); break;
      case "fix-desc": C.descriptionRaw = cleanDesc(C.descriptionRaw); S.descFixed = true; render(); toast(t("descSaved")); break;
      case "rm-instr": C.instructors = C.instructors.filter((i) => i.id !== d.id); render(); toast(t("toastDone")); break;
      case "add-instr": { const avail = C.allInstructors.filter((i) => !C.instructors.some((x) => x.id === i.id));
        modal({ title: t("newInstr"), confirm: t("add"), body: `<div class="cd-pick">${avail.map((i, k) => `<label><input type="radio" name="ins" value="${i.id}" ${k === 0 ? "checked" : ""}><span class="cd-avatar" style="--c:var(--${i.color})">${esc(L(i.name)[0])}</span><span>${esc(L(i.name))}<br><small class="cd-muted">${esc(L(i.role))}</small></span></label>`).join("") || `<p>${t("noMatch")}</p>`}</div>`,
          onConfirm: (m) => { const r = m.querySelector("input[name=ins]:checked"); const p = r && C.allInstructors.find((i) => i.id === r.value); if (p) { C.instructors.push(p); render(); toast(t("toastDone")); } } }); break; }
      case "migrate": C.legacy.forEach((g) => { if (d.id === "all" || g.id === d.id) g.migrated = true; }); render(); toast(t("toastDone")); break;
    }
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (!b) return; if (b.tagName === "A") e.preventDefault(); act(b.dataset.act, b.dataset); });
  document.addEventListener("input", (e) => { if (e.target.id === "cd-q") { S.q = e.target.value; rerenderLessons(); } });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); act("palette"); return; }
    const r = e.target.closest && e.target.closest("[data-rename]");
    if (r && e.key === "Enter") { const f = findLesson(r.dataset.rename); if (f && r.value.trim()) f.l.title = { ar: r.value.trim(), en: r.value.trim() }; S.editing = null; render(); }
    if (r && e.key === "Escape") { S.editing = null; rerenderLessons(); }
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const rtl = S.lang === "ar", step = (e.key === "ArrowRight") === !rtl ? 1 : -1;
      const next = TABS[(TABS.indexOf(S.tab) + step + TABS.length) % TABS.length]; location.hash = "#/" + next;
      setTimeout(() => { const el = $("#tab-" + next); if (el) el.focus(); }, 0);
    }
  });
  document.addEventListener("focusout", (e) => { const r = e.target.closest && e.target.closest("[data-rename]"); if (r && S.editing) { setTimeout(() => { if (S.editing) { S.editing = null; rerenderLessons(); } }, 120); } });

  /* Drag & drop reorder (list view). Keyboard users get the move buttons. */
  document.addEventListener("dragstart", (e) => { const li = e.target.closest && e.target.closest("[data-lesson]"); if (!li) return; S.drag = li.dataset.lesson; li.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", S.drag); });
  document.addEventListener("dragover", (e) => { const li = e.target.closest && e.target.closest("[data-lesson]"); if (!li || !S.drag) return; e.preventDefault(); document.querySelectorAll(".is-over").forEach((x) => x.classList.remove("is-over")); if (li.dataset.lesson !== S.drag) li.classList.add("is-over"); });
  document.addEventListener("dragend", () => { S.drag = null; document.querySelectorAll(".is-drag,.is-over").forEach((x) => x.classList.remove("is-drag", "is-over")); });
  document.addEventListener("drop", (e) => {
    const li = e.target.closest && e.target.closest("[data-lesson]"); if (!li || !S.drag || li.dataset.lesson === S.drag) return; e.preventDefault();
    const from = findLesson(S.drag), to = findLesson(li.dataset.lesson); if (!from || !to) return;
    from.s.lessons.splice(from.i, 1); const idx = to.s.lessons.indexOf(to.l); to.s.lessons.splice(idx, 0, from.l); S.drag = null; render();
  });

  function onScroll() { const bar = $("#cd-tabbar"); if (bar) bar.classList.toggle("is-stuck", window.scrollY > 190); }
  window.addEventListener("scroll", onScroll, { passive: true });
  function route() { const k = (location.hash.replace("#/", "") || "overview"); S.tab = TABS.includes(k) ? k : "overview"; render(); }
  window.addEventListener("hashchange", () => { route(); window.scrollTo({ top: Math.min(window.scrollY, 180) }); });
  route();
})();
