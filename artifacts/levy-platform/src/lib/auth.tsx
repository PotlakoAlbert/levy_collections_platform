import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

  useEffect(() => {
    setAuthTokenGetter(() => token);
    if (!token) {
      setIsInitializing(false);
    }
  }, [token]);

  const { data: user, isLoading: isUserLoading, isError } = useGetCurrentUser({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (token && (user || isError)) {
      setIsInitializing(false);
    }
    if (isError) {
      setToken(null);
      localStorage.removeItem("token");
    }
  }, [user, isError, token]);

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  const isLoading = isInitializing || (!!token && isUserLoading);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
