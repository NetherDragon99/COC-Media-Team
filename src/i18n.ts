import { Language } from './types.ts';

export const translations = {
  en: {
    // App Brand & Navigation
    appName: 'COC Media Team',
    versionBadge: 'v1.0.0',
    tagline: 'Production-Grade Task, Quota & Attendance Platform',
    tasks: 'Tasks',
    attendance: 'Attendance',
    leaderboard: 'Leaderboard',
    notifications: 'Notifications',
    profile: 'Profile',
    adminDashboard: 'Admin Dashboard',

    // Language
    language: 'Language',
    langEn: 'English',
    langAr: 'العربية',

    // Empty States
    noActiveTasks: 'No active tasks available right now',
    noActiveTasksSub: 'All tasks have been completed or none have been assigned yet.',
    noNotifications: 'No notifications at this time',
    noAttendanceSessions: 'No active attendance sessions right now',
    noSubmissionsYet: 'No submissions recorded yet',
    noZeroPointsRanking: 'No members with points above zero yet.',

    // Task Card & Status
    estimatedDuration: 'Est. Duration',
    remainingTime: 'Remaining',
    expired: 'Expired',
    completed: 'Completed',
    completedOnce: 'Task Finished ✓',
    completedToday: 'Completed Today ✓',
    completeTask: 'Complete Task',
    logNewCompletion: '+1 Log Completion',
    viewTaskLink: 'Open Resource ↗',
    taskCompetition: 'Head-to-Head Stats',
    progress: 'Progress',
    quotaRequired: 'Quota',
    unlimited: 'Unlimited',
    daily: 'Daily',
    once: 'Once',
    exactTarget: 'Target',
    points: 'pts',

    // Submission Modal
    submitTaskTitle: 'Submit Task Completion',
    actualDurationPrompt: 'Actual Time Taken (Minutes - Optional)',
    questionAnswerPrompt: 'Task Question (Required)',
    commentPrompt: 'Notes / Proof / Deliverables link',
    commentRequiredPrompt: 'Notes / Proof link (Required)',
    cancel: 'Cancel',
    confirmSubmission: 'Confirm Completion',
    submitting: 'Submitting...',

    // Attendance
    smartAttendance: 'Smart Attendance & Late Penalty Engine',
    attendanceSub: 'Check in during scheduled service sessions to maintain streak and avoid late penalties.',
    checkInNow: 'Check In Now',
    checkedInSuccess: 'Checked In Successfully!',
    onTimeBonus: 'On Time (+10 pts bonus)',
    latePenalty: 'Late Penalty Applied',
    minutesLate: 'minutes late',
    gracePeriod: 'Grace period',
    scheduledDays: 'Days',
    activeWindow: 'Check-in Window',

    // Leaderboard
    podiumTitle: 'Hall of Fame Leaderboard',
    podiumSub: 'Ranked live by overall points. Members with 0 or negative points are excluded from the winners podium.',
    allTime: 'All-Time',
    today: 'Today',
    thisWeek: 'This Week',
    byCategory: 'By Category',
    byTask: 'By Task',
    rank: 'Rank',
    member: 'Member',
    score: 'Score',
    champion: 'CHAMPION',
    you: 'You',

    // Profile & PWA
    memberProfile: 'Member Profile',
    editProfile: 'Edit Profile',
    saveProfile: 'Save Changes',
    displayName: 'Display Name',
    photoURL: 'Profile Picture URL or Upload',
    uploadPhoto: 'Upload Photo',
    totalPoints: 'Total Points',
    penaltiesTotal: 'Total Penalties',
    activeStreak: 'Active Streak',
    days: 'Days',
    installPWA: 'Install App (PWA)',
    installPWADesc: 'Install as native app on iOS / Android / Desktop for full-screen offline experience.',
    installNow: 'Install App',
    installed: 'App Installed ✓',
    signInWithGoogle: 'Sign In with Google',
    signOut: 'Sign Out',
    switchUser: 'Switch User',

    // Admin Auth & Dashboard
    adminMasterPassTitle: 'Admin Master Access',
    adminPassDesc: 'Enter master password to unlock full CMS control on this device permanently.',
    adminPasswordPlaceholder: 'Enter master password...',
    unlockAdmin: 'Unlock Admin',
    lockAdmin: 'Lock Admin Mode',
    adminLockedToast: 'Admin mode locked.',
    invalidPassword: 'Invalid password. Try again.',

    // Admin Tabs
    adminTasks: 'Tasks Manager',
    adminCategories: 'Categories',
    adminMembers: 'Members & Points',
    adminAttendance: 'Attendance Sessions',
    adminSubmissions: 'Submissions Inspector',
    adminSettings: 'Site & UI Settings',

    // Common Admin Actions
    addNew: 'Add New',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    search: 'Search...',
    allCategories: 'All Categories',
    confirmDelete: 'Are you sure you want to delete this item?',
    pointsAdjustedSuccess: 'Points adjusted successfully!',
    taskSavedSuccess: 'Task saved successfully!',
    categorySavedSuccess: 'Category saved successfully!',

    // Footer
    designedAndDevelopedBy: 'Designed & Developed by Steven Mario',
  },
  ar: {
    // App Brand & Navigation
    appName: 'COC Media Team',
    versionBadge: 'v1.0.0',
    tagline: 'منصة إدارة المهام، الكوتا ومحرك الحضور والخصومات لفريق الميديا',
    tasks: 'المهام',
    attendance: 'الحضور',
    leaderboard: 'المتصدرين',
    notifications: 'الإشعارات',
    profile: 'الملف الشخصي',
    adminDashboard: 'لوحة التحكم',

    // Language
    language: 'اللغة',
    langEn: 'English',
    langAr: 'العربية',

    // Empty States
    noActiveTasks: 'لا توجد مهام متاحة حالياً',
    noActiveTasksSub: 'تم إنجاز كافة المهام أو لم يتم تعيين مهام جديدة بعد.',
    noNotifications: 'لا توجد إشعارات جديدة حالياً',
    noAttendanceSessions: 'لا توجد جلسات حضور نشطة الآن',
    noSubmissionsYet: 'لا توجد تسليمات مسجلة حتى الآن',
    noZeroPointsRanking: 'لا يوجد أعضاء لديهم نقاط أعلى من الصفر حالياً.',

    // Task Card & Status
    estimatedDuration: 'الوقت المتوقع',
    remainingTime: 'المتبقي',
    expired: 'منتهية',
    completed: 'مكتملة',
    completedOnce: 'تم إنجاز المهمة ✓',
    completedToday: 'تم إنجاز مهمة اليوم ✓',
    completeTask: 'تسجيل الإنجاز',
    logNewCompletion: '+1 تسجيل تنفيذ جديد',
    viewTaskLink: 'فتح الرابط المرفق ↗',
    taskCompetition: 'منافسة هذه المهمة',
    progress: 'الإنجاز',
    quotaRequired: 'الكوتا',
    unlimited: 'مفتوح',
    daily: 'يومي',
    once: 'مرة واحدة',
    exactTarget: 'الهدف',
    points: 'نقطة',

    // Submission Modal
    submitTaskTitle: 'تأكيد إنجاز المهمة',
    actualDurationPrompt: 'الوقت الفعلي المستغرق (بالدقائق - اختياري)',
    questionAnswerPrompt: 'سؤال المهمة (إلزامي)',
    commentPrompt: 'ملاحظات / رابط التسليم أو الدليل',
    commentRequiredPrompt: 'ملاحظات / رابط التسليم (مطلوب)',
    cancel: 'إلغاء',
    confirmSubmission: 'تأكيد التسليم',
    submitting: 'جاري الإرسال...',

    // Attendance
    smartAttendance: 'محرك الحضور الذكي واحتساب التأخير',
    attendanceSub: 'سجل حضورك خلال الجلسات المحددة للحفاظ على نشاطك وتجنب خصم النقاط.',
    checkInNow: 'تسجيل الحضور الآن',
    checkedInSuccess: 'تم تسجيل الحضور بنجاح!',
    onTimeBonus: 'في الموعد (+10 نقاط مكافأة)',
    latePenalty: 'تم تطبيق خصم التأخير',
    minutesLate: 'دقيقة تأخير',
    gracePeriod: 'فترة السماح',
    scheduledDays: 'الأيام المجدولة',
    activeWindow: 'نافذة التسجيل',

    // Leaderboard
    podiumTitle: 'لوحة الشرف وتصنيف الأبطال',
    podiumSub: 'ترتيب مباشر وفق إجمالي النقاط. يتم استبعاد الأعضاء الحاصلين على صفر أو نقاط سالبة من منصة التتويج.',
    allTime: 'الترتيب العام',
    today: 'اليوم',
    thisWeek: 'هذا الأسبوع',
    byCategory: 'حسب التصنيف',
    byTask: 'حسب المهمة',
    rank: 'الترتيب',
    member: 'العضو',
    score: 'النقاط',
    champion: 'البطل',
    you: 'أنت',

    // Profile & PWA
    memberProfile: 'الملف الشخصي',
    editProfile: 'تعديل البيانات',
    saveProfile: 'حفظ التغييرات',
    displayName: 'اسم العرض',
    photoURL: 'رابط الصورة الشخصية أو رفع صورة',
    uploadPhoto: 'رفع صورة',
    totalPoints: 'إجمالي النقاط',
    penaltiesTotal: 'إجمالي الخصومات',
    activeStreak: 'أيام النشاط المتتالية',
    days: 'أيام',
    installPWA: 'تثبيت التطبيق (PWA)',
    installPWADesc: 'تثبيت كتطبيق مستقل على الهاتف أو الحاسوب بدون شريط المتصفح ومع دعم بدون إنترنت.',
    installNow: 'تثبيت التطبيق',
    installed: 'تم التثبيت ✓',
    signInWithGoogle: 'تسجيل الدخول بجوجل',
    signOut: 'تسجيل الخروج',
    switchUser: 'تبديل المستخدم',

    // Admin Auth & Dashboard
    adminMasterPassTitle: 'دخول المسؤول الرئيسي',
    adminPassDesc: 'أدخل كلمة المرور الرئيسية لفتح صلاحيات إدارة المنصة بالكامل على هذا الجهاز بشكل دائم.',
    adminPasswordPlaceholder: 'أدخل كلمة المرور الرئيسية...',
    unlockAdmin: 'فتح لوحة الإدارة',
    lockAdmin: 'قفل وضع الإدارة',
    adminLockedToast: 'تم قفل وضع الإدارة.',
    invalidPassword: 'كلمة المرور غير صحيحة. حاول مرة أخرى.',

    // Admin Tabs
    adminTasks: 'إدارة المهام',
    adminCategories: 'التصنيفات',
    adminMembers: 'الأعضاء والنقاط',
    adminAttendance: 'جلسات الحضور',
    adminSubmissions: 'مراجعة التسليمات',
    adminSettings: 'إعدادات الموقع',

    // Common Admin Actions
    addNew: 'إضافة جديد',
    edit: 'تعديل',
    delete: 'حذف',
    save: 'حفظ',
    search: 'بحث...',
    allCategories: 'جميع التصنيفات',
    confirmDelete: 'هل أنت متأكد من رغبتك في حذف هذا العنصر؟',
    pointsAdjustedSuccess: 'تم تعديل النقاط بنجاح!',
    taskSavedSuccess: 'تم حفظ المهمة بنجاح!',
    categorySavedSuccess: 'تم حفظ التصنيف بنجاح!',

    // Footer
    designedAndDevelopedBy: 'Designed & Developed by Steven Mario',
  }
};

export const MASTER_ADMIN_PASSWORD = '$J@@s#COC1982';

export const DEFAULT_CATEGORIES = [
  { id: 'cat_video', nameEn: 'Video Production', nameAr: 'إنتاج الفيديو', color: '#0A84FF', icon: 'Video' },
  { id: 'cat_audio', nameEn: 'Audio & Live Sound', nameAr: 'هندسة الصوت', color: '#F59E0B', icon: 'Mic' },
  { id: 'cat_broadcast', nameEn: 'Live Streaming', nameAr: 'البث المباشر', color: '#10B981', icon: 'Radio' },
  { id: 'cat_lighting', nameEn: 'Stage & Lighting', nameAr: 'الإضاءة والمسرح', color: '#EAB308', icon: 'Sun' },
  { id: 'cat_graphics', nameEn: 'Graphics & Design', nameAr: 'التصميم والجرافيك', color: '#EC4899', icon: 'Image' },
  { id: 'cat_social', nameEn: 'Social Media & Reels', nameAr: 'سوشيال ميديا وريلز', color: '#8B5CF6', icon: 'Share2' },
  { id: 'cat_general', nameEn: 'General Media', nameAr: 'عام وتجهيزات', color: '#64748B', icon: 'Layers' },
];
