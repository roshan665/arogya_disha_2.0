import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { saveVisitOffline } from '../lib/db';
import { useRoleRealtimeCommunication } from '../lib/hooks/useRoleRealtimeCommunication';
import { RealtimeCommunicationService } from '../lib/services/RealtimeCommunicationService';
import { PatientAshaCommunicationService } from '../lib/services/PatientAshaCommunicationService';

interface PatientViewProps {
  user?: any;
}

export interface AppointmentItem {
  id: string;
  type: string;
  date: string;
  rawDate?: string;
  time: string;
  doctorOrAsha: string;
  facility: string;
  status: 'CONFIRMED' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  patientName: string;
}

const t = {
  en: {
    greeting: 'Good Morning, {name}! 👋',
    tagline: 'Take charge of your health today.',
    notificationsCount: '3 Active Health Notifications',
    languageSet: 'Language set to English',
    healthOverview: 'Your Health Overview',
    overviewSubtitle: 'Small steps, big impact!',
    heartRate: 'Heart Rate',
    bloodPressure: 'Blood Pressure',
    bloodSugar: 'Blood Sugar',
    weight: 'Weight',
    bpm: 'bpm',
    mmhg: 'mmHg',
    mgdl: 'mg/dL',
    kg: 'kg',
    connectAsha: 'Connect with Your ASHA',
    ashaRole: 'ASHA Worker • Dhamangaon PHC',
    contactAsha: 'Contact ASHA',
    quickActions: 'Quick Actions',
    callAmbulance: 'Call Ambulance',
    bookAppointment: 'Book Appointment',
    medicineReminder: 'Medicine Reminder',
    healthRecords: 'Health Records',
    labReports: 'Lab Reports',
    healthTips: 'Health Tips',
    nearbyServices: 'Nearby Services',
    healthInsights: 'Health Insights',
    viewAll: 'View All',
    healthScore: 'Health Score',
    healthScoreGood: "You're doing good!",
    healthScoreSubtitle: 'Keep it up to stay healthy.',
    walk: 'Walk',
    water: 'Water',
    sleep: 'Sleep',
    stepsCount: '6,000 steps',
    glassesCount: '5 glasses',
    hrsCount: '7 hrs',
    emergencyServices: 'Emergency Services',
    emergency247: '24x7 Emergency',
    emergencyHelpline: 'Emergency Helpline',
    upcomingAppointments: 'Upcoming Appointments',
    confirmed: 'Confirmed',
    home: 'Home',
    appointments: 'Appointments',
    reports: 'Reports',
    profile: 'Profile',
    yourAppointments: 'Your Appointments',
    appointmentsSubtitle: 'Dhamangaon PHC & ASHA Visits',
    bookNew: '+ Book New',
    noAppointments: 'No appointments booked yet.',
    cancelAppointment: 'Cancel',
    reschedule: 'Reschedule',
    diagnosticReports: 'Diagnostic Reports',
    reportsSubtitle: 'Laboratory & Vitals History',
    download: 'Download',
    abhaCard: 'Digital ABHA Health Records',
    pmjayActive: 'PM-JAY Active',
    personalInfo: 'Personal Information',
    address: 'Address: Gavali Galli, Ward 2, Dhamangaon, Karjat',
    assignedAsha: 'Assigned ASHA: Sunita More (+91 98234 56789)',
    primaryCenter: 'Primary Center: Dhamangaon Sub-center, Karjat PHC',
    signOut: 'Sign Out of Account',
    bookAppointmentModalTitle: 'Book Doctor / ASHA Appointment',
    consultType: 'Consultation Type',
    preferredDate: 'Preferred Date',
    preferredTime: 'Preferred Time Slot',
    confirmBooking: 'Confirm Booking',
    cancel: 'Cancel',
    bookingSuccess: '📅 Appointment booked for {date} at {time} ({type})! Assigned to ASHA Sunita More.',
    ashaAssignedNotice: 'Assigned to ASHA Sunita More for home/PHC coordination.',
    emergencyTransmitted: '🚨 108 Emergency Call Transmitted! Doctor & Dispatcher Notified.'
  },
  mr: {
    greeting: 'शुभ प्रभात, {name}! 👋',
    tagline: 'आजच तुमच्या आरोग्याची काळजी घ्या.',
    notificationsCount: '३ सक्रिय आरोग्य सूचना',
    languageSet: 'भाषा बदलली: मराठी',
    healthOverview: 'तुमचे आरोग्य विहंगावलोकन',
    overviewSubtitle: 'लहान पावले, मोठा प्रभाव!',
    heartRate: 'हृदयाचे ठोके',
    bloodPressure: 'रक्तदाब',
    bloodSugar: 'रक्तातील साखर',
    weight: 'वजन',
    bpm: 'ठोके/मि',
    mmhg: 'mmHg',
    mgdl: 'mg/dL',
    kg: 'कि.ग्रॅ.',
    connectAsha: 'तुमच्या आशा कार्यकर्तीशी संपर्क साधा',
    ashaRole: 'आशा कार्यकर्ती • धामणगाव प्रा.आ.कें.',
    contactAsha: 'आशा ताईंशी संपर्क',
    quickActions: 'जलद कृती',
    callAmbulance: 'रुग्णवाहिका बोलवा',
    bookAppointment: 'भेट बुक करा',
    medicineReminder: 'औषध स्मरणपत्र',
    healthRecords: 'आरोग्य नोंदी',
    labReports: 'लॅब अहवाल',
    healthTips: 'आरोग्य टिप्स',
    nearbyServices: 'जवळच्या आरोग्य सेवा',
    healthInsights: 'आरोग्य विश्लेषण',
    viewAll: 'सर्व पहा',
    healthScore: 'आरोग्य स्कोअर',
    healthScoreGood: 'तुमची तब्येत उत्तम आहे!',
    healthScoreSubtitle: 'निरोगी राहण्यासाठी अशीच काळजी घ्या.',
    walk: 'चालणे',
    water: 'पाणी',
    sleep: 'झोप',
    stepsCount: '६,००० पावले',
    glassesCount: '५ ग्लास',
    hrsCount: '७ तास',
    emergencyServices: 'आणीबाणी सेवा',
    emergency247: '२४x७ आपत्कालीन',
    emergencyHelpline: 'आपत्कालीन हेल्पलाइन',
    upcomingAppointments: 'आगामी नियोजित भेटी',
    confirmed: 'निश्चित',
    home: 'मुख्यपृष्ठ',
    appointments: 'भेटी (Appointments)',
    reports: 'अहवाल',
    profile: 'प्रोफाइल',
    yourAppointments: 'तुमच्या नियोजित भेटी',
    appointmentsSubtitle: 'धामणगाव उपकेंद्र व आशा गृहभेटी',
    bookNew: '+ नवीन भेट बुक करा',
    noAppointments: 'कोणतीही नियोजित भेट नोंदवलेली नाही.',
    cancelAppointment: 'रद्द करा',
    reschedule: 'वेळ बदला',
    diagnosticReports: 'वैद्यकीय तपासणी अहवाल',
    reportsSubtitle: 'प्रयोगशाळा व शारीरिक तपासणी इतिहास',
    download: 'डाऊनलोड',
    abhaCard: 'डिजिटल आभा आरोग्य नोंदी',
    pmjayActive: 'आयुष्मान भारत (PM-JAY) सक्रिय',
    personalInfo: 'वैयक्तिक माहिती',
    address: 'पत्ता: गवळी गल्ली, वॉर्ड २, धामणगाव, कर्जत',
    assignedAsha: 'आशा कार्यकर्ती: सुनिता मोरे (+91 98234 56789)',
    primaryCenter: 'प्राथमिक केंद्र: धामणगाव उपकेंद्र, कर्जत प्रा.आ.कें.',
    signOut: 'खात्यातून लॉग आउट करा',
    bookAppointmentModalTitle: 'डॉक्टर / आशा भेट बुक करा',
    consultType: 'तपासणीचा प्रकार',
    preferredDate: 'तारीख निवडा',
    preferredTime: 'वेळ निवडा',
    confirmBooking: 'भेट निश्चित करा',
    cancel: 'रद्द करा',
    bookingSuccess: '📅 {date} रोजी {time} वाजता भेट यशस्वीरित्या नोंदवली गेली! आशा ताईंना सूचना पाठवली आहे.',
    ashaAssignedNotice: 'आशा कार्यकर्ती सुनिता मोरे यांच्याकडे सूचना पाठवली गेली आहे.',
    emergencyTransmitted: '🚨 १०८ रुग्णवाहिका तात्काळ पाठवली आहे! डॉक्टरांना सूचित केले.'
  },
  hi: {
    greeting: 'शुभ प्रभात, {name}! 👋',
    tagline: 'आज ही अपने स्वास्थ्य की देखभाल करें।',
    notificationsCount: '3 सक्रिय स्वास्थ्य सूचनाएं',
    languageSet: 'भाषा बदली: हिंदी',
    healthOverview: 'आपका स्वास्थ्य अवलोकन',
    overviewSubtitle: 'छोटे कदम, बड़ा असर!',
    heartRate: 'हृदय गति',
    bloodPressure: 'रक्तचाप (BP)',
    bloodSugar: 'ब्लड शुगर',
    weight: 'वजन',
    bpm: 'bpm',
    mmhg: 'mmHg',
    mgdl: 'mg/dL',
    kg: 'किग्रा',
    connectAsha: 'अपनी आशा कार्यकर्ता से जुड़ें',
    ashaRole: 'आशा कार्यकर्ता • धामणगांव पीएचसी',
    contactAsha: 'आशा दीदी से संपर्क',
    quickActions: 'त्वरित सेवाएं',
    callAmbulance: 'एम्बुलेंस बुलाएं',
    bookAppointment: 'अपॉइंटमेंट बुक करें',
    medicineReminder: 'दवा अनुस्मारक',
    healthRecords: 'स्वास्थ्य रिकॉर्ड्स',
    labReports: 'लैब रिपोर्ट्स',
    healthTips: 'स्वास्थ्य सलाह',
    nearbyServices: 'निकटतम स्वास्थ्य केंद्र',
    healthInsights: 'स्वास्थ्य विश्लेषण',
    viewAll: 'सभी देखें',
    healthScore: 'स्वास्थ्य स्कोर',
    healthScoreGood: 'आपकी सेहत बहुत अच्छी है!',
    healthScoreSubtitle: 'स्वस्थ रहने के लिए इसी तरह ध्यान रखें।',
    walk: 'टहलना',
    water: 'पानी',
    sleep: 'नींद',
    stepsCount: '6,000 कदम',
    glassesCount: '5 गिलास',
    hrsCount: '7 घंटे',
    emergencyServices: 'आपातकालीन सेवाएं',
    emergency247: '24x7 आपातकाल',
    emergencyHelpline: 'आपातकालीन हेल्पलाइन',
    upcomingAppointments: 'आगामी अपॉइंटमेंट्स',
    confirmed: 'पुष्टीकृत',
    home: 'होम',
    appointments: 'अपॉइंटमेंट्स',
    reports: 'रिपोर्ट्स',
    profile: 'प्रोफाइल',
    yourAppointments: 'आपकी निर्धारित मुलाकातें',
    appointmentsSubtitle: 'धामणगांव उप-केंद्र व आशा गृह भेंट',
    bookNew: '+ नई अपॉइंटमेंट',
    noAppointments: 'अभी कोई अपॉइंटमेंट दर्ज नहीं है।',
    cancelAppointment: 'रद्द करें',
    reschedule: 'समय बदलें',
    diagnosticReports: 'नैदानिक जांच रिपोर्ट्स',
    reportsSubtitle: 'प्रयोगशाला व महत्वपूर्ण जांच इतिहास',
    download: 'डाउनलोड',
    abhaCard: 'डिजिटल आभा स्वास्थ्य रिकॉर्ड',
    pmjayActive: 'आयुष्मान भारत (PM-JAY) सक्रिय',
    personalInfo: 'व्यक्तिगत जानकारी',
    address: 'पता: गवली गली, वार्ड 2, धामणगांव, कर्जत',
    assignedAsha: 'नियुक्त आशा: सुनीता मोरे (+91 98234 56789)',
    primaryCenter: 'प्राथमिक केंद्र: धामणगांव उप-केंद्र, कर्जत पीएचसी',
    signOut: 'खाते से लॉग आउट करें',
    bookAppointmentModalTitle: 'डॉक्टर / आशा अपॉइंटमेंट बुक करें',
    consultType: 'परामर्श का प्रकार',
    preferredDate: 'तारीख चुनें',
    preferredTime: 'समय स्लॉट चुनें',
    confirmBooking: 'बुकिंग की पुष्टि करें',
    cancel: 'रद्द करें',
    bookingSuccess: '📅 {date} को {time} बजे अपॉइंटमेंट सफलतापूर्वक दर्ज हो गया! आशा दीदी को सूचना भेज दी गई है।',
    ashaAssignedNotice: 'आशा कार्यकर्ता सुनीता मोरे को समन्वय हेतु सूचना भेजी गई।',
    emergencyTransmitted: '🚨 108 एम्बुलेंस आपातकालीन कॉल भेजी गई! डॉक्टर व डिस्पैचर को सूचित किया।'
  }
};

