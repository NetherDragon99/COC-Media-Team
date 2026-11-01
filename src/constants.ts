import { Task, Submission } from './types.ts';

export const API_URL = 'https://script.google.com/macros/s/AKfycbyn5I6tN-WwTmnmCbWmS1Snr82iE7GwvYX_EP-2o4kCloV5q8sZZbBbVZiVEMiRa4yGZg/exec';

export const STORAGE_KEYS = {
  MEMBER_NAME: 'coc_media_member_name',
  COMPLETED_TASKS: 'coc_media_completed_tasks_v1',
  LOCAL_SUBMISSIONS: 'coc_media_local_submissions_v1',
  LOCAL_TASKS: 'coc_media_local_tasks_v1',
  CHAT_HISTORY: 'coc_media_chat_history_v1',
};

// Default production-ready media team tasks used if Google Sheet is empty on first load
export const DEFAULT_TASKS: Task[] = [
  {
    taskName: 'Sunday Service Livestream Switcher',
    category: 'Broadcast',
    description: 'Operate ATEM switcher, transition between pastor wide shot, pulpit close-up, and lyrics lower-thirds on cue.',
    taskLink: 'https://support.apple.com',
    points: 80,
  },
  {
    taskName: 'Sermon Highlights 60s Reel Edit',
    category: 'Video',
    description: 'Cut key 60-second message hook from Sunday sermon, add animated subtitles, color grade, and export 9:16 vertical video.',
    taskLink: 'https://youtube.com',
    points: 100,
  },
  {
    taskName: 'Broadcast Audio Gain Staging & Mix',
    category: 'Audio',
    description: 'Perform digital soundcheck on Allen & Heath / Behringer X32, tune band IEMs, and calibrate broadcast master bus to -14 LUFS.',
    taskLink: 'https://audiotechnology.com',
    points: 75,
  },
  {
    taskName: 'Cinematic B-Roll & Photography Recap',
    category: 'Video',
    description: 'Capture 20+ RAW photos of worship, greeting, and altar call. Grade in Lightroom and upload to Google Drive archive.',
    taskLink: 'https://drive.google.com',
    points: 60,
  },
  {
    taskName: 'Stage Key Lighting & DMX Fixture Reset',
    category: 'Lighting',
    description: 'Check 5600K keylights on the pulpit, calibrate fill lights, inspect haze machine fluid levels, and test stage scene cues.',
    taskLink: 'https://aputure.com',
    points: 50,
  },
  {
    taskName: 'Weekly YouTube Thumbnail Design',
    category: 'Graphics',
    description: 'Design high-contrast YouTube thumbnail (1280x720) with punchy typography, pastor cut-out, and high-impact visual hook.',
    taskLink: 'https://canva.com',
    points: 45,
  },
  {
    taskName: 'Wireless Mic Frequency Scan & Battery Prep',
    category: 'Audio',
    description: 'Scan RF channels to prevent dropouts, insert fresh rechargeable batteries, and clean wind filters on pastor lapel & handhelds.',
    taskLink: 'https://shure.com',
    points: 35,
  },
  {
    taskName: 'Midweek Social Media Quote Graphics',
    category: 'Social',
    description: 'Create 3 carousels for Instagram containing Sunday sermon quotes, scripture references, and prayer request links.',
    taskLink: 'https://instagram.com',
    points: 50,
  },
];

// Initial demo submissions to populate the leaderboard if API has no submissions yet
export const DEFAULT_SUBMISSIONS: Submission[] = [
  { memberName: 'Marcus Vance', points: 340 },
  { memberName: 'Sarah Jenkins', points: 285 },
  { memberName: 'David Kalu', points: 220 },
  { memberName: 'Elena Rostova', points: 175 },
  { memberName: 'Jordan Lee', points: 130 },
];
