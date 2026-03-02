'use client';

import { useEffect } from 'react';

export default function AdminIndexPage() {
  useEffect(() => {
    window.location.href = '/admin/dashboard';
  }, []);

  return null;
}
