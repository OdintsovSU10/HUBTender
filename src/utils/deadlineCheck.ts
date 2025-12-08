import type { AuthUser, TenderDeadlineExtension, DeadlineCheckResult } from '../lib/supabase/types';

// Роли с полным доступом независимо от дедлайна
const ROLES_WITH_FULL_ACCESS = ['administrator', 'director', 'developer', 'veduschiy_inzhener'];

/**
 * Проверяет, может ли пользователь редактировать тендер на основе дедлайна
 * @param tenderId - ID тендера
 * @param tenderDeadline - Дедлайн тендера из таблицы tenders
 * @param user - Текущий пользователь
 * @param userExtensions - Массив продленных дедлайнов пользователя
 */
export const checkTenderDeadline = (
  tenderId: string,
  tenderDeadline: string | null,
  user: AuthUser | null,
  userExtensions: TenderDeadlineExtension[] = []
): DeadlineCheckResult => {
  // Если пользователь не авторизован
  if (!user) {
    return {
      isExpired: true,
      canEdit: false,
      deadline: null,
      isExtended: false
    };
  }

  // Проверка роли: Администратор, Руководитель, Разработчик, Ведущий инженер имеют полный доступ
  if (user.role_code && ROLES_WITH_FULL_ACCESS.includes(user.role_code)) {
    return {
      isExpired: false,
      canEdit: true,
      deadline: null,
      isExtended: false
    };
  }

  // Проверка продленного дедлайна для конкретного тендера
  const extension = userExtensions.find(ext => ext.tender_id === tenderId);

  // Определить эффективный дедлайн (продленный или оригинальный)
  const effectiveDeadline = extension
    ? new Date(extension.extended_deadline)
    : tenderDeadline
      ? new Date(tenderDeadline)
      : null;

  // Если дедлайна нет - доступ разрешен
  if (!effectiveDeadline) {
    return {
      isExpired: false,
      canEdit: true,
      deadline: null,
      isExtended: false
    };
  }

  const now = new Date();
  const isExpired = now > effectiveDeadline;

  return {
    isExpired,
    canEdit: !isExpired,
    deadline: effectiveDeadline,
    isExtended: !!extension
  };
};
