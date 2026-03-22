import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { getEnvironmentConfig } from '@/src/config/env';
import { authApi, AuthUser, SessionState } from '@/src/lib/api';
import { clearSession, readSession, writeSession } from '@/src/lib/auth-storage';

type LoginInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  apiBaseUrl: string;
  environmentName: string;
  isHydrating: boolean;
  session: SessionState | null;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateSessionUser: (user: AuthUser) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const { apiBaseUrl, environmentName } = getEnvironmentConfig();

function isUnauthorizedError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: number }).status === 401
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        const storedSession = (await readSession()) as SessionState | null;
        console.log('Restored session from storage:', storedSession);

        if (!storedSession) {
          return;
        }

        if (isMounted) {
          setSession(storedSession);
        }

        try {
          const user = await authApi.me(storedSession.token);

          if (!isMounted) {
            return;
          }

          const nextSession = {
            ...storedSession,
            user,
          };

          setSession(nextSession);
          await writeSession(nextSession);
        } catch (error) {
          if (!isUnauthorizedError(error)) {
            throw error;
          }

          let refreshed;

          try {
            refreshed = await authApi.refresh(storedSession.refreshToken);
          } catch (refreshError) {
            if (!isUnauthorizedError(refreshError)) {
              throw refreshError;
            }

            await clearSession();

            if (isMounted) {
              setSession(null);
            }

            return;
          }

          if (refreshed.user.role !== 'driver') {
            throw new Error('This app is only available to driver accounts.');
          }

          if (!isMounted) {
            return;
          }

          const nextSession = {
            token: refreshed.token,
            refreshToken: refreshed.refresh_token,
            user: refreshed.user,
          };

          setSession(nextSession);
          await writeSession(nextSession);
        }
      } catch {
        // Keep the restored session when bootstrap fails for transient reasons.
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async ({ email, password }: LoginInput) => {
    const payload = await authApi.login({ email, password });

    if (payload.user.role !== 'driver') {
      throw new Error('This app is only available to driver accounts.');
    }

    const nextSession = {
      token: payload.token,
      refreshToken: payload.refresh_token,
      user: payload.user,
    };

    await writeSession(nextSession);
    setSession(nextSession);
  };

  const signOut = async () => {
    const activeToken = session?.token;

    setSession(null);
    await clearSession();

    if (!activeToken) {
      return;
    }

    try {
      await authApi.logout(activeToken);
    } catch {
      // Ignore logout errors after local session teardown.
    }
  };

  const updateSessionUser = async (user: AuthUser) => {
    if (!session) {
      return;
    }

    const nextSession = {
      ...session,
      user,
    };

    setSession(nextSession);
    await writeSession(nextSession);
  };

  return (
    <AuthContext.Provider
      value={{
        apiBaseUrl,
        environmentName,
        isHydrating,
        session,
        signIn,
        signOut,
        updateSessionUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
