"use client";

import { useState, useCallback } from "react";
import { AuthModal } from "./AuthModal";

interface SignInButtonProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Button that opens the AuthModal for sign-in/sign-up.
 * Used on the public landing page as the primary CTA.
 */
export function SignInButton({ className, children }: SignInButtonProps) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button onClick={handleOpen} className={className}>
        {children}
      </button>
      <AuthModal isOpen={open} onClose={handleClose} />
    </>
  );
}
