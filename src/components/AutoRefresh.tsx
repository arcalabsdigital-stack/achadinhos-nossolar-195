"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza os dados da página sozinho a cada `seconds` segundos */
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
