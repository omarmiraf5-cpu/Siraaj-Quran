"use client";

import { useEffect, useState } from "react";

interface DemoUser {
  name: string;
  role: string;
  email?: string;
}

export function useDemoUser() {
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("demo_user");
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  return user;
}
