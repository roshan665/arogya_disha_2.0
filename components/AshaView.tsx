import React, { useState, useEffect } from 'react';
import { useAshaDashboard } from '../lib/hooks/useAshaDashboard';
import { createClient } from '../lib/supabase/client';
import { saveVisitOffline, RiskScore } from '../lib/db';
import { useRoleRealtimeCommunication } from '../lib/hooks/useRoleRealtimeCommunication';
import { RealtimeCommunicationService } from '../lib/services/RealtimeCommunicationService';
import { PatientAshaCommunicationService, AssistanceRequestStatus } from '../lib/services/PatientAshaCommunicationService';
import { HealthcareJourneyLoopService } from '../lib/services/HealthcareJourneyLoopService';
import { RoleBasedMessagingService } from '../lib/services/RoleBasedMessagingService';
import { useRoleBasedNotifications } from '../lib/hooks/useRoleBasedNotifications';
import { NotificationCenterModal } from './NotificationCenterModal';
import { OnboardingProfileService } from '../lib/services/OnboardingProfileService';
import { ProfileSettingsModal } from './ProfileSettingsModal';

interface AshaViewProps {
  isOffline: boolean;
  onToggleOffline: () => void;
  isSyncing: boolean;
  onSync: () => void;
  lastSyncedText: string;
  user?: any;
  onSignOut?: () => void;
}

interface PatientItem {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  village: string;
  ward: string;
  phone: string;
  abhaId: string;
  category: 'ANC' | 'PNC' | 'NCD' | 'Child' | 'General';
  riskScore: 'RED' | 'YELLOW' | 'GREEN';
  lastVisit: string;
  nextDueDate: string;
  conditions: string[];
  vitals: {
    bp: string;
    pulse: number;
    spo2: number;
    hb?: number;
    sugar?: number;
  };
  notes: string;
}

const INITIAL_PATIENTS: PatientItem[] = [];