const INITIAL_APPOINTMENTS: AppointmentItem[] = [
  {
    id: 'apt-101',
    type: 'ANC Routine Checkup',
    date: '15 May 2026',
    rawDate: '2026-05-15',
    time: '10:00 AM',
    doctorOrAsha: 'Sunita More (ASHA)',
    facility: 'Dhamangaon Sub-center',
    status: 'CONFIRMED',
    patientName: 'Roshan Sahani',
  }
];

export const PatientView: React.FC<PatientViewProps> = ({ user }) => {
  const router = useRouter();
  const [language, setLanguage] = useState<'mr' | 'hi' | 'en'>('en');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'appointments' | 'reports' | 'profile'>('home');

  // Appointments state with local persistence
  const [appointments, setAppointments] = useState<AppointmentItem[]>(INITIAL_APPOINTMENTS);

  // Load saved appointments from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('arogya_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAppointments(parsed);
        }
      }
    } catch (e) {
      console.warn('Error loading appointments from localStorage:', e);
    }
  }, []);

  // Role-Based Realtime Communication Hook (Authorized for PATIENT)
  const patientUserId = user?.id || 'p-patient-101';
  useRoleRealtimeCommunication({
    role: 'PATIENT',
    userId: patientUserId,
    onEventReceived: (event) => {
      console.log('PATIENT received authorized realtime event:', event.type);
      if (event.type.startsWith('REQUEST_')) {
        const statusType = event.type.replace('REQUEST_', '');
        showToast(
          language === 'mr'
            ? `आशा ताईंनी विनंती स्थिती अद्यतनित केली: ${statusType}`
            : language === 'hi'
            ? `आशा दीदी ने अनुरोध स्थिति अपडेट की: ${statusType}`
            : `ASHA updated request status: ${statusType}`
        );
      } else if (event.type === 'ASHA_FOLLOWUP_RECORDED') {
        showToast(
          language === 'mr'
            ? 'आशा ताईंनी नवीन पाठपुरावा नोंदवला आहे.'
            : language === 'hi'
            ? 'आशा दीदी ने नया फॉलो-अप दर्ज किया है।'
            : 'ASHA recorded a new follow-up update.'
        );
      } else if (event.type.startsWith('APPOINTMENT_') || event.type.startsWith('REFERRAL_')) {
        showToast(
          language === 'mr'
            ? `आरोग्य अपडेट प्राप्त: ${event.type}`
            : language === 'hi'
            ? `स्वास्थ्य अपडेट प्राप्त: ${event.type}`
            : `Health Update Received: ${event.type}`
        );
      }
    },
  });

  // Modals state
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isAshaChatModalOpen, setIsAshaChatModalOpen] = useState(false);
  const [isBookAppointmentOpen, setIsBookAppointmentOpen] = useState(false);
  const [isMedicineReminderOpen, setIsMedicineReminderOpen] = useState(false);
  const [isHealthRecordsOpen, setIsHealthRecordsOpen] = useState(false);
  const [isLabReportsOpen, setIsLabReportsOpen] = useState(false);
  const [isHealthTipsOpen, setIsHealthTipsOpen] = useState(false);
  const [isNearbyServicesOpen, setIsNearbyServicesOpen] = useState(false);

  // 108 Emergency Simulator
  const [etaMins, setEtaMins] = useState(8);

  // ASHA Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'ASHA Sunita', text: 'Namaste Roshan! How are you feeling today? Remember your ANC checkup on 15 May.', time: '09:15 AM' },
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Appointment Form State
  const [aptType, setAptType] = useState('ANC Checkup');
  const [aptDate, setAptDate] = useState('2026-05-18');
  const [aptTime, setAptTime] = useState('10:00 AM');

  const lang = t[language];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const patientName = user?.user_metadata?.full_name || 'Roshan Sahani';
  const abhaId = '91-8402-1928-3012';

  // 108 Ambulance ETA Timer
  useEffect(() => {
    let timer: any;
    if (isEmergencyModalOpen && etaMins > 1) {
      timer = setInterval(() => {
        setEtaMins((prev) => Math.max(1, prev - 1));
      }, 10000);
    }
    return () => clearInterval(timer);
  }, [isEmergencyModalOpen, etaMins]);

  // Trigger 108 Emergency
  const handleTrigger108Emergency = async () => {
    setIsEmergencyModalOpen(true);
    setEtaMins(8);

    const timestamp = new Date().toISOString();
    const mockReferralId = 'ref-patient-' + Math.floor(1000 + Math.random() * 9000);

    const emergencyPayload = {
      id: mockReferralId,
      patient_id: 'p-patient-101',
      patient_name: patientName,
      age: 28,
      gender: 'M' as const,
      village: 'Dhamangaon Sub-center',
      urgency: 'RED' as const,
      risk_score: 'RED' as const,
      symptoms: ['Patient-Initiated 108 Call', 'Acute Medical Emergency', 'High Pulse'],
      vitals: {
        bp_systolic: 140,
        bp_diastolic: 90,
        heart_rate: 110,
        spo2: 95,
        temperature: 99.1,
      },
      ai_summary: `PATIENT EMERGENCY CALL: Patient ${patientName} triggered 108 ALS Ambulance from Patient Portal.`,
      recommended_action: 'Dispatch 108 ALS Unit MH-14-EM-1084 immediately to Dhamangaon PHC Sub-center.',
      marathi_translation: 'रुग्णाने थेट १०८ रुग्णवाहिका मागवली आहे. धामणगाव उपकेंद्रावर रुग्णवाहिका पाठवा.',
      target_facility: 'Sub-District Hospital (SDH) Karjat - Emergency Unit',
      department: 'Emergency & Trauma Care',
      status: 'pending',
      created_at: timestamp,
      referring_worker: `Patient Self-Escalation (ABHA: ${abhaId})`,
      ambulance_dispatched: true,
      ambulance_eta_mins: 8,
    };

    // Save local Dexie backup
    try {
      await saveVisitOffline({
        name: patientName,
        symptoms: emergencyPayload.symptoms,
        vitals: emergencyPayload.vitals,
        risk_score: 'RED',
        ai_summary: emergencyPayload.ai_summary,
        recommended_action: emergencyPayload.recommended_action,
        marathi_translation: emergencyPayload.marathi_translation,
        sync_status: 'synced',
      });
    } catch (e) {
      console.warn('Dexie save visit info:', e);
    }

    // Broadcast to Doctor / Admin / ASHA dashboards live
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arogya-mock-red-alert', { detail: emergencyPayload }));
      window.dispatchEvent(new CustomEvent('arogya-patient-emergency', { detail: emergencyPayload }));
    }

    showToast(lang.emergencyTransmitted);
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const messageText = inputMsg.trim();
    const newMsg = {
      sender: 'You',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputMsg('');

    // Dispatch realtime request to assigned ASHA Sunita More
    try {
      await PatientAshaCommunicationService.requestAshaAssistance({
        patientId: patientUserId,
        ashaId: 'u-asha-101',
        requestType: 'GENERAL_ASSISTANCE',
        message: messageText,
      });
    } catch (err) {
      console.warn('Realtime assistance request dispatch notice:', err);
    }

    // Auto-reply simulation from ASHA Worker
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ASHA Sunita',
          text: language === 'mr'
            ? `नमस्ते ${patientName}! तुमचा संदेश मिळाला. मी धामणगाव प्रा.आ.कें. डॉक्टरांशी चर्चा करून तुम्हाला कळवते.`
            : language === 'hi'
            ? `नमस्ते ${patientName}! आपका संदेश मिल गया है। मैं धामणगांव प्राथमिक स्वास्थ्य केंद्र के डॉक्टर से समन्वय करके आपको बताती हूँ।`
            : `Thank you for reaching out, ${patientName}. I have noted your request and will coordinate with PHC Karjat doctor.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1500);
  };

  // Format date helper: 2026-05-18 -> 18 May 2026
  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Handle Book Appointment
  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedDate = formatDateDisplay(aptDate);

    const newAppointment: AppointmentItem = {
      id: 'apt-' + Date.now(),
      type: aptType,
      date: formattedDate,
      rawDate: aptDate,
      time: aptTime,
      doctorOrAsha: aptType.includes('Doctor') ? 'Dr. Amit Deshmukh (MO Karjat PHC)' : 'Sunita More (ASHA)',
      facility: 'Dhamangaon Sub-center / Karjat PHC',
      status: 'CONFIRMED',
      patientName: patientName,
    };

    const updatedList = [newAppointment, ...appointments];
    setAppointments(updatedList);

    // Persist to localStorage so other tabs and ASHA view see it
    try {
      localStorage.setItem('arogya_appointments', JSON.stringify(updatedList));
    } catch (err) {
      console.warn('LocalStorage error:', err);
    }

    const payload = {
      ...newAppointment,
      village: 'Dhamangaon (Ward 2)',
      details: `${newAppointment.type} • Booked via Patient Portal`,
      highRisk: newAppointment.type.includes('ANC'),
    };

    // 1. Same-window custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('arogya-new-appointment', {
          detail: payload,
        })
      );
    }

    // 2. Cross-tab BroadcastChannel (instant inter-tab communication)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('arogya_channel');
        bc.postMessage({
          type: 'NEW_APPOINTMENT',
          payload: payload,
        });
        setTimeout(() => bc.close(), 1000);
      }
    } catch (err) {
      console.warn('BroadcastChannel broadcast error:', err);
    }

    // 3. Database-Enforced Role Realtime Event Dispatch (Minimal, Zero Medical Data Leakage)
    try {
      RealtimeCommunicationService.fanoutEvent(
        {
          type: 'APPOINTMENT_BOOKED',
          actorId: user?.id || 'p-patient-101',
          actorRole: 'PATIENT',
          patientId: user?.id || 'p-patient-101',
          relatedEntityId: newAppointment.id,
          relatedEntityType: 'appointment',
        },
        [
          { recipientType: 'ASHA' },
          { recipientType: 'PHC' }
        ]
      ).catch((e) => console.warn('Realtime event publish notice:', e));
    } catch (err) {
      console.warn('Realtime communication publish error:', err);
    }

    setIsBookAppointmentOpen(false);

    // Toast with language support
    const successMsg = lang.bookingSuccess
      .replace('{date}', formattedDate)
      .replace('{time}', aptTime)
      .replace('{type}', aptType);

    showToast(successMsg);

    // Switch to appointments tab so user immediately sees their booked appointment
    setActiveTab('appointments');
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen pb-24 text-slate-900 font-sans shadow-2xl relative border-x border-slate-200 antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Mobile Status & Header Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 space-y-2">
        {/* User Greeting & Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="w-9 h-9 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs cursor-pointer"
            >
              RP
            </button>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight flex items-center gap-1">
                {lang.greeting.replace('{name}', patientName)}
              </h1>
              <p className="text-[11px] font-medium text-slate-500 leading-none mt-0.5">
                {lang.tagline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => showToast(lang.notificationsCount)}
              className="relative p-2 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                3
              </span>
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                type="button"
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>{language === 'mr' ? 'मराठी' : language === 'hi' ? 'हिंदी' : 'English'}</span>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>

              {showLanguageMenu && (
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-2xl shadow-xl border border-slate-200 py-1 z-50 animate-fadeIn">
                  <button
                    onClick={() => {
                      setLanguage('mr');
                      setShowLanguageMenu(false);
                      showToast(t.mr.languageSet);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-between cursor-pointer"
                  >
                    <span>मराठी</span>
                    {language === 'mr' && <span className="text-emerald-600 font-bold">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('hi');
                      setShowLanguageMenu(false);
                      showToast(t.hi.languageSet);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-between cursor-pointer"
                  >
                    <span>हिंदी</span>
                    {language === 'hi' && <span className="text-emerald-600 font-bold">✓</span>}
                  </button>
                  <button
                    onClick={() => {
                      setLanguage('en');
                      setShowLanguageMenu(false);
                      showToast(t.en.languageSet);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-between cursor-pointer"
                  >
                    <span>English</span>
                    {language === 'en' && <span className="text-emerald-600 font-bold">✓</span>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Container Content */}
      <div className="p-4 space-y-4">
        {/* ========================================================= */}
        {/* TAB 1: HOME */}
        {/* ========================================================= */}
        {activeTab === 'home' && (
          <>
            {/* HERO CARD: "Your Health Overview" */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden space-y-4">
              {/* Title & Subtitle */}
              <div className="relative z-10 space-y-1">
                <h2 className="text-lg font-black tracking-tight text-white">{lang.healthOverview}</h2>
                <p className="text-xs text-emerald-100 font-medium">{lang.overviewSubtitle}</p>
              </div>

              {/* 4 Glassmorphism Vitals Columns */}
              <div className="relative z-10 grid grid-cols-4 gap-2 pt-2 border-t border-white/20 text-center">
                {/* Heart Rate */}
                <div className="space-y-0.5">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">favorite</span>
                  <div className="text-sm font-black text-white leading-tight">72</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">{lang.bpm}</div>
                  <div className="text-[9px] text-emerald-200 font-medium">{lang.heartRate}</div>
                </div>

                {/* Blood Pressure */}
                <div className="space-y-0.5 border-l border-white/15 pl-1">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">water_drop</span>
                  <div className="text-sm font-black text-white leading-tight">120/80</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">{lang.mmhg}</div>
                  <div className="text-[9px] text-emerald-200 font-medium">{lang.bloodPressure}</div>
                </div>

                {/* Blood Sugar */}
                <div className="space-y-0.5 border-l border-white/15 pl-1">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">bloodtype</span>
                  <div className="text-sm font-black text-white leading-tight">98</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">{lang.mgdl}</div>
                  <div className="text-[9px] text-emerald-200 font-medium">{lang.bloodSugar}</div>
                </div>

                {/* Weight */}
                <div className="space-y-0.5 border-l border-white/15 pl-1">
                  <span className="material-symbols-outlined text-emerald-200 text-[18px]">medical_services</span>
                  <div className="text-sm font-black text-white leading-tight">65</div>
                  <div className="text-[9px] text-emerald-100 font-semibold uppercase">{lang.kg}</div>
                  <div className="text-[9px] text-emerald-200 font-medium">{lang.weight}</div>
                </div>
              </div>
            </div>

            {/* "Connect with Your ASHA" BANNER */}
            <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-3xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center border-2 border-emerald-400 shrink-0 shadow-sm">
                  AS
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-tight">
                    {lang.connectAsha}
                  </h3>
                  <p className="text-[10px] font-semibold text-emerald-800">
                    {lang.ashaRole}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAshaChatModalOpen(true)}
                className="bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-300 shadow-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                <span>{lang.contactAsha}</span>
              </button>
            </div>

            {/* QUICK ACTIONS (8 Rounded Cards Grid) */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">{lang.quickActions}</h3>

              <div className="grid grid-cols-4 gap-2.5">
                {/* 1. Contact ASHA */}
                <button
                  onClick={() => setIsAshaChatModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">support_agent</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.contactAsha}
                  </span>
                </button>

                {/* 2. Call Ambulance */}
                <button
                  onClick={handleTrigger108Emergency}
                  className="bg-white p-3 rounded-2xl border border-rose-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse">
                    <span className="material-symbols-outlined text-[24px]">airport_shuttle</span>
                  </div>
                  <span className="text-[11px] font-bold text-rose-700 leading-tight">
                    {lang.callAmbulance}
                  </span>
                </button>

                {/* 3. Book Appointment */}
                <button
                  onClick={() => setIsBookAppointmentOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">calendar_month</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.bookAppointment}
                  </span>
                </button>

                {/* 4. Medicine Reminder */}
                <button
                  onClick={() => setIsMedicineReminderOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">pill</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.medicineReminder}
                  </span>
                </button>

                {/* 5. Health Records */}
                <button
                  onClick={() => setIsHealthRecordsOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">post_add</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.healthRecords}
                  </span>
                </button>

                {/* 6. Lab Reports */}
                <button
                  onClick={() => setIsLabReportsOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">science</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.labReports}
                  </span>
                </button>

                {/* 7. Health Tips */}
                <button
                  onClick={() => setIsHealthTipsOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">lightbulb</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.healthTips}
                  </span>
                </button>

                {/* 8. Nearby Services */}
                <button
                  onClick={() => setIsNearbyServicesOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">location_on</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.nearbyServices}
                  </span>
                </button>
              </div>
            </div>

            {/* HEALTH INSIGHTS SECTION */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">{lang.healthInsights}</h3>
                <button
                  onClick={() => showToast(language === 'mr' ? 'संपूर्ण आरोग्य माहिती' : 'Viewing complete Health Analytics')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  {lang.viewAll}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Left Card: Health Score */}
                <div className="bg-emerald-50/60 p-4 rounded-3xl border border-emerald-200/80 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{lang.healthScoreGood}</h4>
                    <p className="text-[10px] font-medium text-slate-500">{lang.healthScoreSubtitle}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-black text-slate-900">
                        8.5<span className="text-xs text-slate-400 font-semibold">/10</span>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700">{lang.healthScore}</div>
                    </div>

                    {/* Progress Gauge */}
                    <div className="relative w-12 h-12 shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#d1fae5"
                          strokeWidth="3.8"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="4"
                          strokeDasharray="85, 100"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Right Stack: Trackers */}
                <div className="bg-white p-3 rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        directions_walk
                      </span>
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">{lang.walk}</div>
                        <div className="text-[9px] text-slate-500 font-medium">{lang.stepsCount}</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">chevron_right</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-500 text-[18px]">
                        local_drinking
                      </span>
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">{lang.water}</div>
                        <div className="text-[9px] text-slate-500 font-medium">{lang.glassesCount}</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">chevron_right</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-purple-500 text-[18px]">
                        bedtime
                      </span>
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">{lang.sleep}</div>
                        <div className="text-[9px] text-slate-500 font-medium">{lang.hrsCount}</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
              </div>
            </div>

            {/* EMERGENCY SERVICES SECTION */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">{lang.emergencyServices}</h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Call Ambulance */}
                <button
                  onClick={handleTrigger108Emergency}
                  className="bg-rose-50/90 hover:bg-rose-100 p-3.5 rounded-3xl border border-rose-200/90 flex items-center justify-between transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <span className="material-symbols-outlined text-[22px]">call</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-rose-900 leading-tight">{lang.callAmbulance}</h4>
                      <p className="text-[10px] font-bold text-rose-700">{lang.emergency247}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">chevron_right</span>
                </button>

                {/* Emergency Helpline */}
                <a
                  href="tel:108"
                  className="bg-rose-50/90 hover:bg-rose-100 p-3.5 rounded-3xl border border-rose-200/90 flex items-center justify-between transition-all cursor-pointer text-left active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                      <span className="material-symbols-outlined text-[22px]">notifications_active</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-rose-900 leading-tight">{lang.emergencyHelpline}</h4>
                      <p className="text-[10px] font-bold text-rose-700">108 / 104</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">chevron_right</span>
                </a>
              </div>
            </div>

            {/* UPCOMING APPOINTMENTS PREVIEW ON HOME */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">{lang.upcomingAppointments}</h3>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  {lang.viewAll}
                </button>
              </div>

              {appointments.length > 0 ? (
                <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Date Box */}
                    <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-center shrink-0">
                      <span className="text-base font-black text-emerald-800 leading-none">
                        {appointments[0].date.split(' ')[0]}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">
                        {appointments[0].date.split(' ')[1] || 'MAY'}
                      </span>
                    </div>

                    {/* Appointment Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-slate-900">{appointments[0].type}</h4>
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                          {lang.confirmed}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                        {appointments[0].time} • {appointments[0].doctorOrAsha}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">{appointments[0].facility}</p>
                    </div>
                  </div>

                  {/* Call Button */}
                  <button
                    onClick={() => showToast(`Calling ${appointments[0].doctorOrAsha}...`)}
                    className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 flex items-center justify-center shrink-0 cursor-pointer transition-colors border border-slate-200"
                  >
                    <span className="material-symbols-outlined text-[20px]">call</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs text-center text-xs text-slate-500 font-semibold py-6">
                  {lang.noAppointments}
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: APPOINTMENTS (FULL DIRECTORY & BOOKING) */}
        {/* ========================================================= */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">{lang.yourAppointments}</h2>
                  <p className="text-xs text-slate-500">{lang.appointmentsSubtitle}</p>
                </div>
                <button
                  onClick={() => setIsBookAppointmentOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>{lang.bookNew}</span>
                </button>
              </div>

              <div className="space-y-3">
                {appointments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs font-medium">
                    {lang.noAppointments}
                  </div>
                ) : (
                  appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-md">
                            {lang.confirmed}
                          </span>
                          <h3 className="text-sm font-extrabold text-slate-900 mt-1">{apt.type}</h3>
                        </div>
                        <span className="text-xs font-black text-emerald-800 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-xs">
                          {apt.date}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium">
                        {language === 'mr' ? 'सोबत:' : 'With'} <strong>{apt.doctorOrAsha}</strong> • {apt.time}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-200/50 text-[10px] text-slate-500">
                        <span>{apt.facility}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setAppointments(appointments.filter((a) => a.id !== apt.id));
                              showToast(language === 'mr' ? 'भेट रद्द केली' : 'Appointment Cancelled');
                            }}
                            className="text-rose-600 hover:underline font-bold"
                          >
                            {lang.cancelAppointment}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: REPORTS */}
        {/* ========================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">{lang.diagnosticReports}</h2>
                <p className="text-xs text-slate-500">{lang.reportsSubtitle}</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">CBC Complete Blood Count</div>
                    <div className="text-[10px] text-emerald-700 font-semibold">12 May 2024 • Normal (Hb: 12.5 g/dL)</div>
                  </div>
                  <button
                    onClick={() => showToast(language === 'mr' ? 'सीबीसी अहवाल डाऊनलोड होत आहे...' : 'Downloading CBC Report PDF...')}
                    className="text-xs font-bold text-emerald-600 hover:underline bg-white px-2.5 py-1 rounded-lg border border-emerald-200"
                  >
                    {lang.download}
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">Fasting Blood Sugar Test</div>
                    <div className="text-[10px] text-emerald-700 font-semibold">08 May 2024 • 98 mg/dL (Normal)</div>
                  </div>
                  <button
                    onClick={() => showToast(language === 'mr' ? 'शुगर अहवाल डाऊनलोड होत आहे...' : 'Downloading Sugar Report PDF...')}
                    className="text-xs font-bold text-emerald-600 hover:underline bg-white px-2.5 py-1 rounded-lg border border-emerald-200"
                  >
                    {lang.download}
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">ANC Routine Urine Screen</div>
                    <div className="text-[10px] text-emerald-700 font-semibold">02 May 2024 • Clear / Sugar Nil</div>
                  </div>
                  <button
                    onClick={() => showToast(language === 'mr' ? 'युरिन अहवाल डाऊनलोड होत आहे...' : 'Downloading Urine Report PDF...')}
                    className="text-xs font-bold text-emerald-600 hover:underline bg-white px-2.5 py-1 rounded-lg border border-emerald-200"
                  >
                    {lang.download}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PROFILE */}
        {/* ========================================================= */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xl flex items-center justify-center shadow-md">
                  RP
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">{patientName}</h2>
                  <p className="text-xs text-slate-500 font-medium">ABHA ID: {abhaId}</p>
                  <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1 border border-emerald-200">
                    {lang.pmjayActive}
                  </span>
                </div>
              </div>

              {/* Personal Info & Work Association */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2 text-xs text-slate-600">
                <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">
                  {lang.personalInfo}
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">location_on</span>
                    <span>{lang.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">support_agent</span>
                    <span className="font-semibold">{lang.assignedAsha}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">local_hospital</span>
                    <span>{lang.primaryCenter}</span>
                  </div>
                </div>
              </div>

              {/* Language Switcher in Profile */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">translate</span>
                  <span className="font-bold text-slate-800">
                    {language === 'mr' ? 'भाषा: मराठी' : 'Language: English'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const nextLang = language === 'mr' ? 'en' : 'mr';
                    setLanguage(nextLang);
                    showToast(nextLang === 'mr' ? t.mr.languageSet : t.en.languageSet);
                  }}
                  className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-emerald-700 shadow-xs hover:bg-slate-100 cursor-pointer"
                >
                  {language === 'mr' ? 'Switch to English' : 'मराठी निवडा'}
                </button>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>{lang.signOut}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: 108 EMERGENCY AMBULANCE TRACKER MODAL */}
      {/* ========================================================= */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-300 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                <h3 className="text-lg font-black text-rose-900">108 ALS Ambulance En-Route</h3>
              </div>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 text-white p-5 rounded-2xl border border-rose-800/80 space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                <span>Live GPS Telemetry Active</span>
              </div>

              <div className="text-4xl font-black text-white tracking-tight">
                {etaMins} <span className="text-lg font-bold text-rose-300">MINS ETA</span>
              </div>

              <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-xs text-slate-200 space-y-1">
                <div>
                  <strong>Ambulance Unit:</strong> MH-14-EM-1084 (ALS)
                </div>
                <div>
                  <strong>Driver:</strong> Ramesh Shinde (ID: 108-MH-402)
                </div>
              </div>

              <div className="text-[11px] text-emerald-400 font-semibold">
                ✓ PHC Medical Officer & Emergency Room Pre-Notified Live
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="tel:108"
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-3 rounded-2xl shadow-md text-center flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                <span>Call Driver Directly</span>
              </a>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-3 rounded-2xl cursor-pointer"
              >
                Minimize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ASHA CHAT MODAL */}
      {/* ========================================================= */}
      {isAshaChatModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center border border-emerald-400 shadow-xs">
                  AS
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">ASHA Sunita More</h3>
                  <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsAshaChatModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Chat Messages */}
            <div className="h-48 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-2xl max-w-[85%] space-y-0.5 ${
                    msg.sender === 'You'
                      ? 'bg-emerald-600 text-white ml-auto rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <p>{msg.text}</p>
                  <div className="text-[8px] opacity-70 text-right">{msg.time}</div>
                </div>
              ))}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendChatMessage} className="flex gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder={language === 'mr' ? 'आशा ताईंना संदेश लिहा...' : 'Type a message to ASHA...'}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
              />
              <button
                type="submit"
                className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: BOOK APPOINTMENT MODAL */}
      {/* ========================================================= */}
      {isBookAppointmentOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">{lang.bookAppointmentModalTitle}</h3>
              <button
                onClick={() => setIsBookAppointmentOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang.consultType}</label>
                <select
                  value={aptType}
                  onChange={(e) => setAptType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                >
                  <option value="ANC Checkup">ANC Routine Checkup (गरोदर माता तपासणी)</option>
                  <option value="Routine Doctor Consult">Routine Doctor Consult (PHC Karjat)</option>
                  <option value="ASHA Home Visit">ASHA Home Visit (गृहभेट तपासणी)</option>
                  <option value="Immunization (Child)">Child Immunization (लसीकरण)</option>
                  <option value="NCD Screening (BP/Sugar)">NCD Screening (रक्तदाब/साखर तपासणी)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang.preferredDate}</label>
                <input
                  type="date"
                  required
                  value={aptDate}
                  onChange={(e) => setAptDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{lang.preferredTime}</label>
                <select
                  value={aptTime}
                  onChange={(e) => setAptTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                >
                  <option value="10:00 AM">10:00 AM (Morning)</option>
                  <option value="11:30 AM">11:30 AM (Morning)</option>
                  <option value="02:00 PM">02:00 PM (Afternoon)</option>
                  <option value="04:30 PM">04:30 PM (Evening)</option>
                </select>
              </div>

              <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 font-medium">
                {lang.ashaAssignedNotice}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBookAppointmentOpen(false)}
                  className="px-3 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {lang.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {lang.confirmBooking}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: MEDICINE REMINDER MODAL */}
      {/* ========================================================= */}
      {isMedicineReminderOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">{lang.medicineReminder}</h3>
              <button
                onClick={() => setIsMedicineReminderOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-slate-900">Tab Iron & Folic Acid (IFA)</div>
                  <div className="text-[10px] text-blue-700">1 Tablet Daily after lunch</div>
                </div>
                <span className="text-[10px] font-bold text-blue-800 bg-white px-2 py-1 rounded-xl border border-blue-200">
                  01:00 PM
                </span>
              </div>

              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex justify-between items-center">
                <div>
                  <div className="font-extrabold text-slate-900">Tab Calcium 500mg</div>
                  <div className="text-[10px] text-blue-700">1 Tablet Daily after dinner</div>
                </div>
                <span className="text-[10px] font-bold text-blue-800 bg-white px-2 py-1 rounded-xl border border-blue-200">
                  08:30 PM
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: HEALTH RECORDS MODAL */}
      {/* ========================================================= */}
      {isHealthRecordsOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">{lang.abhaCard}</h3>
              <button
                onClick={() => setIsHealthRecordsOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">ANC Health Card</div>
                <div className="text-[10px] text-slate-500">Sub-center Dhamangaon • Verified</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">Immunization Record</div>
                <div className="text-[10px] text-slate-500">TT Vaccine Dose 1 Completed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: LAB REPORTS MODAL */}
      {/* ========================================================= */}
      {isLabReportsOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">{lang.labReports}</h3>
              <button
                onClick={() => setIsLabReportsOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">Hemoglobin (Hb) Test</div>
                  <div className="text-[10px] text-emerald-700">12.5 g/dL • Normal</div>
                </div>
                <button
                  onClick={() => showToast('Downloading Hb Report...')}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  Download
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">Fasting Blood Sugar</div>
                  <div className="text-[10px] text-emerald-700">98 mg/dL • Normal</div>
                </div>
                <button
                  onClick={() => showToast('Downloading Sugar Report...')}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: HEALTH TIPS MODAL */}
      {/* ========================================================= */}
      {isHealthTipsOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">{lang.healthTips}</h3>
              <button
                onClick={() => setIsHealthTipsOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                <div className="font-bold text-amber-900">Hydration & Nutrition</div>
                <p className="text-amber-800">
                  Drink at least 8-10 glasses of clean water daily and include green leafy vegetables in your diet.
                </p>
                <div className="text-[10px] font-semibold text-amber-700 italic pt-1 border-t border-amber-200">
                  मराठी: दररोज किमान ८-१० पेले पाणी प्या आणि हिरव्या पालेभाज्या खा.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 8: NEARBY SERVICES MODAL */}
      {/* ========================================================= */}
      {isNearbyServicesOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-black text-slate-900">{lang.nearbyServices}</h3>
              <button
                onClick={() => setIsNearbyServicesOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">Dhamangaon Sub-center</div>
                <div className="text-[10px] text-slate-500">0.8 km away • Open 24x7</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-900">Primary Health Centre (PHC) Karjat</div>
                <div className="text-[10px] text-slate-500">4.2 km away • OPD Active</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* ========================================================= */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between z-40 shadow-2xl">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'home' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span>{lang.home}</span>
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'appointments' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">calendar_today</span>
          <span>{lang.appointments}</span>
        </button>

        {/* Center Floating Action Button (FAB) */}
        <button
          onClick={() => setIsBookAppointmentOpen(true)}
          className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg -mt-5 border-4 border-slate-50 transition-transform active:scale-95 cursor-pointer"
          title="Book Appointment"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'reports' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">bar_chart</span>
          <span>{lang.reports}</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'profile' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span>{lang.profile}</span>
        </button>
      </div>
    </div>
  );
};
