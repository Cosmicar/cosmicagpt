import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { authService } from "@/services/auth/auth-service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    }
    initAuth();
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
  };
}
