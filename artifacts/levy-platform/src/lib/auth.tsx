import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, type User } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [isInitializing, setIsInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => token);
    if (!token) {
      queryClient.removeQueries(["currentUser"]);
      setIsInitializing(false);
    }
  }, [token, queryClient]);

  const { data: user, isLoading: isUserLoading, isError } = useGetCurrentUser({
    query: {
      queryKey: ["currentUser"],
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (token && (user || isError)) {
      setIsInitializing(false);
    }
    if (isError) {
      queryClient.removeQueries(["currentUser"]);
      setToken(null);
      localStorage.removeItem("token");
      setAuthTokenGetter(null);
    }
  }, [user, isError, token, queryClient]);

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthTokenGetter(null);
    queryClient.removeQueries(["currentUser"]);
  };

  const currentUser = token ? user : null;
  const isLoading = isInitializing || (!!token && isUserLoading);

  return (
    <AuthContext.Provider value={{ user: currentUser, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Fallback for cases where components are rendered outside the provider
    // (HMR/dev overlays or tests). Return a safe no-op implementation so the
    // app doesn't crash; consumers should still prefer having an AuthProvider.
    return {
      user: null,
      isLoading: false,
      login: (token: string) => {
        // no-op fallback
        // eslint-disable-next-line no-console
        console.warn("AuthProvider missing: login() noop");
      },
      logout: () => {
        // no-op fallback
        // eslint-disable-next-line no-console
        console.warn("AuthProvider missing: logout() noop");
      },
    } as AuthContextType;
  }

  return context;
}
