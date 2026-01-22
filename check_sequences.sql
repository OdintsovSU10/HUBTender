-- Проверим структуру sequences для двух тактик
SELECT 
  name,
  sequences
FROM markup_tactics 
WHERE name IN ('Базовая схема', 'Базовая схема_с НДС 22%')
ORDER BY name;