const t = {
  en: {
    greeting: 'Namaste, Sunita! 👋',
    role: 'ASHA Worker • Dhamangaon PHC',
    languageSet: 'Language set to English',
    impactTitle: 'Your Impact Today',
    impactSubtitle: 'You are making a difference!',
    familiesVisited: 'Families Visited',
    patientsAssisted: 'Patients Assisted',
    followUps: 'Follow-ups Done',
    healthAlert: 'Health Alert',
    healthAlertMsg: 'Ensure no stagnant water to prevent Dengue.',
    quickActions: 'Quick Actions',
    newHouseVisit: 'New House Visit',
    addPatient: 'Add Patient',
    teleconsult: 'Teleconsult Request',
    triage: 'Health Triage',
    followUpList: 'Follow-up Patients',
    referralTrack: 'Referral Tracking',
    medAvailability: 'Medicine Stock',
    emergency: 'Emergency 108',
    schedule: "Today's Schedule",
    viewAll: 'View All',
    loading: 'Loading schedule...',
    noTasks: 'No tasks pending! 🌿',
    highRisk: 'High Risk',
    updates: 'Important Updates',
    polioCampaign: 'Pulse Polio Campaign',
    polioDate: 'Next drive on 15 May 2026',
    home: 'Home',
    patients: 'Patients',
    reports: 'Reports',
    profile: 'Profile',
    comingSoon: 'Coming Soon',
    comingSoonMsg: 'This section is currently under development.',
    // Patients tab
    patientDirectory: 'Assigned Patients',
    patientSubtitle: 'Dhamangaon Sub-center Directory',
    searchPlaceholder: 'Search by name, ABHA ID, ward...',
    allFilter: 'All',
    ancFilter: 'High Risk / ANC',
    pncFilter: 'PNC Mothers',
    ncdFilter: 'Chronic / NCD',
    childFilter: 'Immunization Due',
    addNewPatient: '+ Register Patient',
    noPatientsFound: 'No patients found matching your search.',
    vitalsLastChecked: 'Vitals Checked',
    recordVisit: 'Record Visit',
    viewDetails: 'View Details',
    call: 'Call',
    // Reports tab
    monthlyReport: 'Monthly Work Report',
    performanceOverview: 'Performance & Target Summary',
    may2026: 'May 2026 Summary',
    targetProgress: 'Monthly Target Progress',
    targetCompleted: 'Visits completed (85%)',
    incentiveSummary: 'ASHA Honorarium & Incentives',
    totalEarned: 'Total Earned This Month',
    ancIncentive: 'ANC / JSY Tracking Incentives',
    immIncentive: 'Immunization Follow-up Incentives',
    ncdIncentive: 'NCD Surveys & Screening',
    teleconsultIncentive: 'Teleconsultation Facilitation',
    exportReport: 'Download Monthly Report (PDF)',
    healthSurveillance: 'Village Health Surveillance',
    dengueSurv: 'Dengue/Malaria Fever Cases Surveyed',
    malnutritionSurv: 'SAM/MAM Children Monitored',
    waterSources: 'Chlorinated Water Sources Inspected',
    // Profile tab
    profileHeader: 'ASHA Worker Profile',
    ashaId: 'ASHA ID: ASHA-MH-2024-884',
    onDuty: 'On Duty • Active',
    workAssignment: 'Work Assignment Details',
    subCenter: 'Sub-Center: Dhamangaon',
    parentPhc: 'Parent PHC: Karjat PHC, Raigad',
    assignedPopulation: 'Assigned Population: 1,250 residents (312 Households)',
    supervisor: 'Supervisor ANM: Rekha Patil (+91 98221 00123)',
    moDoctor: 'Medical Officer: Dr. Amit Deshmukh (MO Karjat PHC)',
    appSettings: 'Application & Offline Settings',
    offlineMode: 'Offline Mode',
    offlineStatusText: 'Works 100% offline without mobile network',
    offlineSync: 'Force Sync Cloud Database',
    downloadGuidelines: 'Download Medical Protocols (PDF)',
    contactHelpline: 'ASHA Helpline & 108 Emergency Direct',
    logoutTitle: 'Account Security',
    logoutButton: 'Sign Out / Log Out',
    logoutConfirm: 'Are you sure you want to sign out?',
    // Modals
    saveOfflineSuccess: 'Visit successfully recorded and queued for sync!',
    patientRegisteredSuccess: 'New patient registered successfully!',
    emergencyDispatched: '108 ALS Ambulance Dispatched to Dhamangaon!',
    teleconsultScheduled: 'Teleconsultation request sent to Dr. Deshmukh!',
    stockUpdated: 'Medicine stock checklist updated successfully!'
  },
  mr: {
    greeting: 'नमस्ते, आशा! 👋',
    role: 'आशा कार्यकर्ती • धामणगाव प्रा.आ.कें.',
    languageSet: 'भाषा बदलली: मराठी',
    impactTitle: 'तुमचा आजचा प्रभाव',
    impactSubtitle: 'तुम्ही चांगला बदल घडवत आहात!',
    familiesVisited: 'घरोघरी भेटी',
    patientsAssisted: 'रुग्ण सहाय्य',
    followUps: 'पाठपुरावा पूर्ण',
    healthAlert: 'आरोग्य इशारा',
    healthAlertMsg: 'डेंग्यू प्रतिबंधासाठी पाणी साचणार नाही याची काळजी घ्या.',
    quickActions: 'जलद कृती',
    newHouseVisit: 'नवीन गृहभेट',
    addPatient: 'रुग्ण नोंदणी',
    teleconsult: 'टेलिकन्सल्ट विनंती',
    triage: 'आरोग्य तपासणी',
    followUpList: 'पाठपुरावा रुग्ण',
    referralTrack: 'संदर्भ सेवा मागोवा',
    medAvailability: 'औषध साठा',
    emergency: '१०८ आणीबाणी',
    schedule: "आजचे वेळापत्रक",
    viewAll: 'सर्व पहा',
    loading: 'वेळापत्रक लोड होत आहे...',
    noTasks: 'कोणतेही काम प्रलंबित नाही! 🌿',
    highRisk: 'अतिधोका',
    updates: 'महत्त्वाचे अपडेट्स',
    polioCampaign: 'पल्स पोलिओ मोहीम',
    polioDate: 'पुढील मोहीम १५ मे २०२६ रोजी',
    home: 'मुख्यपृष्ठ',
    patients: 'रुग्ण यादी',
    reports: 'अहवाल',
    profile: 'प्रोफाइल',
    comingSoon: 'लवकरच येत आहे',
    comingSoonMsg: 'हा विभाग सध्या विकसित होत आहे.',
    // Patients tab
    patientDirectory: 'नोंदणीकृत रुग्ण यादी',
    patientSubtitle: 'धामणगाव उपकेंद्र रुग्ण माहिती',
    searchPlaceholder: 'नाव, आभा आयडी किंवा गल्ली शोधा...',
    allFilter: 'सर्व',
    ancFilter: 'अतिधोका / गरोदर माता',
    pncFilter: 'प्रसूती पश्चात माता',
    ncdFilter: 'दीर्घकालीन आजार (NCD)',
    childFilter: 'लसीकरण प्रलंबित बालके',
    addNewPatient: '+ नवीन रुग्ण नोंदणी',
    noPatientsFound: 'शोधलेले रुग्ण सापडले नाहीत.',
    vitalsLastChecked: 'तपासणी दिनांक',
    recordVisit: 'भेट नोंदवा',
    viewDetails: 'माहिती पहा',
    call: 'कॉल करा',
    // Reports tab
    monthlyReport: 'मासिक कार्य अहवाल',
    performanceOverview: 'कामगिरी आणि उद्दिष्ट सारांश',
    may2026: 'मे २०२६ सारांश',
    targetProgress: 'मासिक उद्दिष्ट प्रगती',
    targetCompleted: 'भेटी पूर्ण (८५%)',
    incentiveSummary: 'आशा मानधन आणि प्रोत्साहन भत्ता',
    totalEarned: 'या महिन्यातील एकूण मानधन',
    ancIncentive: 'गरोदर माता तपासणी भत्ता (JSY)',
    immIncentive: 'लसीकरण पाठपुरावा भत्ता',
    ncdIncentive: 'असंक्रामक रोग (NCD) सर्व्हेक्षण',
    teleconsultIncentive: 'टेलिकन्सल्टेशन सहाय्य भत्ता',
    exportReport: 'मासिक अहवाल डाऊनलोड करा (PDF)',
    healthSurveillance: 'गाव आरोग्य सर्व्हेक्षण',
    dengueSurv: 'डेंग्यू / मलेरिया ताप रुग्ण तपासणी',
    malnutritionSurv: 'कुपोषित (SAM/MAM) बालके निरीक्षण',
    waterSources: 'क्लोरीनेशन केलेल्या विहिरी / पाण्याच्या टाक्या',
    // Profile tab
    profileHeader: 'आशा कार्यकर्ती प्रोफाइल',
    ashaId: 'आशा नोंदणी आयडी: ASHA-MH-2024-884',
    onDuty: 'कर्तव्यावर उपस्थित • कार्यरत',
    workAssignment: 'कार्यक्षेत्र तपशील',
    subCenter: 'उपकेंद्र: धामणगाव',
    parentPhc: 'प्राथमिक आरोग्य केंद्र: कर्जत प्रा.आ.कें., रायगड',
    assignedPopulation: 'नियुक्त लोकसंख्या: १,२५० नागरिक (३१२ कुटुंबे)',
    supervisor: 'पर्यवेक्षक एएनएम: रेखा पाटील (+91 98221 00123)',
    moDoctor: 'वैद्यकीय अधिकारी: डॉ. अमित देशमुख (प्रा.आ.कें. कर्जत)',
    appSettings: 'ॲप्लिकेशन आणि ऑफलाइन सेटिंग्ज',
    offlineMode: 'ऑफलाइन मोड',
    offlineStatusText: 'मोबाईल नेटवर्क नसतानाही १००% काम करते',
    offlineSync: 'क्लाउड डेटा सिंक करा',
    downloadGuidelines: 'आरोग्य मार्गदर्शक पुस्तिका (PDF)',
    contactHelpline: 'आशा हेल्पलाइन व १०८ रुग्णवाहिका थेट संपर्क',
    logoutTitle: 'खाते सुरक्षा',
    logoutButton: 'लॉग आउट करा (Sign Out)',
    logoutConfirm: 'तुम्हाला खात्यातून बाहेर पडायचे आहे का?',
    // Modals
    saveOfflineSuccess: 'गृहभेट यशस्वीरित्या नोंदवली गेली व सिंकसाठी तयार आहे!',
    patientRegisteredSuccess: 'नवीन रुग्णाची नोंदणी यशस्वीरित्या झाली!',
    emergencyDispatched: '१०८ रुग्णवाहिका धामणगावसाठी रवाना केली आहे!',
    teleconsultScheduled: 'डॉ. देशमुख यांच्याकडे टेलिकन्सल्टेशन विनंती पाठवली!',
    stockUpdated: 'औषध साठा यशस्वीरित्या अद्यतनित केला!'
  },
  hi: {
    greeting: 'नमस्ते, आशा! 👋',
    role: 'आशा कार्यकर्ता • धामणगांव पीएचसी',
    languageSet: 'भाषा बदली: हिंदी',
    impactTitle: 'आज का आपका प्रभाव',
    impactSubtitle: 'आप सकारात्मक बदलाव ला रही हैं!',
    familiesVisited: 'गृह भेंट परिवार',
    patientsAssisted: 'मरीज़ सहायता',
    followUps: 'फॉलो-अप पूर्ण',
    healthAlert: 'स्वास्थ्य चेतावनी',
    healthAlertMsg: 'डेंगू से बचाव के लिए पानी जमा न होने दें।',
    quickActions: 'त्वरित सेवाएं',
    newHouseVisit: 'नई गृह भेंट',
    addPatient: 'मरीज़ पंजीकरण',
    teleconsult: 'टेलीकंसल्ट अनुरोध',
    triage: 'स्वास्थ्य जांच (ट्राइएज)',
    followUpList: 'फॉलो-अप मरीज़',
    referralTrack: 'रेफरल ट्रैकिंग',
    medAvailability: 'दवा स्टॉक',
    emergency: '108 आपातकाल',
    schedule: "आज की कार्यसूची",
    viewAll: 'सभी देखें',
    loading: 'कार्यसूची लोड हो रही है...',
    noTasks: 'कोई कार्य लंबित नहीं है! 🌿',
    highRisk: 'उच्च जोखिम',
    updates: 'महत्वपूर्ण अपडेट्स',
    polioCampaign: 'पल्स पोलियो अभियान',
    polioDate: 'अगला अभियान 15 मई 2026',
    home: 'होम',
    patients: 'मरीज़ सूची',
    reports: 'रिपोर्ट्स',
    profile: 'प्रोफाइल',
    comingSoon: 'जल्द आ रहा है',
    comingSoonMsg: 'यह अनुभाग वर्तमान में प्रगति पर है।',
    // Patients tab
    patientDirectory: 'पंजीकृत मरीज़ निर्देशिका',
    patientSubtitle: 'धामणगांव उप-केंद्र मरीज़ रिकॉर्ड',
    searchPlaceholder: 'नाम, आभा आईडी या वार्ड खोजें...',
    allFilter: 'सभी',
    ancFilter: 'उच्च जोखिम / गर्भवती माताएं',
    pncFilter: 'प्रसवोत्तर माताएं (PNC)',
    ncdFilter: 'दीर्घकालिक बीमारी (NCD)',
    childFilter: 'टीकाकरण बाकी बच्चे',
    addNewPatient: '+ नया मरीज़ जोड़ें',
    noPatientsFound: 'खोज के अनुसार कोई मरीज़ नहीं मिला।',
    vitalsLastChecked: 'अंतिम जांच',
    recordVisit: 'भेंट दर्ज करें',
    viewDetails: 'विवरण देखें',
    call: 'कॉल करें',
    // Reports tab
    monthlyReport: 'मासिक कार्य रिपोर्ट',
    performanceOverview: 'प्रदर्शन व लक्ष्य सारांश',
    may2026: 'मई 2026 सारांश',
    targetProgress: 'मासिक लक्ष्य प्रगति',
    targetCompleted: 'भेंट पूर्ण (85%)',
    incentiveSummary: 'आशा मानदेय व प्रोत्साहन राशि',
    totalEarned: 'इस महीने कुल अर्जित राशि',
    ancIncentive: 'गर्भवती माता (JSY) प्रोत्साहन',
    immIncentive: 'टीकाकरण फॉलो-अप प्रोत्साहन',
    ncdIncentive: 'NCD स्क्रीनिंग व सर्वे',
    teleconsultIncentive: 'टेलीकंसल्टेशन सुविधा प्रोत्साहन',
    exportReport: 'मासिक रिपोर्ट डाउनलोड करें (PDF)',
    healthSurveillance: 'ग्राम स्वास्थ्य निगरानी',
    dengueSurv: 'डेंगू / मलेरिया बुखार जांच',
    malnutritionSurv: 'कुपोषित बच्चे (SAM/MAM) निगरानी',
    waterSources: 'क्लोरीनेटेड पेयजल स्रोत निरीक्षण',
    // Profile tab
    profileHeader: 'आशा कार्यकर्ता प्रोफाइल',
    ashaId: 'आशा आईडी: ASHA-MH-2024-884',
    onDuty: 'ड्यूटी पर सक्रिय',
    workAssignment: 'कार्य आवंटन विवरण',
    subCenter: 'उप-केंद्र: धामणगांव',
    parentPhc: 'मूल पीएचसी: कर्जत पीएचसी, रायगढ़',
    assignedPopulation: 'आवंटित जनसंख्या: 1,250 नागरिक (312 परिवार)',
    supervisor: 'पर्यवेक्षक एएनएम: रेखा पाटिल (+91 98221 00123)',
    moDoctor: 'चिकित्सा अधिकारी: डॉ. अमित देशमुख (पीएचसी कर्जत)',
    appSettings: 'ऐप व ऑफलाइन सेटिंग्स',
    offlineMode: 'ऑफलाइन मोड',
    offlineStatusText: 'मोबाइल नेटवर्क के बिना भी 100% कार्य करता है',
    offlineSync: 'क्लाउड डेटा सिंक करें',
    downloadGuidelines: 'स्वास्थ्य दिशानिर्देश (PDF)',
    contactHelpline: 'आशा हेल्पलाइन व 108 एम्बुलेंस सीधा संपर्क',
    logoutTitle: 'खाता सुरक्षा',
    logoutButton: 'लॉग आउट करें (Sign Out)',
    logoutConfirm: 'क्या आप लॉग आउट करना चाहते हैं?',
    // Modals
    saveOfflineSuccess: 'गृह भेंट सफलतापूर्वक दर्ज की गई और सिंक के लिए कतारबद्ध है!',
    patientRegisteredSuccess: 'नया मरीज़ सफलतापूर्वक पंजीकृत हुआ!',
    emergencyDispatched: '108 आपातकालीन एम्बुलेंस धामणगांव के लिए रवाना!',
    teleconsultScheduled: 'डॉ. देशमुख को टेलीकंसल्टेशन अनुरोध भेजा गया!',
    stockUpdated: 'दवा स्टॉक चेकलिस्ट सफलतापूर्वक अपडेट हुई!'
  }
};

