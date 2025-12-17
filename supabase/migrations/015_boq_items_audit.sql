-- Миграция: История изменений BOQ Items
-- Создание таблицы audit, триггеров и RPC функций

-- ============================================================================
-- 1. Таблица audit для хранения истории изменений
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.boq_items_audit (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  boq_item_id uuid NOT NULL REFERENCES public.boq_items(id) ON DELETE CASCADE,
  operation_type text NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],

  CONSTRAINT audit_data_check CHECK (
    (operation_type = 'INSERT' AND old_data IS NULL AND new_data IS NOT NULL) OR
    (operation_type = 'DELETE' AND old_data IS NOT NULL AND new_data IS NULL) OR
    (operation_type = 'UPDATE' AND old_data IS NOT NULL AND new_data IS NOT NULL)
  )
);

-- Комментарий к таблице
COMMENT ON TABLE public.boq_items_audit IS 'История изменений BOQ items с полным snapshot данных';

-- Комментарии к колонкам
COMMENT ON COLUMN public.boq_items_audit.boq_item_id IS 'ID элемента BOQ из таблицы boq_items';
COMMENT ON COLUMN public.boq_items_audit.operation_type IS 'Тип операции: INSERT, UPDATE, DELETE';
COMMENT ON COLUMN public.boq_items_audit.changed_at IS 'Дата и время изменения';
COMMENT ON COLUMN public.boq_items_audit.changed_by IS 'Пользователь, совершивший изменение (из таблицы users)';
COMMENT ON COLUMN public.boq_items_audit.old_data IS 'Snapshot данных до изменения (для UPDATE и DELETE)';
COMMENT ON COLUMN public.boq_items_audit.new_data IS 'Snapshot данных после изменения (для INSERT и UPDATE)';
COMMENT ON COLUMN public.boq_items_audit.changed_fields IS 'Массив названий измененных полей (только для UPDATE)';

-- ============================================================================
-- 2. Индексы для оптимизации запросов
-- ============================================================================

CREATE INDEX idx_boq_items_audit_item_id ON public.boq_items_audit(boq_item_id);
CREATE INDEX idx_boq_items_audit_changed_at ON public.boq_items_audit(changed_at DESC);
CREATE INDEX idx_boq_items_audit_changed_by ON public.boq_items_audit(changed_by);
CREATE INDEX idx_boq_items_audit_operation ON public.boq_items_audit(operation_type);
CREATE INDEX idx_boq_items_audit_fields ON public.boq_items_audit USING gin(changed_fields);

-- ============================================================================
-- 3. RPC функции для установки контекста пользователя
-- ============================================================================

-- Функция для установки user_id в application_name
CREATE OR REPLACE FUNCTION public.set_audit_user(user_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('application_name', 'app_user_' || user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_audit_user(uuid) IS 'Устанавливает user_id в application_name для триггера audit';

-- Функция для очистки application_name
CREATE OR REPLACE FUNCTION public.clear_audit_user()
RETURNS void AS $$
BEGIN
  PERFORM set_config('application_name', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.clear_audit_user() IS 'Очищает application_name после завершения операции';

-- ============================================================================
-- 4. Триггер-функция для автоматического логирования изменений
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_boq_items_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_changed_fields text[];
  v_key text;
  v_old_val jsonb;
  v_new_val jsonb;
BEGIN
  -- Получаем user_id из application_name (формат: "app_user_<uuid>")
  v_user_id := NULLIF(
    substring(current_setting('application_name', true) FROM 'app_user_(.+)$'),
    ''
  )::uuid;

  -- Вычисляем измененные поля для UPDATE
  IF TG_OP = 'UPDATE' THEN
    v_changed_fields := ARRAY[]::text[];

    FOR v_key IN
      SELECT jsonb_object_keys(to_jsonb(NEW.*))
    LOOP
      -- Сравниваем значения полей
      v_old_val := to_jsonb(OLD.*) -> v_key;
      v_new_val := to_jsonb(NEW.*) -> v_key;

      -- Исключаем служебные поля и неизмененные значения
      IF v_key NOT IN ('updated_at', 'created_at')
         AND (v_old_val IS DISTINCT FROM v_new_val) THEN
        v_changed_fields := array_append(v_changed_fields, v_key);
      END IF;
    END LOOP;

    -- Если изменений нет (только updated_at), не логируем
    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Вставка записи в audit
  INSERT INTO public.boq_items_audit (
    boq_item_id,
    operation_type,
    changed_by,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    v_user_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD.*) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW.*) ELSE NULL END,
    v_changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.log_boq_items_changes() IS 'Триггер-функция для логирования всех изменений в boq_items';

-- ============================================================================
-- 5. Триггер на таблице boq_items
-- ============================================================================

DROP TRIGGER IF EXISTS boq_items_audit_trigger ON public.boq_items;

CREATE TRIGGER boq_items_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.boq_items
FOR EACH ROW EXECUTE FUNCTION public.log_boq_items_changes();

COMMENT ON TRIGGER boq_items_audit_trigger ON public.boq_items IS 'Триггер для автоматической записи истории изменений';

-- ============================================================================
-- 6. Права доступа (опционально, если используется RLS)
-- ============================================================================

-- Предоставляем доступ к таблице audit (если требуется)
-- GRANT SELECT ON public.boq_items_audit TO authenticated;
-- GRANT SELECT ON public.boq_items_audit TO anon;

-- Предоставляем доступ к RPC функциям
GRANT EXECUTE ON FUNCTION public.set_audit_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_audit_user() TO authenticated;

-- ============================================================================
-- Примечания:
-- ============================================================================
--
-- После выполнения миграции может потребоваться:
-- NOTIFY pgrst, 'reload schema';
--
-- Для проверки работы триггера:
--
-- 1. Установить user_id:
--    SELECT set_audit_user('ваш-uuid');
--
-- 2. Выполнить операцию:
--    INSERT INTO boq_items (...) VALUES (...);
--    UPDATE boq_items SET quantity = 10 WHERE id = 'какой-то-id';
--    DELETE FROM boq_items WHERE id = 'какой-то-id';
--
-- 3. Проверить audit:
--    SELECT * FROM boq_items_audit ORDER BY changed_at DESC;
--
-- 4. Очистить user_id:
--    SELECT clear_audit_user();
--
-- ============================================================================
