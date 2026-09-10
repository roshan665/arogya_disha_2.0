import React from 'react';
import { RoleNotificationRecord, NotificationPriority } from '../lib/services/RoleBasedNotificationService';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: RoleNotificationRecord[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onOpenEntity?: (notification: RoleNotificationRecord) => void;
  language?: 'en' | 'mr' | 'hi';
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenEntity,
  language = 'en',
}) => {
  if (!isOpen) return null;

  const t = {
    en: {
      title: 'Notification Center',
      subtitle: 'Real-time role-authorized clinical alerts',
      markAllRead: 'Mark all as read',
      noNotifications: 'No notifications at this time. You are all caught up! 🌿',
      openDetails: 'View Details',
      unread: 'Unread',
      urgent: 'URGENT',
      high: 'HIGH PRIORITY',
      normal: 'NORMAL',
      low: 'INFO',
    },
    mr: {
      title: 'आरोग्य सूचना केंद्र',
      subtitle: 'थेट अधिकृत वैद्यकीय व कार्य सूचना',
      markAllRead: 'सर्व वाचलेले म्हणून नोंदवा',
      noNotifications: 'कोणतीही नवीन सूचना नाही! सर्व कामे अद्यतनित आहेत. 🌿',
      openDetails: 'तपशील पहा',
      unread: 'नवीन',
      urgent: 'तातडीचे',
      high: 'उच्च प्राधान्य',
      normal: 'सामान्य',
      low: 'माहिती',
    },
    hi: {
      title: 'स्वास्थ्य सूचना केंद्र',
      subtitle: 'वास्तविक समय अधिकृत नैदानिक व कार्य अलर्ट',
      markAllRead: 'सभी को पढ़ा हुआ चिह्नित करें',
      noNotifications: 'इस समय कोई सूचना नहीं है। आप पूरी तरह अपडेट हैं! 🌿',
      openDetails: 'विवरण देखें',
      unread: 'अपठित',
      urgent: 'अति आवश्यक',
      high: 'उच्च प्राथमिकता',
      normal: 'सामान्य',
      low: 'जानकारी',
    },
  }[language];

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            {t.urgent}
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
            {t.high}
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {t.low}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {t.normal}
          </span>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('APPOINTMENT')) return 'calendar_month';
    if (type.includes('REFERRAL')) return 'local_hospital';
    if (type.includes('REPORT') || type.includes('DIAGNOSTIC')) return 'lab_profile';
    if (type.includes('FOLLOW_UP') || type.includes('TASK')) return 'task_alt';
    if (type.includes('MESSAGE')) return 'chat';
    if (type.includes('URGENT') || type.includes('ALERT')) return 'warning';
    return 'notifications';
  };

  return (
    <div className="fixed inset-0 z-[140] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-xs relative">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">{t.title}</h3>
                {unreadCount > 0 && (
                  <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.2 rounded-full">
                    {unreadCount} {t.unread}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline px-2 py-1 rounded-lg cursor-pointer"
              >
                {t.markAllRead}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[28px]">notifications_off</span>
              </div>
              <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                {t.noNotifications}
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) onMarkAsRead(n.id);
                  if (onOpenEntity && n.related_entity_id) onOpenEntity(n);
                }}
                className={`pt-2.5 first:pt-0 p-3 rounded-2xl transition-all cursor-pointer space-y-1.5 border ${
                  !n.is_read
                    ? 'bg-emerald-50/50 border-emerald-200/80 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-600">
                      {getTypeIcon(n.type)}
                    </span>
                    <span className="text-xs font-black text-slate-900 leading-tight">
                      {n.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {getPriorityBadge(n.priority)}
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-snug">{n.message}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {n.related_entity_id && (
                    <span className="text-emerald-700 font-bold hover:underline flex items-center gap-0.5">
                      <span>{t.openDetails}</span>
                      <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
