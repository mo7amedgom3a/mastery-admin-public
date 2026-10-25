/* Mock data for the course-details demo. Bilingual values are { ar, en }. Durations are in seconds. */
window.COURSE = {
  id: "course-10",
  legacyId: 10,
  type: "course",
  audience: "B2C",
  status: "published",
  price: 0,
  comparePrice: null,
  paidOrders: 2,
  extension: { enabled: false, price: null },
  accessDays: null,
  shortDesc: "",
  created: "2026-09-22T07:30:00",
  updated: "2026-10-04T09:59:00",
  title: { ar: "سلوك المستهلك", en: "Consumer Behavior" },
  category: { ar: "التسويق المتكامل", en: "Integrated marketing" },
  // Exactly what the old page printed: a raw HTML string stored in the description field.
  descriptionRaw: "<p>كيف ترى الفرص التسويقية بين تصرفات العميل وسلوكه ومشاعره .. سيكولوجية التسويق</p>",
  instructors: [
    { id: "i1", name: { ar: "ثابت حجازي", en: "Thabet Hijazi" }, role: { ar: "مدرب رئيسي", en: "Lead instructor" }, courses: 4, color: "coral" },
  ],
  sections: [
    { id: "s1", title: { ar: "سلوك المستهلك", en: "Consumer behavior" }, lessons: [
      { id: "l1", title: { ar: "jhbjkh مقدمة سلوك المستهلك", en: "jhbjkh Introduction to consumer behavior" }, sec: 259, type: "video" },
      { id: "l2", title: { ar: "درس تجربة الموداد والتوست", en: "Modad & toast experiment" }, sec: 930, type: "video" },
      { id: "l3", title: { ar: "درس تجربة الموداد والتوست", en: "Modad & toast experiment" }, sec: 930, type: "video" },
      { id: "l4", title: { ar: "تجربتي مع سلوك المستهلك في المطاعم", en: "My restaurant consumer-behavior experience" }, sec: 406, type: "video" },
      { id: "l5", title: { ar: "دراسة كوكاكولا الشهيرة", en: "The famous Coca-Cola study" }, sec: 420, type: "video" },
      { id: "l6", title: { ar: "العوامل الخارجية وصناعة الفرص التسويقية", en: "External factors and creating marketing opportunities" }, sec: 272, type: "video" },
      { id: "l7", title: { ar: "العوامل الاجتماعية", en: "Social factors" }, sec: 307, type: "video" },
    ] },
    { id: "s2", title: { ar: "العوامل النفسية", en: "Psychological factors" }, lessons: [
      { id: "l8", title: { ar: "الدوافع والاحتياجات", en: "Motives and needs" }, sec: 1250, type: "video" },
      { id: "l9", title: { ar: "الإدراك والانتباه", en: "Perception and attention" }, sec: 1865, type: "video" },
      { id: "l10", title: { ar: "التعلم والذاكرة", en: "Learning and memory" }, sec: 1120, type: "video" },
      { id: "l11", title: { ar: "المواقف والمعتقدات", en: "Attitudes and beliefs" }, sec: 1335, type: "video" },
    ] },
    { id: "s3", title: { ar: "قرار الشراء", en: "The buying decision" }, lessons: [
      { id: "l12", title: { ar: "مراحل اتخاذ القرار الشرائي", en: "Stages of the buying decision" }, sec: 1710, type: "video" },
      { id: "l13", title: { ar: "رحلة العميل", en: "The customer journey" }, sec: 1572, type: "video" },
      { id: "l14", title: { ar: "ما بعد الشراء", en: "After the purchase" }, sec: 1185, type: "video" },
    ] },
    { id: "s4", title: { ar: "الولاء للعلامة", en: "Brand loyalty" }, lessons: [
      { id: "l15", title: { ar: "بناء الثقة", en: "Building trust" }, sec: 1260, type: "video" },
      { id: "l16", title: { ar: "برامج الولاء", en: "Loyalty programs" }, sec: 1420, type: "video" },
      { id: "l17", title: { ar: "جلسة مباشرة: أسئلة وأجوبة", en: "Live session: Q&A" }, sec: 1040, type: "live" },
    ] },
    { id: "s5", title: { ar: "التسويق العصبي", en: "Neuromarketing" }, lessons: [
      { id: "l18", title: { ar: "كيف يقرر الدماغ", en: "How the brain decides" }, sec: 1680, type: "video" },
      { id: "l19", title: { ar: "تطبيقات عملية", en: "Practical applications" }, sec: 1320, type: "video" },
    ] },
    { id: "s6", title: { ar: "المشروع الختامي", en: "Final project" }, lessons: [
      { id: "l20", title: { ar: "واجب: تحليل سلوك عميل", en: "Assignment: analyse a customer's behavior" }, sec: 600, type: "assignment" },
      { id: "l21", title: { ar: "اختبار نهائي", en: "Final quiz" }, sec: 480, type: "quiz" },
    ] },
  ],
  media: [
    { id: "m1", kind: "cover", color: "coral", name: { ar: "الغلاف الرئيسي", en: "Main cover" }, meta: "1280×800" },
    { id: "m2", kind: "image", color: "sky", name: { ar: "صورة المدرب", en: "Instructor photo" }, meta: "600×600" },
    { id: "m3", kind: "image", color: "yellow", name: { ar: "بانر التسويق", en: "Marketing banner" }, meta: "1600×500" },
  ],
  files: [
    { id: "f1", name: "consumer-behavior-slides.pdf", size: "4.2 MB" },
    { id: "f2", name: "case-study-cocacola.docx", size: "820 KB" },
    { id: "f3", name: "buying-journey-template.xlsx", size: "96 KB" },
  ],
  related: [
    { id: "r1", color: "purple", kind: "course", title: { ar: "التسويق الرقمي من الصفر", en: "Digital marketing from scratch" }, lessons: 32, price: 49 },
    { id: "r2", color: "teal", kind: "course", title: { ar: "علم نفس البيع", en: "Psychology of selling" }, lessons: 18, price: 29 },
    { id: "r3", color: "pink", kind: "diploma", title: { ar: "دبلوم التسويق المتكامل", en: "Integrated marketing diploma" }, lessons: 96, price: 199 },
  ],
  legacy: [
    { id: "g1", legacyId: 10, kind: "course", name: { ar: "سلوك المستهلك (النظام القديم)", en: "Consumer behavior (legacy)" }, migrated: true },
    { id: "g2", legacyId: 1041, kind: "video", name: { ar: "مجموعة الفيديوهات الأصلية", en: "Original video set" }, migrated: true },
    { id: "g3", legacyId: 1042, kind: "quiz", name: { ar: "اختبارات الوحدة 1", en: "Unit 1 quizzes" }, migrated: false },
    { id: "g4", legacyId: 1043, kind: "file", name: { ar: "ملفات المحاضرات", en: "Lecture files" }, migrated: false },
    { id: "g5", legacyId: 1044, kind: "forum", name: { ar: "نقاشات الطلاب", en: "Student discussions" }, migrated: false },
  ],
  allInstructors: [
    { id: "i1", name: { ar: "ثابت حجازي", en: "Thabet Hijazi" }, role: { ar: "مدرب رئيسي", en: "Lead instructor" }, courses: 4, color: "coral" },
    { id: "i2", name: { ar: "سارة المنصور", en: "Sara Al-Mansour" }, role: { ar: "خبيرة تسويق", en: "Marketing expert" }, courses: 7, color: "purple" },
    { id: "i3", name: { ar: "خالد الفهد", en: "Khaled Al-Fahd" }, role: { ar: "مدرب مساعد", en: "Teaching assistant" }, courses: 2, color: "teal" },
  ],
};
