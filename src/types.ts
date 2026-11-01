export interface Task {
  id?: string;
  taskName: string;
  category: string;
  description: string;
  taskLink: string;
  points: number;
}

export interface Submission {
  memberName: string;
  taskName?: string;
  points: number;
  timestamp?: string;
}

export interface LeaderboardMember {
  rank: number;
  name: string;
  points: number;
  submissionsCount: number;
  badge?: string;
  isCurrentUser: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  timestamp: string;
  isThinking?: boolean;
}

export type MediaRole = 'producer' | 'director' | 'audio' | 'creative';
