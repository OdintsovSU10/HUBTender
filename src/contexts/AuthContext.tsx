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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const initialSessionHandled = useRef(false);
  const isProcessingEvent = useRef(false);

  /**
   * Загрузка данных пользователя из таблицы public.users
   */
  const loadUserData = async (authUser: SupabaseUser): Promise<AuthUser | null> => {
    try {
      const { data, error } = await supabase
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

      if (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        return null;
      }

      if (!data) {
        console.error('Пользователь не найден в таблице users');
        return null;
      }

      // Формируем объект AuthUser
      const userData: AuthUser = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: (data as any).roles?.name || 'Пользователь',
        role_code: data.role_code,
        role_color: (data as any).roles?.color,
        access_status: data.access_status,
        allowed_pages: Array.isArray(data.allowed_pages) ? data.allowed_pages : [],
        access_enabled: data.access_enabled ?? true,
      };

      return userData;
    } catch (err) {
      console.error('Неожиданная ошибка при загрузке пользователя:', err);
      return null;
    }
  };

  /**
   * Обновление данных текущего пользователя
   */
  const refreshUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        const userData = await loadUserData(authUser);
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Ошибка обновления пользователя:', error);
      setUser(null);
    }
  };

  /**
   * Выход из системы
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Ошибка при выходе:', error);
        message.error('Не удалось выйти из системы');
      } else {
        setUser(null);
        message.info('Вы вышли из системы');
      }
    } catch (error) {
      console.error('Неожиданная ошибка при выходе:', error);
      message.error('Произошла ошибка при выходе из системы');
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
          // SIGNED_IN игнорируем, НО запускаем таймер
          // Если через 1.5 секунды INITIAL_SESSION не придет - обработаем вручную
          console.log('⚠️ Ignoring SIGNED_IN, waiting for INITIAL_SESSION...');

          // Запускаем таймер только если INITIAL_SESSION еще не был обработан
          if (!initialSessionHandled.current) {
            signedInTimeout = setTimeout(async () => {
              if (!initialSessionHandled.current && isSubscribed) {
                console.log('⚠️ INITIAL_SESSION did not arrive, handling SIGNED_IN manually');
                isProcessingEvent.current = true;

                const userData = await loadUserData(session.user);
                setUser(userData);
                setLoading(false);
                initialSessionHandled.current = true;
                isProcessingEvent.current = false;
                console.log('✅ User loaded from SIGNED_IN fallback');
              }
            }, 1500);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('🔴 Handling SIGNED_OUT');

          // Отменяем таймер SIGNED_IN если он был запущен
          if (signedInTimeout) {
            clearTimeout(signedInTimeout);
            signedInTimeout = null;
          }

          setUser(null);
          setLoading(false);
          initialSessionHandled.current = false;
          isProcessingEvent.current = false;
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 Handling TOKEN_REFRESHED');
          const userData = await loadUserData(session.user);
          setUser(userData);
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('🔄 Handling USER_UPDATED');
          const userData = await loadUserData(session.user);
          setUser(userData);
        }
      }
    );

    // Фоллбэк: если через 2 секунды события не пришло, проверяем сессию вручную
    const fallbackTimeout = setTimeout(async () => {
      if (!initialSessionHandled.current && isSubscribed) {
        console.warn('Auth event did not fire, checking session manually');
        try {
          // Добавляем таймаут для getSession
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('getSession timeout')), 5000);
          });

          const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
          const { data: { session } } = result;

          if (session?.user) {
            const userData = await loadUserData(session.user);
            setUser(userData);
          } else {
            setUser(null);
          }
          setLoading(false);
          initialSessionHandled.current = true;
        } catch (error) {
          console.error('Error in manual session check:', error);
          setUser(null);
          setLoading(false);
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
