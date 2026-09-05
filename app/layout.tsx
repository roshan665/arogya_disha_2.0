import type { Metadata } from 'next';
import './globals.css';
import { ClientErrorHandler } from '../components/ClientErrorHandler';

export const metadata: Metadata = {
  title: 'ArogyaDisha - AI Clinical Triage & Emergency Referral Platform',
  description:
    'Offline-first healthcare decision support system for ASHA workers, ANMs, and Primary Health Centers with Gemini AI triage and Supabase Realtime alerts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        <ClientErrorHandler />
        {children}
      </body>
    </html>
  );
}
