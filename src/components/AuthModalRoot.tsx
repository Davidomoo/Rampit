"use client";

import { useAuth } from "@/lib/AuthContext";
import AuthModal from "./AuthModal";

export default function AuthModalRoot() {
  const { authOpen, setAuthOpen, setUser, refreshProfile } = useAuth();
  return (
    <AuthModal
      open={authOpen}
      onSuccess={(email) => {
        // Tokens are already stored by the API client; pull the real profile.
        setUser(email);
        setAuthOpen(false);
        void refreshProfile();
      }}
      onClose={() => setAuthOpen(false)}
    />
  );
}
