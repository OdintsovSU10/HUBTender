import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { checkTenderDeadline } from '../utils/deadlineCheck';
import type { DeadlineCheckResult, TenderDeadlineExtension } from '../lib/supabase/types';

/**
 * Хук для проверки дедлайна тендера и прав доступа пользователя
 * @param tenderId - ID тендера
 * @returns Статус дедлайна и флаги доступа
 */
export const useDeadlineCheck = (tenderId: string | undefined) => {
  const { user } = useAuth();
  const [deadlineStatus, setDeadlineStatus] = useState<DeadlineCheckResult>({
    isExpired: false,
    canEdit: true,
    deadline: null,
    isExtended: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeadlineInfo = async () => {
      if (!tenderId || !user) {
        setDeadlineStatus({
          isExpired: false,
          canEdit: true,
          deadline: null,
          isExtended: false
        });
        setLoading(false);
        return;
      }

      try {
        // Получить дедлайн тендера
        const { data: tender, error: tenderError } = await supabase
          .from('tenders')
          .select('submission_deadline')
          .eq('id', tenderId)
          .single();

        if (tenderError) throw tenderError;

        // Получить продления пользователя
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('tender_deadline_extensions')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;

        const extensions: TenderDeadlineExtension[] =
          userData?.tender_deadline_extensions || [];

        const result = checkTenderDeadline(
          tenderId,
          tender?.submission_deadline || null,
          user,
          extensions
        );

        setDeadlineStatus(result);
      } catch (error) {
        console.error('Ошибка проверки дедлайна:', error);
        // В случае ошибки разрешаем редактирование
        setDeadlineStatus({
          isExpired: false,
          canEdit: true,
          deadline: null,
          isExtended: false
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDeadlineInfo();
  }, [tenderId, user]);

  return {
    ...deadlineStatus,
    loading
  };
};
