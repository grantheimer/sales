'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = pathname !== '/login';

  return (
    <>
      {showNav && <Navigation />}
      {children}
    </>
  );
}
