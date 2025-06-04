/**
 * @fileoverview Admin Navigation Component
 * 
 * This component provides consistent navigation for admin pages.
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import Link from 'next/link';
import { useRouter } from 'next/router';

interface AdminNavProps {
  className?: string;
}

const AdminNav = ({ className = '' }: AdminNavProps) => {
  const router = useRouter();

  const adminPages = [
    { label: 'Templates', href: '/admin/templates', icon: '📋' },
    { label: 'Organizations', href: '/admin/organizations', icon: '🏢' },
  ];

  return (
    <nav className={`flex gap-4 ${className}`}>
      {adminPages.map(({ label, href, icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            router.pathname === href || router.pathname.startsWith(href + '/')
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <span>{icon}</span>
          {label}
        </Link>
      ))}
    </nav>
  );
};

export default AdminNav;