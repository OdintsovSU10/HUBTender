import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { AuthUser } from '../lib/supabase/types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<AuthUser | null>(null);
  const initCompletedRef = useRef(false);

  // Синхронизируем ref с state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Загрузка данных пользователя из public.users
  const loadUserData = useCallback(async (authUserId: string): Promise<AuthUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role_code,
          access_status,
          allowed_pages,
          access_enabled,
          roles:role_code (
            name,
            color
          )
        `)
        .eq('id', authUserId)
        .single();

      if (error || !data) {
        console.error('[AuthContext] Ошибка загрузки пользователя:', error?.message);
        return null;
      }

      const rolesData = (Array.isArray(data.roles) && data.roles.length > 0
        ? data.roles[0]
        : data.roles) as { name: string; color: string } | null;

      return {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: rolesData?.name as any || 'Инженер',
        role_code: data.role_code,
        role_color: rolesData?.color,
        access_status: data.access_status,
        allowed_pages: data.allowed_pages || [],
        access_enabled: data.access_enabled,
      };
    } catch (err) {
      console.error('[AuthContext] Исключение при загрузке пользователя:', err);
      return null;
    }
  }, []);

  // Обновление данных пользователя
  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const userData = await loadUserData(session.user.id);
      setUser(userData);
    } else {
      setUser(null);
    }
  }, [loadUserData]);

  // Выход из системы
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('[AuthContext] Ошибка при выходе:', error);
    }
  }, []);

  // Инициализация при монтировании
  useEffect(() => {
    let mounted = true;

    // Подписываемся на изменения auth состояния
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Игнорируем INITIAL_SESSION - обработаем в initAuth
      if (event === 'INITIAL_SESSION') {
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Обрабатываем только если initAuth завершился И user ещё не установлен
        if (initCompletedRef.current && !userRef.current) {
          const userData = await loadUserData(session.user.id);
          if (mounted) {
            if (userData?.access_enabled && userData?.access_status === 'approved') {
              setUser(userData);
            } else if (userData && (!userData.access_enabled || userData.access_status !== 'approved')) {
              // Пользователь не одобрен или заблокирован - выходим
              await supabase.auth.signOut();
            }
            setLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        const userData = await loadUserData(session.user.id);
        if (mounted && userData) {
          setUser(userData);
        }
      }
    });

    const initAuth = async () => {
      try {
        // Таймаут для getSession - если зависнет, продолжаем без сессии
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }, error: null }>((resolve) => {
          setTimeout(() => resolve({ data: { session: null }, error: null }), 5000);
        });

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user && mounted) {
          const userData = await loadUserData(session.user.id);

          if (mounted) {
            if (userData?.access_enabled && userData?.access_status === 'approved') {
              setUser(userData);
            } else {
              // Пользователь не одобрен - выходим молча
              await supabase.auth.signOut();
            }
          }
        }
      } catch (error) {
        console.error('[AuthContext] Ошибка инициализации:', error);
      } finally {
        initCompletedRef.current = true;
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC для компонентов, требующих навигации после signOut
export const useAuthWithNavigation = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const signOutAndRedirect = useCallback(async () => {
    await auth.signOut();
    navigate('/login', { replace: true });
  }, [auth, navigate]);

  return {
    ...auth,
    signOut: signOutAndRedirect,
  };
};
