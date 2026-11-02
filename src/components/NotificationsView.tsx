import React from 'react';
import { NotificationItem, Language } from '../types.ts';
import { translations } from '../i18n.ts';
import { Bell, CheckCheck, Clock, Award, Calendar, Volume2, Shield } from 'lucide-react';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  language: Language;
  onMarkAllAsRead: () => void;
  onRequestPushPermission: () => void;
  pushPermissionState: NotificationPermission;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  language,
  onMarkAllAsRead,
  onRequestPushPermission,
  pushPermissionState,
}) => {
  const t = translations[language];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      
      {/* Top Header Card */}
      <div className="rounded-3xl glass-panel-elevated p-6 sm:p-8 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              {t.notifications}
            </h2>
            <p className="text-xs text-neutral-400">
              Live alerts for new tasks, attendance sessions, and points adjustments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pushPermissionState !== 'granted' && (
            <button
              onClick={onRequestPushPermission}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Enable System Alerts</span>
            </button>
          )}

          <button
            onClick={onMarkAllAsRead}
            className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mark All as Read</span>
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="rounded-3xl glass-panel overflow-hidden border border-white/10">
        <div className="divide-y divide-white/[0.06]">
          {notifications.map((item) => {
            const getTypeIcon = () => {
              switch (item.type) {
                case 'task':
                  return <Clock className="w-4 h-4 text-[#0A84FF]" />;
                case 'points':
                  return <Award className="w-4 h-4 text-[#F59E0B]" />;
                case 'attendance':
                  return <Calendar className="w-4 h-4 text-emerald-400" />;
                default:
                  return <Shield className="w-4 h-4 text-purple-400" />;
              }
            };

            return (
              <div
                key={item.id}
                className={`p-5 flex items-start gap-4 transition-colors ${
                  item.read ? 'hover:bg-white/[0.02]' : 'bg-purple-950/15 hover:bg-purple-950/25'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getTypeIcon()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      {item.title}
                    </h4>
                    <span className="text-[11px] text-neutral-500 font-mono flex-shrink-0">
                      {item.createdAt?.slice(0, 16) || 'Just now'}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </div>
            );
          })}

          {notifications.length === 0 && (
            <div className="py-16 text-center text-neutral-400 text-sm">
              <Bell className="w-10 h-10 mx-auto text-neutral-600 mb-2" />
              <p>{t.noNotifications}</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
