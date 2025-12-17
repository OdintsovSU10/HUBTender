import { supabase } from './supabase';

/**
 * Выполняет операцию с установкой контекста пользователя для audit триггера
 *
 * @param userId - ID пользователя из AuthContext
 * @param operation - Асинхронная операция для выполнения
 * @returns Результат операции
 *
 * @example
 * ```typescript
 * const { user } = useAuth();
 *
 * await executeWithAudit(user?.id, async () => {
 *   await supabase.from('boq_items').insert(newItem);
 * });
 * ```
 */
export async function executeWithAudit<T>(
  userId: string | undefined,
  operation: () => Promise<T>
): Promise<T> {
  try {
    // Устанавливаем user_id в application_name через RPC
    if (userId) {
      const { error: setError } = await supabase.rpc('set_audit_user', {
        user_id: userId,
      });

      if (setError) {
        console.warn('[executeWithAudit] Не удалось установить audit user:', setError.message);
        // Продолжаем выполнение даже если не удалось установить user_id
        // Триггер запишет changed_by = NULL
      }
    }

    // Выполняем операцию
    const result = await operation();

    return result;
  } finally {
    // Всегда очищаем application_name после операции
    try {
      const { error: clearError } = await supabase.rpc('clear_audit_user');

      if (clearError) {
        console.warn('[executeWithAudit] Не удалось очистить audit user:', clearError.message);
      }
    } catch (clearEx) {
      console.warn('[executeWithAudit] Исключение при очистке audit user:', clearEx);
    }
  }
}
