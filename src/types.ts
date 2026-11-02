export type Language = 'en' | 'ar';

export type UserRole = 'member' | 'lead' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  points: number;
  totalPenalties: number;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
  streakDays?: number;
  lastActiveDate?: string;
}

export type DeadlineType = 'none' | 'duration_hours' | 'duration_days' | 'exact_datetime';

export type QuotaType = 'once' | 'daily' | 'unlimited' | 'exact_target' | 'minimum_quota';

export interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  taskLink?: string;
  points: number;
  estimatedDuration?: string; // e.g., "30 mins", "1 hour"
  startTime?: string; // ISO string or time
  deadlineType: DeadlineType;
  deadlineValue?: string; // hours, days, or ISO datetime
  deadlineTimestamp?: number; // calculated epoch ms
  quotaType: QuotaType;
  targetQuota?: number; // e.g. 3 times
  enableComment?: boolean;
  isCommentRequired?: boolean;
  enableQuestion?: boolean;
  questionPrompt?: string;
  isQuestionRequired?: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  nameEn: string;
  nameAr: string;
  color: string;
  icon?: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  categoryId: string;
  pointsEarned: number;
  comment?: string;
  questionAnswer?: string;
  completedAt: string;
  actualDurationMinutes?: number;
  dateKey: string; // YYYY-MM-DD
}

export interface AttendanceSession {
  id: string;
  title: string;
  scheduledDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  exactStartTime: string; // HH:mm e.g. "09:00"
  checkInWindowEnd: string; // HH:mm e.g. "11:00"
  gracePeriodMinutes: number; // e.g. 10
  penaltyUnitMinutes: number; // e.g. 5
  penaltyRatePerUnit: number; // e.g. 2
  minPenalty: number; // e.g. 5
  maxPenaltyCap: number; // e.g. 50
  isActive: boolean;
}

export interface AttendanceLog {
  id: string;
  sessionId: string;
  sessionTitle: string;
  userId: string;
  userDisplayName: string;
  checkInTimestamp: string;
  dateKey: string;
  status: 'on_time' | 'late' | 'excused';
  lateMinutes: number;
  penaltyPointsApplied: number;
  bonusPointsApplied: number;
}

export interface NotificationItem {
  id: string;
  targetUserId: string; // 'all' or specific user uid
  title: string;
  body: string;
  type: 'task' | 'attendance' | 'points' | 'announcement';
  createdAt: string;
  read?: boolean;
  url?: string;
}

export interface AppSettings {
  appName: string;
  subtitleEn: string;
  subtitleAr: string;
  announcementEn: string;
  announcementAr: string;
  accentColor: string;
  logoUrl: string;
  developerCredit: string;
  version: string;
}

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string;
  photoURL: string;
  points: number;
  completionsCount: number;
  badge?: string;
  isCurrentUser: boolean;
}
