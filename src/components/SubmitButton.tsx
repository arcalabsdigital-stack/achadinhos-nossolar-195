"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio que mostra "aguarde" enquanto o servidor processa */
export default function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary" disabled={pending} style={pending ? { opacity: 0.6 } : undefined}>
      {pending ? pendingText : children}
    </button>
  );
}
