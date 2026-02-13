-- Функция для автоматического создания записи в tender_registry при добавлении tenders
CREATE OR REPLACE FUNCTION auto_create_tender_registry()
RETURNS TRIGGER AS $$
DECLARE
  default_status_id UUID;
  next_sort_order INTEGER;
BEGIN
  -- Получить ID статуса "В работе" (или первый доступный статус)
  SELECT id INTO default_status_id
  FROM tender_statuses
  WHERE name = 'В работе'
  LIMIT 1;

  -- Если статус не найден, использовать первый доступный
  IF default_status_id IS NULL THEN
    SELECT id INTO default_status_id
    FROM tender_statuses
    LIMIT 1;
  END IF;

  -- Получить следующий sort_order
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO next_sort_order
  FROM tender_registry;

  -- Создать запись в tender_registry
  INSERT INTO tender_registry (
    title,
    client_name,
    tender_number,
    area,
    construction_scope_id,
    status_id,
    created_by,
    is_archived,
    sort_order
  )
  VALUES (
    NEW.title,                    -- Наименование
    NEW.client_name,              -- Заказчик
    NEW.tender_number,            -- Номер тендера
    NEW.area_sp,                  -- Площадь по СП
    (SELECT id FROM construction_scopes WHERE name::text = NEW.construction_scope::text LIMIT 1), -- Объем строительства
    default_status_id,            -- Статус по умолчанию
    NEW.created_by,               -- Кто создал
    FALSE,                        -- Не архивный
    next_sort_order               -- Порядок сортировки
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создать триггер AFTER INSERT на таблицу tenders
DROP TRIGGER IF EXISTS trigger_auto_create_tender_registry ON tenders;

CREATE TRIGGER trigger_auto_create_tender_registry
  AFTER INSERT ON tenders
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_tender_registry();

-- Комментарий
COMMENT ON FUNCTION auto_create_tender_registry() IS 'Автоматически создает запись в tender_registry при добавлении нового тендера в tenders';

-- =============================================
-- Автоматическое архивирование при статусах "Проиграли" или "Выиграли"
-- =============================================

-- Функция для автоматического архивирования при изменении статуса
CREATE OR REPLACE FUNCTION auto_archive_tender_registry()
RETURNS TRIGGER AS $$
DECLARE
  status_name TEXT;
BEGIN
  -- Получить название нового статуса
  SELECT name INTO status_name
  FROM tender_statuses
  WHERE id = NEW.status_id;

  -- Если статус "Проиграли" или "Выиграли" - архивировать
  IF status_name IN ('Проиграли', 'Выиграли') THEN
    NEW.is_archived = TRUE;
  -- Если статус "В работе" или "Ожидаем тендерный пакет" - разархивировать
  ELSIF status_name IN ('В работе', 'Ожидаем тендерный пакет') THEN
    NEW.is_archived = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создать триггер BEFORE UPDATE на таблицу tender_registry
DROP TRIGGER IF EXISTS trigger_auto_archive_tender_registry ON tender_registry;

CREATE TRIGGER trigger_auto_archive_tender_registry
  BEFORE UPDATE ON tender_registry
  FOR EACH ROW
  WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
  EXECUTE FUNCTION auto_archive_tender_registry();

-- Комментарий
COMMENT ON FUNCTION auto_archive_tender_registry() IS 'Автоматически архивирует тендер при установке статуса "Проиграли" или "Выиграли"';
