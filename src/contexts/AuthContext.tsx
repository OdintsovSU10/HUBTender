import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { message } from 'antd';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
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

/**
 * Retry utility with exponential backoff
 * Retries network errors up to maxRetries times with exponentially increasing delays
 */
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 200
): Promise<T | null> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      const isLastAttempt = attempt === maxRetries;
      const isNetworkError =
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('Network request failed') ||
        err.message?.includes('timeout') ||
        err.code === 'PGRST301'; // PostgREST timeout

      if (!isNetworkError || isLastAttempt) {
        throw error; // Critical error or exhausted retries
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(
        `🔄 Retry attempt ${attempt}/${maxRetries} after ${delay}ms`,
        { error: err.message }
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const initialSessionHandled = useRef(false);
  const isProcessingEvent = useRef(false);

  /**
   * Загрузка данных пользователя из таблицы public.users
   * С retry механизмом для обработки временных сетевых ошибок
   */
  const loadUserData = async (
    authUser: SupabaseUser,
    isRetry: boolean = false
  ): Promise<AuthUser | null> => {
    const startTime = Date.now();
    console.log('🔵 loadUserData START', { userId: authUser.id, isRetry });

    try {
      const result = await retryWithBackoff(async () => {
        console.log('🔵 Fetching user from database...', { userId: authUser.id });

        // Добавляем таймаут к запросу
        const queryPromise = supabase
          .from('users')
          .select(`
            *,
            roles:role_code (
              name,
              color
            )
          `)
          .eq('id', authUser.id)
          .single();

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Database query timeout after 10s')), 10000);
        });

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        console.log('🔵 Database response', { hasData: !!data, hasError: !!error, error: error?.message });
        if (error) throw error;
        if (!data) throw new Error('USER_NOT_FOUND');

        return data;
      });

      if (!result) {
        console.error('❌ loadUserData: все попытки retry исчерпаны', {
          userId: authUser.id,
          duration: Date.now() - startTime,
        });
        return null;
      }

      // Check access_enabled BEFORE checking access_status
      if (!result.access_enabled) {
        console.warn('⚠️ Пользователь заблокирован (access_enabled=false)', {
          userId: result.id,
          email: result.email,
        });
        return null; // Critical: user disabled
      }

      if (result.access_status !== 'approved') {
        console.warn('⚠️ Пользователь не одобрен', {
          userId: result.id,
          status: result.access_status,
        });
        return null; // Critical: not approved
      }

      // Формируем объект AuthUser
      const resultWithRoles = result as typeof result & {
        roles?: { name: string; color: string };
      };

      const userData: AuthUser = {
        id: result.id,
        email: result.email,
        full_name: result.full_name,
        role: resultWithRoles.roles?.name || 'Пользователь',
        role_code: result.role_code,
        role_color: resultWithRoles.roles?.color,
        access_status: result.access_status,
        allowed_pages: Array.isArray(result.allowed_pages) ? result.allowed_pages : [],
        access_enabled: result.access_enabled ?? true,
      };

      console.log('✅ loadUserData success', {
        userId: userData.id,
        role: userData.role_code,
        duration: Date.now() - startTime,
        isRetry,
      });

      return userData;
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      const duration = Date.now() - startTime;

      // Classify error
      const isCritical =
        err.message === 'USER_NOT_FOUND' || err.code === 'PGRST116'; // Row not found

      console.error(
        isCritical
          ? '❌ CRITICAL: Пользователь не найден'
          : '⚠️ Временная ошибка loadUserData',
        {
          userId: authUser.id,
          error: err.message,
          code: err.code,
          duration,
          isCritical,
        }
      );

      return null;
    }
  };

  /**
   * Обновление данных текущего пользователя
   * Не выходит при временных ошибках, сохраняет текущего user
   */
  const refreshUser = async () => {
    console.log('🔄 refreshUser called', { currentUserId: user?.id });

    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser();

      if (error) throw error;

      if (authUser) {
        const userData = await loadUserData(authUser);

        if (userData) {
          setUser(userData);
          console.log('✅ refreshUser: user updated');
        } else {
          console.warn('⚠️ refreshUser: failed to load user data, keeping current', {
            authUserId: authUser.id,
            currentUserId: user?.id,
          });
          // Don't logout, keep current user
        }
      } else {
        console.warn('⚠️ refreshUser: no auth user');
        setUser(null);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error('❌ refreshUser error', {
        error: err.message,
        currentUserId: user?.id,
      });
      // Don't logout on refresh errors - keep current user
    }
  };

  /**
   * Выход из системы
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Если сессия уже отсутствует (AuthSessionMissingError), это не критично
        if (error.message.includes('Auth session missing')) {
          console.warn('Сессия уже отсутствует, очищаем локальное состояние');
        } else {
          console.error('Ошибка при выходе:', error);
        }
      }
      // В любом случае очищаем локальное состояние
      setUser(null);
      message.info('Вы вышли из системы');
    } catch (error: any) {
      console.error('Неожиданная ошибка при выходе:', error);
      // Даже при ошибке очищаем локальное состояние
      setUser(null);
      message.info('Вы вышли из системы');
    }
  };

  // Инициализация: проверка текущей сессии при монтировании
  useEffect(() => {
    let isSubscribed = true;
    let signedInTimeout: NodeJS.Timeout | null = null;

    // Подписываемся на изменения состояния аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) {
          console.log('⚠️ Event received after unsubscribe, ignoring:', event);
          return;
        }

        console.log('🔵 Auth event:', event, {
          userId: session?.user?.id,
          hasSession: !!session,
          currentUser: user?.id,
          initialSessionHandled: initialSessionHandled.current,
          isProcessing: isProcessingEvent.current,
        });

        // Защита от одновременной обработки нескольких событий
        if (isProcessingEvent.current) {
          console.log('⚠️ Already processing an event, skipping:', event);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          console.log('🟢 Handling INITIAL_SESSION');
          isProcessingEvent.current = true;

          // Отменяем таймер SIGNED_IN если он был запущен
          if (signedInTimeout) {
            clearTimeout(signedInTimeout);
            signedInTimeout = null;
          }

          // Обрабатываем начальную сессию (происходит при открытии новой вкладки или первой загрузке)
          // Также обрабатывает реальный вход через форму (INITIAL_SESSION приходит после SIGNED_IN)
          if (session?.user) {
            const userData = await loadUserData(session.user);
            setUser(userData);
            console.log('✅ User loaded from INITIAL_SESSION');
          } else {
            console.log('🔵 No session in INITIAL_SESSION');
            setUser(null);
          }
          setLoading(false);
          initialSessionHandled.current = true;
          isProcessingEvent.current = false;
        } else if (event === 'SIGNED_IN' && session?.user) {
          // Обрабатываем SIGNED_IN только если INITIAL_SESSION уже был обработан
          // Это позволяет обработать вход через форму, но избежать двойной обработки при монтировании
          if (!initialSessionHandled.current) {
            console.log('⚠️ Skipping SIGNED_IN - waiting for INITIAL_SESSION');
            return;
          }

          console.log('🟢 Handling SIGNED_IN event (after login)');
          isProcessingEvent.current = true;

          const userData = await loadUserData(session.user);
          if (userData) {
            setUser(userData);
            console.log('✅ User loaded from SIGNED_IN');
          } else {
            console.warn('⚠️ Failed to load user from SIGNED_IN');
            setUser(null);
          }

          isProcessingEvent.current = false;
        } else if (event === 'SIGNED_OUT') {
          console.log('🔴 SIGNED_OUT event', {
            currentUserId: user?.id,
            hadSession: !!session,
            timestamp: new Date().toISOString(),
          });

          // Отменяем таймер SIGNED_IN если он был запущен
          if (signedInTimeout) {
            clearTimeout(signedInTimeout);
            signedInTimeout = null;
          }

          // Check if we still have a valid session (might be a false SIGNED_OUT)
          // This can happen when refresh token fails with 500 error
          if (user) {
            console.warn('⚠️ SIGNED_OUT received but user exists, verifying session...');

            try {
              const { data: { session: currentSession } } = await supabase.auth.getSession();

              if (currentSession?.user) {
                console.log('✅ Session still valid, ignoring SIGNED_OUT', {
                  userId: currentSession.user.id,
                });
                // Keep current user, don't logout
                return;
              }
            } catch (error) {
              console.error('❌ Error verifying session during SIGNED_OUT', error);
            }
          }

          // Proceed with logout if no valid session found
          console.log('🔴 Proceeding with logout');
          setUser(null);
          setLoading(false);
          initialSessionHandled.current = false;
          isProcessingEvent.current = false;
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 TOKEN_REFRESHED event', {
            userId: session.user.id,
            timestamp: new Date().toISOString(),
          });

          try {
            const userData = await loadUserData(session.user, true);

            if (userData) {
              setUser(userData);
              console.log('✅ User data refreshed after token renewal');
            } else {
              // CRITICAL: Don't logout on temporary errors during token refresh
              console.warn('⚠️ Failed to refresh user data, keeping current user', {
                currentUserId: user?.id,
                sessionUserId: session.user.id,
              });

              // Only logout if user IDs mismatch (security issue)
              if (user && user.id !== session.user.id) {
                console.error('❌ SECURITY: User ID mismatch, forcing logout');
                setUser(null);
              }
              // Otherwise keep current user
            }
          } catch (error) {
            console.error('❌ Error in TOKEN_REFRESHED handler', error);
            // Keep current user on error
          }
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('🔄 USER_UPDATED event', {
            userId: session.user.id,
            timestamp: new Date().toISOString(),
          });

          try {
            const userData = await loadUserData(session.user);

            if (userData) {
              setUser(userData);
              console.log('✅ User data updated');
            } else {
              console.warn('⚠️ Failed to update user data, keeping current user', {
                currentUserId: user?.id,
                sessionUserId: session.user.id,
              });
              // Keep current user on error
            }
          } catch (error) {
            console.error('❌ Error in USER_UPDATED handler', error);
            // Keep current user on error
          }
        }
      }
    );

    // Фоллбэк: если через 2 секунды события не пришло, проверяем сессию вручную
    const fallbackTimeout = setTimeout(async () => {
      console.log('⏱️ Fallback timeout triggered (2s after mount)');

      if (user || !loading) {
        console.log('✅ User already loaded or loading complete, skipping fallback');
        return;
      }

      if (!initialSessionHandled.current && isSubscribed) {
        console.warn('⚠️ Auth event did not fire, checking session manually');
        try {
          // Добавляем таймаут для getSession
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('getSession timeout after 5s')), 5000);
          });

          const result = await Promise.race([sessionPromise, timeoutPromise]);

          if ('data' in result && result.data?.session?.user) {
            console.log('✅ Fallback: session found', {
              userId: result.data.session.user.id,
            });

            const userData = await loadUserData(result.data.session.user);

            if (userData) {
              setUser(userData);
            } else {
              console.warn('⚠️ Fallback: failed to load user data');
              setUser(null);
            }
          } else {
            console.log('ℹ️ Fallback: no session');
            setUser(null);
          }
        } catch (error: unknown) {
          const err = error as Error;
          console.error('❌ Fallback timeout error', {
            error: err.message,
            stack: err.stack,
          });
          setUser(null);
        } finally {
          setLoading(false);
          initialSessionHandled.current = true;
        }
      }
    }, 2000);

    // Очистка подписки при размонтировании
    return () => {
      isSubscribed = false;
      if (signedInTimeout) clearTimeout(signedInTimeout);
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Хук для использования AuthContext
 * Выбрасывает ошибку, если используется вне AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