export const AshaView: React.FC<AshaViewProps> = ({
  isOffline,
  onToggleOffline,
  isSyncing,
  onSync,
  lastSyncedText,
  user,
  onSignOut,
}) => {
  const ashaUserId = user?.id || user?.user_id || 'asha-sunita';
  const [language, setLanguage] = useState<'mr' | 'hi' | 'en'>('en');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'patients' | 'reports' | 'profile'>('home');

  // Patients Tab State
  const [patientsList, setPatientsList] = useState<PatientItem[]>(INITIAL_PATIENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'anc' | 'pnc' | 'ncd' | 'child'>('all');
  const [selectedPatientForDetails, setSelectedPatientForDetails] = useState<PatientItem | null>(null);

  // Modals state
  const [isNewVisitModalOpen, setIsNewVisitModalOpen] = useState(false);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isTriageModalOpen, setIsTriageModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isTeleconsultModalOpen, setIsTeleconsultModalOpen] = useState(false);
  const [isMedicineStockModalOpen, setIsMedicineStockModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  // 108 Emergency timer
  const [etaMins, setEtaMins] = useState(8);

  // Form states: New Visit
  const [visitPatientId, setVisitPatientId] = useState('');
  const [visitSystolic, setVisitSystolic] = useState('120');
  const [visitDiastolic, setVisitDiastolic] = useState('80');
  const [visitPulse, setVisitPulse] = useState('76');
  const [visitSpO2, setVisitSpO2] = useState('98');
  const [visitTemp, setVisitTemp] = useState('98.6');
  const [visitBloodSugar, setVisitBloodSugar] = useState('');
  const [visitSymptoms, setVisitSymptoms] = useState<string[]>([]);
  const [visitNotes, setVisitNotes] = useState('');
  const [visitIsHighRisk, setVisitIsHighRisk] = useState(false);

  // Form states: Register Patient
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState<'M' | 'F' | 'Other'>('F');
  const [regPhone, setRegPhone] = useState('');
  const [regWard, setRegWard] = useState('Ward 1');
  const [regCategory, setRegCategory] = useState<'ANC' | 'PNC' | 'NCD' | 'Child' | 'General'>('ANC');
  const [regAbha, setRegAbha] = useState('');

  // Form states: Triage
  const [triagePatientName, setTriagePatientName] = useState('');
  const [triageSymptoms, setTriageSymptoms] = useState<string[]>([]);
  const [triageRiskResult, setTriageRiskResult] = useState<RiskScore | null>(null);

  // Form states: Teleconsult
  const [telePatientName, setTelePatientName] = useState('');
  const [teleReason, setTeleReason] = useState('High BP Consultation');
  const [teleDoctor, setTeleDoctor] = useState('Dr. Amit Deshmukh (PHC Medical Officer)');

  // Form states: Medicine Stock
  const [ifaStock, setIfaStock] = useState(450);
  const [orsStock, setOrsStock] = useState(80);
  const [pcmStock, setPcmStock] = useState(300);
  const [zincStock, setZincStock] = useState(120);
  const [malariaKitStock, setMalariaKitStock] = useState(25);

  const lang = t[language];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const { schedule, loading } = useAshaDashboard(ashaUserId);
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [ashaProfile, setAshaProfile] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Live Patient Assistance Requests State (Starts empty, loads from Supabase & Realtime)
  const [assistanceRequests, setAssistanceRequests] = useState<Array<{
    id: string;
    patientId: string;
    patientName: string;
    message: string;
    status: AssistanceRequestStatus;
    time: string;
  }>>([]);

  // PHC Assigned Community Follow-Up Tasks (Step 6 of Journey Loop)
  const [assignedFollowUps, setAssignedFollowUps] = useState<Array<{
    id: string;
    patientId: string;
    patientName: string;
    instructions: string;
    status: 'PENDING' | 'COMPLETED';
    phcFacilityId: string;
    time: string;
  }>>([]);

  // Fetch real ASHA profile & records
  useEffect(() => {
    let isMounted = true;
    async function loadAshaProfile() {
      setIsLoadingProfile(true);
      try {
        const { profile } = await OnboardingProfileService.getRoleProfile(ashaUserId, 'ASHA');
        if (isMounted && profile) {
          setAshaProfile(profile);
        }
      } catch (err) {
        console.warn('Error loading ASHA profile:', err);
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    }
    loadAshaProfile();
    return () => {
      isMounted = false;
    };
  }, [ashaUserId]);

  // Role-Based Notifications Hook for ASHA
  const {
    notifications: roleNotifications,
    unreadCount: notifUnreadCount,
    markAsRead: markNotifAsRead,
    markAllAsRead: markAllNotifsAsRead,
    verifyAndOpenEntity,
  } = useRoleBasedNotifications({
    userId: ashaUserId,
    role: 'ASHA',
    assignedPatientIds: patientsList.map((p) => p.id),
  });

  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  // Role-Based Realtime Communication Hook (Authorized for ASHA)
  useRoleRealtimeCommunication({
    role: 'ASHA',
    userId: ashaUserId,
    onEventReceived: (event) => {
      console.log('ASHA received authorized realtime event:', event.type);
      if (event.type === 'NEW_PATIENT_REQUEST') {
        const newReq = {
          id: event.relatedEntityId || 'req-' + Date.now(),
          patientId: event.patientId,
          patientName: 'Roshan Sahani',
          message: 'Patient requested assistance from portal',
          status: 'PENDING' as AssistanceRequestStatus,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setAssistanceRequests((prev) => [newReq, ...prev]);
        const alertMsg =
          language === 'mr'
            ? '🔔 नवीन रुग्ण सहाय्य विनंती प्राप्त!'
            : language === 'hi'
            ? '🔔 नया मरीज़ सहायता अनुरोध प्राप्त!'
            : '🔔 New Patient Assistance Request Received!';
        showToast(alertMsg);
      } else if (event.type === 'COMMUNITY_FOLLOW_UP_ASSIGNED' || event.type === 'FOLLOW_UP_REQUIRED') {
        const newTask = {
          id: event.relatedEntityId || 'task-' + Date.now(),
          patientId: event.patientId,
          patientName: 'Community Patient',
          instructions: 'PHC referral follow-up: verify vital signs and medicine compliance.',
          status: 'PENDING' as const,
          phcFacilityId: event.actorId || 'fac-phc-karjat',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setAssignedFollowUps((prev) => [newTask, ...prev]);
        const alertMsg =
          language === 'mr'
            ? '📋 प्राथमिक आरोग्य केंद्राकडून नवीन समुदाय पाठपुरावा काम नियुक्त केले!'
            : language === 'hi'
            ? '📋 प्राथमिक स्वास्थ्य केंद्र से नया सामुदायिक फॉलो-अप कार्य सौंपा गया!'
            : '📋 New Community Follow-up Task Assigned from PHC!';
        showToast(alertMsg);
      } else if (event.type === 'NEW_MESSAGE') {
        const alertMsg =
          language === 'mr'
            ? '💬 अधिकृत रुग्णाकडून नवीन संदेश प्राप्त!'
            : language === 'hi'
            ? '💬 अधिकृत मरीज़ से नया संदेश प्राप्त!'
            : '💬 New message from authorized patient!';
        showToast(alertMsg);
      } else {
        const alertMsg =
          language === 'mr'
            ? `🔔 आशा सूचना: ${event.type}`
            : language === 'hi'
            ? `🔔 आशा सूचना: ${event.type}`
            : `🔔 ASHA Alert: ${event.type}`;
        showToast(alertMsg);
      }
    },
  });

  const handleCompleteFollowUpTask = async (taskId: string, patientId: string, phcFacilityId: string) => {
    setAssignedFollowUps((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'COMPLETED' } : t))
    );
    try {
      await HealthcareJourneyLoopService.step7_ashaCompleteFollowUpTask({
        taskId,
        patientId,
        ashaId: ashaUserId,
        phcFacilityId,
        publicPatientUpdate: 'ASHA home visit and vitals assessment completed successfully.',
        internalAshaNotes: 'Confidential: Patient vitals within normal parameters.',
      });
      const alertMsg =
        language === 'mr'
          ? '✅ गृहभेट पाठपुरावा पूर्ण झाला व प्रा.आ.केंद्राला सूचित केले!'
          : language === 'hi'
          ? '✅ गृह भेंट फॉलो-अप पूरा हुआ एवं पीएचसी को सूचित किया!'
          : '✅ Follow-up visit completed and transmitted to PHC!';
      showToast(alertMsg);
    } catch (e) {
      console.warn('Complete follow up notice:', e);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, patientId: string, newStatus: AssistanceRequestStatus) => {
    setAssistanceRequests((prev) =>
      prev.map((req) => (req.id === requestId ? { ...req, status: newStatus } : req))
    );
    try {
      await PatientAshaCommunicationService.updateAssistanceRequestStatus({
        requestId,
        patientId,
        ashaId: ashaUserId,
        status: newStatus,
      });
      showToast(`Request updated: ${newStatus}`);
    } catch (e) {
      console.warn('Update status notice:', e);
    }
  };

  // Load patient appointments and registered patients on mount + Listen across tabs & Supabase
  useEffect(() => {
    const reloadAppointments = () => {
      try {
        const saved = localStorage.getItem('arogya_appointments');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setPatientAppointments(parsed);
          }
        }
      } catch (err) {
        console.warn('Error reading arogya_appointments in AshaView:', err);
      }
    };

    try {
      const savedPatients = localStorage.getItem('arogya_patients');
      if (savedPatients) {
        const parsed = JSON.parse(savedPatients);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPatientsList(parsed);
        }
      }
    } catch (err) {
      console.warn('Error reading arogya_patients in AshaView:', err);
    }

    reloadAppointments();

    const notifyNewAppointment = (newApt: any) => {
      setPatientAppointments((prev) => {
        // Prevent duplicates
        if (prev.some((a) => a.id === newApt.id)) return prev;
        return [newApt, ...prev];
      });

      const alertMsg =
        language === 'mr'
          ? `🔔 नवीन नियुक्ती प्राप्त: ${newApt.patientName} (${newApt.type} - ${newApt.time})`
          : `🔔 New Appointment Assigned: ${newApt.patientName} (${newApt.type} - ${newApt.time})`;
      showToast(alertMsg);
    };

    // 1. Same-window custom event
    const handleCustomEvent = (event: any) => {
      if (event.detail) notifyNewAppointment(event.detail);
    };
    window.addEventListener('arogya-new-appointment', handleCustomEvent);

    // 2. Cross-tab Storage Event (fires when other tabs update localStorage)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'arogya_appointments' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setPatientAppointments(parsed);
            if (parsed.length > 0) {
              const latest = parsed[0];
              const alertMsg =
                language === 'mr'
                  ? `🔔 नवीन नियुक्ती: ${latest.patientName} (${latest.type} - ${latest.time})`
                  : `🔔 New Appointment Assigned: ${latest.patientName} (${latest.type} - ${latest.time})`;
              showToast(alertMsg);
            }
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 3. Cross-tab BroadcastChannel (instant inter-tab messaging)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('arogya_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'NEW_APPOINTMENT' && event.data.payload) {
            notifyNewAppointment(event.data.payload);
          }
        };
      }
    } catch (err) {}

    // 4. Supabase Realtime Channel
    let channel: any = null;
    try {
      const supabase = createClient();
      const instanceId = Math.random().toString(36).substring(2, 9);
      channel = supabase.channel(`arogya_realtime_${instanceId}`);
      channel
        .on('broadcast', { event: 'new-appointment' }, ({ payload }: any) => {
          if (payload) notifyNewAppointment(payload);
        })
        .subscribe((status: string, err: any) => {
          if (err) console.warn('Asha realtime channel status error:', err);
        });
    } catch (err) {}

    return () => {
      window.removeEventListener('arogya-new-appointment', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) bc.close();
      if (channel) {
        try {
          channel.unsubscribe();
        } catch (e) {}
      }
    };
  }, [language]);

  // Emergency countdown timer
  useEffect(() => {
    let timer: any;
    if (isEmergencyModalOpen && etaMins > 1) {
      timer = setInterval(() => {
        setEtaMins((prev) => Math.max(1, prev - 1));
      }, 10000);
    }
    return () => clearInterval(timer);
  }, [isEmergencyModalOpen, etaMins]);

  // Handle Sign Out from Profile Tab
  const handleLogout = async () => {
    if (window.confirm(lang.logoutConfirm)) {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
        if (onSignOut) {
          onSignOut();
        } else {
          window.location.href = '/login';
        }
      } catch (err) {
        console.error('Logout error:', err);
        window.location.href = '/login';
      }
    }
  };

  // Filter patients
  const filteredPatients = patientsList.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.abhaId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ward.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'anc') return p.category === 'ANC';
    if (selectedFilter === 'pnc') return p.category === 'PNC';
    if (selectedFilter === 'ncd') return p.category === 'NCD';
    if (selectedFilter === 'child') return p.category === 'Child';
    return true;
  });

  // Handle Save House Visit
  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patientsList.find((p) => p.id === visitPatientId) || {
      name: 'Walk-in Beneficiary',
      village: 'Dhamangaon',
    };

    const calculatedRisk: RiskScore =
      visitIsHighRisk || parseInt(visitSystolic) >= 140 || parseInt(visitDiastolic) >= 90
        ? 'RED'
        : parseInt(visitSystolic) >= 130
        ? 'YELLOW'
        : 'GREEN';

    try {
      await saveVisitOffline({
        name: patient.name,
        symptoms: visitSymptoms.length > 0 ? visitSymptoms : ['Routine Checkup'],
        vitals: {
          bp_systolic: parseInt(visitSystolic) || 120,
          bp_diastolic: parseInt(visitDiastolic) || 80,
          heart_rate: parseInt(visitPulse) || 76,
          spo2: parseInt(visitSpO2) || 98,
          temperature: parseFloat(visitTemp) || 98.6,
          blood_sugar_random: visitBloodSugar ? parseInt(visitBloodSugar) : undefined,
        },
        risk_score: calculatedRisk,
        ai_summary: `ASHA House Visit for ${patient.name}. BP: ${visitSystolic}/${visitDiastolic} mmHg. Symptoms: ${visitSymptoms.join(', ') || 'None'}.`,
        recommended_action:
          calculatedRisk === 'RED'
            ? 'Urgent Medical Officer review recommended at PHC.'
            : 'Continue routine care and medication.',
        marathi_translation:
          calculatedRisk === 'RED'
            ? 'तात्काळ प्रा.आ.कें. येथे वैद्यकीय तपासणी करावी.'
            : 'नियमित औषधे व आहार सुरू ठेवा.',
      });

      showToast(lang.saveOfflineSuccess);
      setIsNewVisitModalOpen(false);
      // Reset form
      setVisitSymptoms([]);
      setVisitNotes('');
    } catch (err) {
      console.error(err);
      showToast('Saved locally in offline queue.');
      setIsNewVisitModalOpen(false);
    }
  };

  // Handle Register Patient
  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;

    const newPatient: PatientItem = {
      id: 'p-' + Math.floor(1000 + Math.random() * 9000),
      name: regName,
      age: parseInt(regAge) || 25,
      gender: regGender,
      village: 'Dhamangaon',
      ward: regWard,
      phone: regPhone || '+91 98000 00000',
      abhaId: regAbha || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      category: regCategory,
      riskScore: regCategory === 'ANC' ? 'YELLOW' : 'GREEN',
      lastVisit: 'Today',
      nextDueDate: '25 May 2026',
      conditions: [regCategory === 'ANC' ? 'ANC Routine Tracking' : 'General Population Survey'],
      vitals: { bp: '120/80', pulse: 76, spo2: 98 },
      notes: 'Registered by ASHA Worker.'
    };

    const updatedPatients = [newPatient, ...patientsList];
    setPatientsList(updatedPatients);
    try {
      localStorage.setItem('arogya_patients', JSON.stringify(updatedPatients));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    showToast(lang.patientRegisteredSuccess);
    setIsAddPatientModalOpen(false);
    setRegName('');
    setRegAge('');
    setRegPhone('');
    setRegAbha('');
  };

  // Handle Calculate Triage
  const handleCalculateTriage = (e: React.FormEvent) => {
    e.preventDefault();
    if (triageSymptoms.includes('High Fever (>102°F)') || triageSymptoms.includes('Severe Breathlessness') || triageSymptoms.includes('High BP (>140/90)')) {
      setTriageRiskResult('RED');
    } else if (triageSymptoms.includes('Mild Fever') || triageSymptoms.includes('Cough / Cold') || triageSymptoms.includes('Body Ache')) {
      setTriageRiskResult('YELLOW');
    } else {
      setTriageRiskResult('GREEN');
    }
  };

  // Handle 108 Emergency Trigger
  const handleTrigger108 = () => {
    setIsEmergencyModalOpen(true);
    setEtaMins(8);
    showToast(lang.emergencyDispatched);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen pb-24 text-slate-900 font-sans shadow-2xl relative border-x border-slate-200 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="w-9 h-9 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs cursor-pointer"
            title="Profile"
          >
            AS
          </button>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              {lang.greeting}
            </h1>
            <p className="text-[11px] font-semibold text-slate-500">
              {lang.role}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setIsNotificationCenterOpen(true)}
            className="relative p-2 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[24px]">notifications</span>
            {notifUnreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
                {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
              </span>
            )}
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

      {/* Main Container - Dynamic View based on Active Tab */}
      <div className="p-4 flex-grow">
        {/* ========================================================= */}
        {/* TAB 1: HOME */}
        {/* ========================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Your Impact Today Hero Banner Card */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">{lang.impactTitle}</h2>
                  <p className="text-xs text-emerald-100 font-medium">{lang.impactSubtitle}</p>
                </div>

                {/* Impact Metrics Row */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl text-center border border-white/20 flex-1">
                    <div className="text-lg font-black text-white">42</div>
                    <div className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider leading-tight mt-0.5">
                      {lang.familiesVisited}
                    </div>
                  </div>

                  <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl text-center border border-white/20 flex-1">
                    <div className="text-lg font-black text-white">18</div>
                    <div className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider leading-tight mt-0.5">
                      {lang.patientsAssisted}
                    </div>
                  </div>

                  <div className="bg-white/15 backdrop-blur-md p-2.5 rounded-2xl text-center border border-white/20 flex-1">
                    <div className="text-lg font-black text-white">5</div>
                    <div className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider leading-tight mt-0.5">
                      {lang.followUps}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Alert Banner */}
            <div className="bg-emerald-50/90 border border-emerald-200/90 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">campaign</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    {lang.healthAlert}
                  </span>
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {lang.healthAlertMsg}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">chevron_right</span>
            </div>

            {/* Quick Actions Grid (8 Cards) */}
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-2.5">{lang.quickActions}</h3>
              <div className="grid grid-cols-4 gap-2.5">
                {/* Action 1: New House Visit */}
                <button
                  onClick={() => setIsNewVisitModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">home</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.newHouseVisit}
                  </span>
                </button>

                {/* Action 2: Add Patient */}
                <button
                  onClick={() => setIsAddPatientModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">person_add</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.addPatient}
                  </span>
                </button>

                {/* Action 3: Teleconsult */}
                <button
                  onClick={() => setIsTeleconsultModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">videocam</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.teleconsult}
                  </span>
                </button>

                {/* Action 4: Health Triage */}
                <button
                  onClick={() => setIsTriageModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">stethoscope</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.triage}
                  </span>
                </button>

                {/* Action 5: Follow-up List */}
                <button
                  onClick={() => {
                    setSelectedFilter('anc');
                    setActiveTab('patients');
                  }}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">sync</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.followUpList}
                  </span>
                </button>

                {/* Action 6: Referral Track */}
                <button
                  onClick={() => setIsReferralModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">signpost</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.referralTrack}
                  </span>
                </button>

                {/* Action 7: Medicine Stock */}
                <button
                  onClick={() => setIsMedicineStockModalOpen(true)}
                  className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">pill</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">
                    {lang.medAvailability}
                  </span>
                </button>

                {/* Action 8: Emergency 108 */}
                <button
                  onClick={handleTrigger108}
                  className="bg-white p-3 rounded-2xl border border-rose-200 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform animate-pulse">
                    <span className="material-symbols-outlined text-[24px]">e911_emergency</span>
                  </div>
                  <span className="text-[11px] font-bold text-rose-700 leading-tight">
                    {lang.emergency}
                  </span>
                </button>
              </div>
            </div>

            {/* Assigned PHC Community Follow-Up Tasks (Step 6 of Healthcare Journey Loop) */}
            {assignedFollowUps.length > 0 && (
              <div className="bg-white rounded-3xl p-4 border border-teal-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-teal-50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {language === 'mr'
                        ? 'प्रा.आ.के. नियुक्त समुदाय पाठपुरावा (PHC Assigned Tasks)'
                        : language === 'hi'
                        ? 'पीएचसी द्वारा सौंपे गए सामुदायिक फॉलो-अप (PHC Assigned Tasks)'
                        : 'PHC Community Follow-Up Tasks (Live)'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-extrabold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                    {assignedFollowUps.filter((t) => t.status === 'PENDING').length} Pending
                  </span>
                </div>

                <div className="space-y-3">
                  {assignedFollowUps.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-2xl bg-teal-50/40 border border-teal-100 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                            {task.patientName.charAt(0)}
                          </span>
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">{task.patientName}</div>
                            <div className="text-[10px] font-medium text-slate-500">{task.time}</div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                            task.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100">
                        "{task.instructions}"
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        {task.status === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => handleCompleteFollowUpTask(task.id, task.patientId, task.phcFacilityId)}
                            className="w-full text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            <span>{language === 'mr' ? 'गृहभेट पूर्ण नोंदवा' : language === 'hi' ? 'गृह भेंट पूर्ण दर्ज करें' : 'Complete Follow-Up Visit'}</span>
                          </button>
                        ) : (
                          <div className="w-full text-center text-xs font-bold text-emerald-700 bg-emerald-50 py-1.5 rounded-xl border border-emerald-200">
                            ✓ {language === 'mr' ? 'भेट पूर्ण झाली' : language === 'hi' ? 'भेंट पूर्ण' : 'Visit Completed'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Patient Assistance Requests (Realtime PATIENT -> ASHA) */}
            {assistanceRequests.length > 0 && (
              <div className="bg-white rounded-3xl p-4 border border-indigo-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {language === 'mr'
                        ? 'रुग्ण सहाय्य विनंत्या (Live Requests)'
                        : language === 'hi'
                        ? 'मरीज़ सहायता अनुरोध (Live Requests)'
                        : 'Patient Assistance Requests (Live)'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                    {assistanceRequests.filter((r) => r.status === 'PENDING').length} Pending
                  </span>
                </div>

                <div className="space-y-3">
                  {assistanceRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                            {req.patientName.charAt(0)}
                          </span>
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">{req.patientName}</div>
                            <div className="text-[10px] font-medium text-slate-500">{req.time}</div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                            req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : req.status === 'ACCEPTED'
                              ? 'bg-blue-100 text-blue-800'
                              : req.status === 'VISIT_SCHEDULED'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100">
                        "{req.message}"
                      </p>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => handleUpdateRequestStatus(req.id, req.patientId, 'ACCEPTED')}
                          className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRequestStatus(req.id, req.patientId, 'CONTACTED')}
                          className="text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                        >
                          Contacted
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRequestStatus(req.id, req.patientId, 'VISIT_SCHEDULED')}
                          className="text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                        >
                          Schedule Visit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRequestStatus(req.id, req.patientId, 'COMPLETED')}
                          className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Schedule */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900">{lang.schedule}</h3>
                <button
                  onClick={() => setActiveTab('patients')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  {lang.viewAll}
                </button>
              </div>

              <div className="space-y-3 divide-y divide-slate-100">
                {/* Patient-Booked Appointments (Highlighted) */}
                {patientAppointments.map((apt) => (
                  <div key={apt.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3 bg-emerald-50/50 p-2.5 rounded-2xl border border-emerald-200/80 mb-2">
                    <div className="flex items-start gap-3">
                      <div className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-1 rounded-xl text-center shrink-0 border border-emerald-300">
                        {apt.time || '10:00 AM'}
                        <div className="text-[8px] font-bold text-emerald-700">{apt.date || 'Today'}</div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-extrabold text-slate-900">{apt.type}</h4>
                          <span className="bg-purple-100 text-purple-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-purple-200">
                            {language === 'mr' ? 'रुग्णाने बुक केले' : 'Patient Booked'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                          {apt.patientName} • <span className="font-normal text-slate-500">{apt.doctorOrAsha || 'ASHA Visit'}</span>
                        </p>
                        <p className="text-[10px] text-emerald-700 font-medium">{apt.facility || 'Dhamangaon'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setVisitPatientId('p-101');
                          setIsNewVisitModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                      >
                        {lang.recordVisit}
                      </button>
                    </div>
                  </div>
                ))}

                {loading ? (
                  <p className="text-center text-xs text-slate-500 py-4">{lang.loading}</p>
                ) : schedule.length === 0 && patientAppointments.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-4">{lang.noTasks}</p>
                ) : (
                  schedule.map((item) => (
                    <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="text-[11px] font-extrabold text-teal-700 bg-teal-50 px-2 py-1 rounded-xl text-center shrink-0 border border-teal-200/60">
                          {item.time}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-extrabold text-slate-900">{item.type}</h4>
                            {item.highRisk && (
                              <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                                {lang.highRisk}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-700 mt-0.5">
                            {item.patientName} • <span className="font-normal text-slate-500">{item.details}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">{item.village}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setVisitPatientId('p-101');
                            setIsNewVisitModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 cursor-pointer"
                        >
                          {lang.recordVisit}
                        </button>
                        <a
                          href="tel:+919822144521"
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 transition-colors"
                          title="Call Patient"
                        >
                          <span className="material-symbols-outlined text-[16px]">call</span>
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Important Updates */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-extrabold text-slate-900">{lang.updates}</h3>
              </div>

              <div className="bg-rose-50/70 border border-rose-200/70 p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-rose-100/70 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">event</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-rose-900">{lang.polioCampaign}</h4>
                    <p className="text-[11px] font-medium text-rose-700">{lang.polioDate}</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-rose-600 text-[20px]">chevron_right</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PATIENTS DIRECTORY */}
        {/* ========================================================= */}
        {activeTab === 'patients' && (
          <div className="space-y-4">
            {/* Patients Header with Register CTA */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{lang.patientDirectory}</h2>
                  <p className="text-xs text-slate-500 font-medium">{lang.patientSubtitle}</p>
                </div>
                <button
                  onClick={() => setIsAddPatientModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  <span>{lang.addNewPatient}</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang.searchPlaceholder}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-medium outline-none focus:border-emerald-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                <button
                  onClick={() => setSelectedFilter('all')}
                  className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lang.allFilter} ({patientsList.length})
                </button>
                <button
                  onClick={() => setSelectedFilter('anc')}
                  className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedFilter === 'anc'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  {lang.ancFilter}
                </button>
                <button
                  onClick={() => setSelectedFilter('pnc')}
                  className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedFilter === 'pnc'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  {lang.pncFilter}
                </button>
                <button
                  onClick={() => setSelectedFilter('ncd')}
                  className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedFilter === 'ncd'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  {lang.ncdFilter}
                </button>
                <button
                  onClick={() => setSelectedFilter('child')}
                  className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedFilter === 'child'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  {lang.childFilter}
                </button>
              </div>
            </div>

            {/* Patients List */}
            <div className="space-y-3">
              {filteredPatients.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center text-slate-500 space-y-2 border border-slate-200">
                  <span className="material-symbols-outlined text-4xl text-slate-300">person_off</span>
                  <p className="text-xs font-semibold">{lang.noPatientsFound}</p>
                </div>
              ) : (
                filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3 hover:shadow-md transition-shadow"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs ${
                            patient.riskScore === 'RED'
                              ? 'bg-rose-500'
                              : patient.riskScore === 'YELLOW'
                              ? 'bg-amber-500'
                              : 'bg-emerald-600'
                          }`}
                        >
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900">{patient.name}</h3>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                patient.riskScore === 'RED'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : patient.riskScore === 'YELLOW'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {patient.riskScore}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {patient.age} yrs • {patient.gender === 'F' ? 'Female' : 'Male'} • {patient.ward}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ABHA: {patient.abhaId}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-1 rounded-xl border border-teal-200">
                        {patient.category}
                      </span>
                    </div>

                    {/* Conditions / Status Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {patient.conditions.map((cond, idx) => (
                        <span
                          key={idx}
                          className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-slate-200/60"
                        >
                          {cond}
                        </span>
                      ))}
                    </div>

                    {/* Vitals Summary Row */}
                    <div className="bg-slate-50 rounded-2xl p-2.5 flex items-center justify-between text-xs border border-slate-100">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">BP</span>
                          <p className="font-extrabold text-slate-800 text-[11px]">{patient.vitals.bp}</p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Pulse</span>
                          <p className="font-extrabold text-slate-800 text-[11px]">{patient.vitals.pulse} bpm</p>
                        </div>
                        {patient.vitals.hb && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Hb</span>
                            <p className="font-extrabold text-rose-600 text-[11px]">{patient.vitals.hb} g/dL</p>
                          </div>
                        )}
                        {patient.vitals.sugar && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Sugar</span>
                            <p className="font-extrabold text-amber-700 text-[11px]">{patient.vitals.sugar} mg</p>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{lang.vitalsLastChecked}</span>
                        <p className="font-bold text-slate-600 text-[10px]">{patient.lastVisit}</p>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setVisitPatientId(patient.id);
                          setIsNewVisitModalOpen(true);
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-xl shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                        <span>{lang.recordVisit}</span>
                      </button>

                      <button
                        onClick={() => setSelectedPatientForDetails(patient)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer transition-colors"
                      >
                        {lang.viewDetails}
                      </button>

                      <a
                        href={`tel:${patient.phone}`}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 flex items-center justify-center border border-slate-200 transition-colors"
                        title={lang.call}
                      >
                        <span className="material-symbols-outlined text-[18px]">call</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: REPORTS & ANALYTICS */}
        {/* ========================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Performance Overview Hero */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{lang.monthlyReport}</h2>
                  <p className="text-xs text-slate-500 font-medium">{lang.may2026}</p>
                </div>
                <button
                  onClick={() => showToast('Monthly Work Report PDF downloaded!')}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>PDF</span>
                </button>
              </div>

              {/* Monthly Target Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">{lang.targetProgress}</span>
                  <span className="text-emerald-700">128 / 150 {lang.targetCompleted}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full w-[85%] transition-all" />
                </div>
              </div>

              {/* 4 Performance Metric Cards */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl space-y-1">
                  <span className="text-2xl font-black text-emerald-800">142</span>
                  <p className="text-xs font-bold text-emerald-900 leading-tight">
                    {language === 'mr' ? 'एकूण कुटुंब भेटी' : 'Total Family Visits'}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-semibold block">↑ 12% vs last month</span>
                </div>

                <div className="bg-rose-50/80 border border-rose-200/80 p-3.5 rounded-2xl space-y-1">
                  <span className="text-2xl font-black text-rose-800">12</span>
                  <p className="text-xs font-bold text-rose-900 leading-tight">
                    {language === 'mr' ? 'अतिधोका गरोदर माता' : 'High Risk ANC Tracked'}
                  </p>
                  <span className="text-[10px] text-rose-600 font-semibold block">100% Institutional Delivery</span>
                </div>

                <div className="bg-purple-50/80 border border-purple-200/80 p-3.5 rounded-2xl space-y-1">
                  <span className="text-2xl font-black text-purple-800">96%</span>
                  <p className="text-xs font-bold text-purple-900 leading-tight">
                    {language === 'mr' ? 'लसीकरण प्रमाण' : 'Immunization Rate'}
                  </p>
                  <span className="text-[10px] text-purple-600 font-semibold block">48/50 Infants Fully Covered</span>
                </div>

                <div className="bg-blue-50/80 border border-blue-200/80 p-3.5 rounded-2xl space-y-1">
                  <span className="text-2xl font-black text-blue-800">58</span>
                  <p className="text-xs font-bold text-blue-900 leading-tight">
                    {language === 'mr' ? 'NCD तपासणी पूर्ण' : 'NCD Screenings'}
                  </p>
                  <span className="text-[10px] text-blue-600 font-semibold block">BP & Sugar Checked</span>
                </div>
              </div>
            </div>

            {/* ASHA Honorarium & Incentive Tracker */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-extrabold text-slate-900">{lang.incentiveSummary}</h3>
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  ₹4,850
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-700">{lang.ancIncentive}</span>
                  <span className="font-extrabold text-slate-900">₹1,200</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-700">{lang.immIncentive}</span>
                  <span className="font-extrabold text-slate-900">₹1,500</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-700">{lang.ncdIncentive}</span>
                  <span className="font-extrabold text-slate-900">₹1,150</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-700">{lang.teleconsultIncentive}</span>
                  <span className="font-extrabold text-slate-900">₹1,000</span>
                </div>
              </div>
            </div>

            {/* Village Health Surveillance */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">{lang.healthSurveillance}</h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-3 bg-amber-50/70 rounded-2xl border border-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-[18px]">bug_report</span>
                    <span className="font-bold text-amber-900">{lang.dengueSurv}</span>
                  </div>
                  <span className="font-extrabold text-amber-900 bg-white px-2 py-0.5 rounded-lg border border-amber-200">0 Active</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-purple-50/70 rounded-2xl border border-purple-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-600 text-[18px]">child_care</span>
                    <span className="font-bold text-purple-900">{lang.malnutritionSurv}</span>
                  </div>
                  <span className="font-extrabold text-purple-900 bg-white px-2 py-0.5 rounded-lg border border-purple-200">2 Monitored</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-teal-50/70 rounded-2xl border border-teal-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-600 text-[18px]">water_drop</span>
                    <span className="font-bold text-teal-900">{lang.waterSources}</span>
                  </div>
                  <span className="font-extrabold text-teal-900 bg-white px-2 py-0.5 rounded-lg border border-teal-200">14 Wells Tested</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PROFILE & LOGOUT */}
        {/* ========================================================= */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* ASHA Identity Header Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-2xl flex items-center justify-center shadow-md">
                    {(ashaProfile?.full_name || user?.user_metadata?.full_name || 'AS').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-slate-900">
                        {ashaProfile?.full_name || user?.user_metadata?.full_name || 'Sunita More'}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      ASHA ID: {ashaProfile?.asha_worker_id || 'ASHA-MH-2024-884'}
                    </p>
                    <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {lang.onDuty}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 border border-slate-200 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Edit Profile</span>
                </button>
              </div>

              {/* Work Assignment Details */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2 text-xs">
                <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">
                  {lang.workAssignment}
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">location_on</span>
                    <span className="font-semibold">
                      Village: {ashaProfile?.assigned_village || 'Dhamangaon'}, {ashaProfile?.block || 'Karjat'}, {ashaProfile?.district || 'Raigad'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">local_hospital</span>
                    <span>Primary PHC: {ashaProfile?.primary_phc_name || 'Dhamangaon PHC, Karjat'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">phone</span>
                    <span>Phone: {ashaProfile?.phone_number || user?.phone || '+91 98402 19283'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400 text-[16px]">groups</span>
                    <span>Assigned Patients: {patientsList.length > 0 ? `${patientsList.length} Active Records` : 'No patients assigned yet'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* App Settings & Offline Controls */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">{lang.appSettings}</h3>

              <div className="space-y-2.5 text-xs">
                {/* Language Switcher Button */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">translate</span>
                    <div>
                      <span className="font-bold text-slate-800">
                        {language === 'mr' ? 'भाषा: मराठी' : 'Language: English'}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {language === 'mr' ? 'इंग्रजीमध्ये बदलण्यासाठी टॅप करा' : 'Tap to switch to Marathi'}
                      </p>
                    </div>
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

                {/* Offline Mode Sync */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-teal-600 text-[20px]">sync</span>
                    <div>
                      <span className="font-bold text-slate-800">{lang.offlineSync}</span>
                      <p className="text-[10px] text-slate-400">{lastSyncedText}</p>
                    </div>
                  </div>
                  <button
                    onClick={onSync}
                    disabled={isSyncing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span className={`material-symbols-outlined text-[14px] ${isSyncing ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    <span>Sync</span>
                  </button>
                </div>

                {/* Download Medical Guidelines */}
                <button
                  onClick={() => showToast('Medical Guidelines PDF downloaded to device storage!')}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 cursor-pointer text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-blue-600 text-[20px]">menu_book</span>
                    <div>
                      <span className="font-bold text-slate-800">{lang.downloadGuidelines}</span>
                      <p className="text-[10px] text-slate-400">ANC, PNC, Malnutrition & NCD Manual</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">download</span>
                </button>

                {/* Helpline 104 / 108 */}
                <a
                  href="tel:104"
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 cursor-pointer text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-purple-600 text-[20px]">support_agent</span>
                    <div>
                      <span className="font-bold text-slate-800">{lang.contactHelpline}</span>
                      <p className="text-[10px] text-slate-400">National Health Helpline 104 (24x7)</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">call</span>
                </a>
              </div>
            </div>

            {/* Logout / Sign Out Card */}
            <div className="bg-white rounded-3xl p-5 border border-rose-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-rose-900">{lang.logoutTitle}</h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'mr'
                  ? 'सुरक्षिततेसाठी काम संपल्यानंतर खात्यातून लॉग आउट करा.'
                  : 'Ensure you sign out after your work shift to keep patient records protected.'}
              </p>

              <button
                onClick={handleLogout}
                type="button"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
                <span>{lang.logoutButton}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: NEW HOUSE VISIT / INTAKE FORM */}
      {/* ========================================================= */}
      {isNewVisitModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[22px]">home_health</span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {language === 'mr' ? 'नवीन गृहभेट नोंदवा' : 'New House Visit Form'}
                </h3>
              </div>
              <button
                onClick={() => setIsNewVisitModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVisit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'रुग्ण निवडा' : 'Select Patient / Beneficiary'}
                </label>
                <select
                  value={visitPatientId}
                  onChange={(e) => setVisitPatientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                >
                  <option value="">{language === 'mr' ? '-- रुग्ण निवडा --' : '-- Select Patient --'}</option>
                  {patientsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category} • {p.ward})
                    </option>
                  ))}
                </select>
              </div>

              {/* Vitals Grid */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'शारीरिक तपासणी (Vitals)' : 'Vitals Measurement'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">BP (Systolic / Diastolic)</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="120"
                        value={visitSystolic}
                        onChange={(e) => setVisitSystolic(e.target.value)}
                        className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-xs font-bold"
                      />
                      <input
                        type="number"
                        placeholder="80"
                        value={visitDiastolic}
                        onChange={(e) => setVisitDiastolic(e.target.value)}
                        className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">Pulse (bpm)</span>
                    <input
                      type="number"
                      placeholder="76"
                      value={visitPulse}
                      onChange={(e) => setVisitPulse(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-xs font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">SpO2 (%)</span>
                    <input
                      type="number"
                      placeholder="98"
                      value={visitSpO2}
                      onChange={(e) => setVisitSpO2(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-xs font-bold"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold">Temp (°F)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="98.6"
                      value={visitTemp}
                      onChange={(e) => setVisitTemp(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Symptoms Checklist */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'लक्षणे' : 'Symptoms Observed'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Fever', 'Cough/Cold', 'Headache', 'Swelling in Feet', 'High BP', 'Weakness'].map((sym) => (
                    <label
                      key={sym}
                      className={`flex items-center gap-1.5 p-2 rounded-xl border text-[11px] font-medium cursor-pointer ${
                        visitSymptoms.includes(sym)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={visitSymptoms.includes(sym)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVisitSymptoms([...visitSymptoms, sym]);
                          } else {
                            setVisitSymptoms(visitSymptoms.filter((s) => s !== sym));
                          }
                        }}
                        className="accent-emerald-600 rounded"
                      />
                      <span>{sym}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* High Risk Flag */}
              <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                <span className="font-bold text-rose-900 text-xs">
                  {language === 'mr' ? 'अतिधोका म्हणून चिन्हांकित करा' : 'Mark as High-Risk Patient'}
                </span>
                <input
                  type="checkbox"
                  checked={visitIsHighRisk}
                  onChange={(e) => setVisitIsHighRisk(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'टिप्पणी / सल्ला' : 'Clinical Notes'}
                </label>
                <textarea
                  rows={2}
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder={language === 'mr' ? 'माहिती व दिलेला सल्ला लिहा...' : 'Enter visit observations...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 text-xs font-medium outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewVisitModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  {language === 'mr' ? 'रद्द करा' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-xs cursor-pointer"
                >
                  {language === 'mr' ? 'जतन करा (Save)' : 'Save Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD / REGISTER NEW PATIENT */}
      {/* ========================================================= */}
      {isAddPatientModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600 text-[22px]">person_add</span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {language === 'mr' ? 'नवीन रुग्ण नोंदणी' : 'Register New Patient'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddPatientModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'पूर्ण नाव' : 'Full Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Meena Sanjay Shinde"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'mr' ? 'वय (Age)' : 'Age'}
                  </label>
                  <input
                    type="number"
                    value={regAge}
                    onChange={(e) => setRegAge(e.target.value)}
                    placeholder="25"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'mr' ? 'लिंग' : 'Gender'}
                  </label>
                  <select
                    value={regGender}
                    onChange={(e: any) => setRegGender(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                  >
                    <option value="F">Female (स्त्री)</option>
                    <option value="M">Male (पुरुष)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'आरोग्य वर्ग / श्रेणी' : 'Health Category'}
                </label>
                <select
                  value={regCategory}
                  onChange={(e: any) => setRegCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                >
                  <option value="ANC">ANC (गरोदर माता)</option>
                  <option value="PNC">PNC (प्रसूती पश्चात माता)</option>
                  <option value="Child">Child (०-५ वर्षे बालक)</option>
                  <option value="NCD">NCD (मधुमेह/रक्तदाब)</option>
                  <option value="General">General Population</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'गल्ली / वॉर्ड' : 'Ward / Pada'}
                </label>
                <select
                  value={regWard}
                  onChange={(e) => setRegWard(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                >
                  <option value="Ward 1 (Main Road)">Ward 1 (Main Road)</option>
                  <option value="Ward 2 (Gavali Galli)">Ward 2 (Gavali Galli)</option>
                  <option value="Ward 3 (Mandir Area)">Ward 3 (Mandir Area)</option>
                  <option value="Ward 4 (Adivasi Pada)">Ward 4 (Adivasi Pada)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'मोबाईल नंबर' : 'Phone Number'}
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'आभा आयडी (ABHA ID)' : 'ABHA ID (Optional)'}
                </label>
                <input
                  type="text"
                  value={regAbha}
                  onChange={(e) => setRegAbha(e.target.value)}
                  placeholder="91-XXXX-XXXX-XXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono text-xs outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPatientModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  {language === 'mr' ? 'रद्द करा' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-xs cursor-pointer"
                >
                  {language === 'mr' ? 'नोंदणी करा' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: HEALTH TRIAGE AI ASSESSMENT */}
      {/* ========================================================= */}
      {isTriageModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-pink-600 text-[22px]">stethoscope</span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {language === 'mr' ? 'आरोग्य तपासणी व AI ट्रायज' : 'Health Triage Assessment'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsTriageModalOpen(false);
                  setTriageRiskResult(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCalculateTriage} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'रुग्णाचे नाव' : 'Patient Name'}
                </label>
                <input
                  type="text"
                  value={triagePatientName}
                  onChange={(e) => setTriagePatientName(e.target.value)}
                  placeholder="e.g. Sunita Pawar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'लक्षणे निवडा' : 'Select Symptoms'}
                </label>
                <div className="space-y-1.5">
                  {[
                    'Severe Breathlessness',
                    'High BP (>140/90)',
                    'High Fever (>102°F)',
                    'Mild Fever',
                    'Cough / Cold',
                    'Severe Abdominal Pain',
                    'Swelling in Face/Hands',
                  ].map((s) => (
                    <label
                      key={s}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                        triageSymptoms.includes(s)
                          ? 'bg-pink-50 border-pink-300 text-pink-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={triageSymptoms.includes(s)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTriageSymptoms([...triageSymptoms, s]);
                          } else {
                            setTriageSymptoms(triageSymptoms.filter((item) => item !== s));
                          }
                        }}
                        className="accent-pink-600 rounded"
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              {triageRiskResult && (
                <div
                  className={`p-3 rounded-2xl border space-y-1.5 animate-fadeIn ${
                    triageRiskResult === 'RED'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : triageRiskResult === 'YELLOW'
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold uppercase tracking-wider text-[11px]">
                      {language === 'mr' ? 'AI जोखीम श्रेणी:' : 'AI Triage Level:'}
                    </span>
                    <span className="font-black text-xs px-2 py-0.5 rounded-full bg-white border shadow-xs">
                      {triageRiskResult} RISK
                    </span>
                  </div>
                  <p className="text-xs font-semibold">
                    {triageRiskResult === 'RED'
                      ? language === 'mr'
                        ? '🚨 तात्काळ वैद्यकीय अधिकाऱ्यांकडे (PHC) पाठवा किंवा १०८ रुग्णवाहिका बोलवा.'
                        : '🚨 Immediate Referral to PHC Medical Officer or 108 ALS Ambulance recommended.'
                      : triageRiskResult === 'YELLOW'
                      ? language === 'mr'
                        ? '⚠️ ३ दिवसांत पाठपुरावा करा आणि प्राथमिक औषधे द्या.'
                        : '⚠️ Schedule follow-up within 3 days and start basic medication.'
                      : language === 'mr'
                      ? '✅ रुग्ण सुरक्षित आहे. नियमित आहार व विश्रांतीचा सल्ला द्या.'
                      : '✅ Patient stable. Advise hydration and routine care.'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 rounded-xl shadow-xs cursor-pointer"
              >
                {language === 'mr' ? 'ट्रायज मूल्यांकन करा' : 'Calculate Risk'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: 108 EMERGENCY DISPATCH SIMULATOR */}
      {/* ========================================================= */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-300 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                <h3 className="text-base font-black text-rose-900">108 ALS Ambulance En-Route</h3>
              </div>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 text-white p-4 rounded-2xl border border-rose-800 space-y-3 text-center">
              <div className="text-xs text-rose-300 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span>Live GPS Tracking</span>
              </div>
              <div className="text-3xl font-black text-white">
                {etaMins} <span className="text-sm font-bold text-rose-300">MINS ETA</span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl border border-white/20 text-xs text-slate-200 space-y-1 text-left">
                <div><strong>Vehicle:</strong> MH-14-EM-1084 (ALS)</div>
                <div><strong>Driver:</strong> Ramesh Shinde (+91 98220 10800)</div>
                <div><strong>Destination:</strong> Karjat SDH Trauma Unit</div>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href="tel:108"
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs text-center flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                <span>Call 108 Dispatch</span>
              </a>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: TELECONSULT REQUEST */}
      {/* ========================================================= */}
      {isTeleconsultModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[22px]">videocam</span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {language === 'mr' ? 'टेलिकन्सल्टेशन विनंती' : 'Teleconsultation Request'}
                </h3>
              </div>
              <button
                onClick={() => setIsTeleconsultModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                showToast(lang.teleconsultScheduled);
                setIsTeleconsultModalOpen(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'रुग्ण निवडा' : 'Select Patient'}
                </label>
                <input
                  type="text"
                  required
                  value={telePatientName}
                  onChange={(e) => setTelePatientName(e.target.value)}
                  placeholder="e.g. Roshan Sahani"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'वैद्यकीय अधिकारी निवडा' : 'Select Doctor'}
                </label>
                <select
                  value={teleDoctor}
                  onChange={(e) => setTeleDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                >
                  <option value="Dr. Amit Deshmukh (PHC Medical Officer)">Dr. Amit Deshmukh (PHC Medical Officer)</option>
                  <option value="Dr. Sneha Kulkarni (OB-GYN Specialist - SDH)">Dr. Sneha Kulkarni (OB-GYN Specialist - SDH)</option>
                  <option value="Dr. Rahul Verma (Pediatrician)">Dr. Rahul Verma (Pediatrician)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'mr' ? 'सल्ल्याचे कारण' : 'Reason for Consultation'}
                </label>
                <textarea
                  rows={2}
                  value={teleReason}
                  onChange={(e) => setTeleReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTeleconsultModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  {language === 'mr' ? 'रद्द करा' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-xs cursor-pointer"
                >
                  {language === 'mr' ? 'कॉल सुरू करा' : 'Request Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: MEDICINE STOCK CHECKLIST */}
      {/* ========================================================= */}
      {isMedicineStockModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600 text-[22px]">pill</span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {language === 'mr' ? 'औषध साठा नोंद' : 'ASHA Medicine Kit Stock'}
                </h3>
              </div>
              <button
                onClick={() => setIsMedicineStockModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800">Iron & Folic Acid (IFA) Tablets</span>
                <input
                  type="number"
                  value={ifaStock}
                  onChange={(e) => setIfaStock(parseInt(e.target.value) || 0)}
                  className="w-16 bg-white border border-slate-200 rounded-lg p-1 text-center font-bold text-xs"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800">ORS Packets</span>
                <input
                  type="number"
                  value={orsStock}
                  onChange={(e) => setOrsStock(parseInt(e.target.value) || 0)}
                  className="w-16 bg-white border border-slate-200 rounded-lg p-1 text-center font-bold text-xs"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800">Paracetamol 500mg</span>
                <input
                  type="number"
                  value={pcmStock}
                  onChange={(e) => setPcmStock(parseInt(e.target.value) || 0)}
                  className="w-16 bg-white border border-slate-200 rounded-lg p-1 text-center font-bold text-xs"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800">Zinc Tablets (20mg)</span>
                <input
                  type="number"
                  value={zincStock}
                  onChange={(e) => setZincStock(parseInt(e.target.value) || 0)}
                  className="w-16 bg-white border border-slate-200 rounded-lg p-1 text-center font-bold text-xs"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-800">Malaria Rapid Diagnostic Kits</span>
                <input
                  type="number"
                  value={malariaKitStock}
                  onChange={(e) => setMalariaKitStock(parseInt(e.target.value) || 0)}
                  className="w-16 bg-white border border-slate-200 rounded-lg p-1 text-center font-bold text-xs"
                />
              </div>
            </div>

            <button
              onClick={() => {
                showToast(lang.stockUpdated);
                setIsMedicineStockModalOpen(false);
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-xs cursor-pointer text-xs"
            >
              {language === 'mr' ? 'साठा अद्यतनित करा' : 'Update Stock to PHC'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: PATIENT DETAILS MODAL */}
      {/* ========================================================= */}
      {selectedPatientForDetails && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs ${
                    selectedPatientForDetails.riskScore === 'RED'
                      ? 'bg-rose-600'
                      : selectedPatientForDetails.riskScore === 'YELLOW'
                      ? 'bg-amber-600'
                      : 'bg-emerald-600'
                  }`}
                >
                  {selectedPatientForDetails.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{selectedPatientForDetails.name}</h3>
                  <span className="text-[10px] text-slate-500">{selectedPatientForDetails.ward}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatientForDetails(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">ABHA Identity</div>
                <div className="font-mono font-bold text-slate-900">{selectedPatientForDetails.abhaId}</div>
                <div className="text-slate-600">
                  {selectedPatientForDetails.age} yrs • {selectedPatientForDetails.gender === 'F' ? 'Female' : 'Male'} •{' '}
                  {selectedPatientForDetails.phone}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Latest Vitals</div>
                <div className="grid grid-cols-3 gap-2 pt-1 font-bold text-slate-800 text-[11px]">
                  <div>BP: {selectedPatientForDetails.vitals.bp}</div>
                  <div>Pulse: {selectedPatientForDetails.vitals.pulse} bpm</div>
                  <div>SpO2: {selectedPatientForDetails.vitals.spo2}%</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Clinical Notes</div>
                <p className="text-slate-700 leading-relaxed font-medium">{selectedPatientForDetails.notes}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setVisitPatientId(selectedPatientForDetails.id);
                  setSelectedPatientForDetails(null);
                  setIsNewVisitModalOpen(true);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-xs cursor-pointer text-xs"
              >
                {lang.recordVisit}
              </button>
              <a
                href={`tel:${selectedPatientForDetails.phone}`}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 flex items-center justify-center border border-slate-200"
              >
                <span className="material-symbols-outlined text-[20px]">call</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 8: REFERRAL TRACKING */}
      {/* ========================================================= */}
      {isReferralModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 text-[22px]">signpost</span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {language === 'mr' ? 'सक्रिय संदर्भ सेवा मागोवा' : 'Active Referral Tracking'}
                </h3>
              </div>
              <button
                onClick={() => setIsReferralModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-teal-900">Roshan Sahani (General)</span>
                  <span className="text-[9px] font-bold bg-teal-200 text-teal-900 px-2 py-0.5 rounded-full">
                    Karjat PHC
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">Routine Vitals & Preventive Health Review. Doctor accepted.</p>
              </div>
            </div>

            <button
              onClick={() => setIsReferralModalOpen(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl cursor-pointer text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* ========================================================= */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'home' ? 'text-teal-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span>{lang.home}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('patients')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'patients' ? 'text-teal-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">group</span>
          <span>{lang.patients}</span>
        </button>

        {/* Center Floating Action Button (+) */}
        <button
          type="button"
          onClick={() => setIsNewVisitModalOpen(true)}
          className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg -mt-5 border-4 border-white transition-transform active:scale-95 cursor-pointer"
          title="New House Visit"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'reports' ? 'text-teal-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">bar_chart</span>
          <span>{lang.reports}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center font-bold text-[10px] gap-0.5 cursor-pointer transition-colors ${
            activeTab === 'profile' ? 'text-teal-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span>{lang.profile}</span>
        </button>
      </div>

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={roleNotifications}
        unreadCount={notifUnreadCount}
        onMarkAsRead={markNotifAsRead}
        onMarkAllAsRead={markAllNotifsAsRead}
        language={language}
        onOpenEntity={async (notif) => {
          const check = await verifyAndOpenEntity(notif);
          if (!check.allowed) {
            showToast(check.message || 'You no longer have access to this information.');
            return;
          }
          if (notif.related_entity_type === 'appointment' || notif.related_entity_type === 'follow_up') {
            setIsNotificationCenterOpen(false);
            setActiveTab('patients');
          }
        }}
      />
      {/* Profile & Role Settings Modal */}
      {isProfileModalOpen && (
        <ProfileSettingsModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userId={ashaUserId}
          role="ASHA"
          language={language}
          onProfileUpdated={(updated) => {
            setAshaProfile(updated);
            showToast('Profile updated successfully!');
          }}
        />
      )}
    </div>
  );
};
