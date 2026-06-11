import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  org_id: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthCtx>({ user: null, setUser: () => {} });
export const useAuth = () => useContext(AuthContext);