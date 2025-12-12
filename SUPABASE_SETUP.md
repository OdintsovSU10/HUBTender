# Настройка Supabase для сброса пароля на Vercel

## Проблема
При сбросе пароля на Vercel, ссылка в письме ведёт на localhost вместо production URL.

## Решение

### 1. Настройка переменных окружения

В Vercel Dashboard добавьте переменную окружения:

```
VITE_APP_URL=https://hub-tender.vercel.app
```

**Важно**: После добавления переменной нужно пересобрать проект (Redeploy).

### 2. Настройка Supabase Dashboard

1. Откройте **Supabase Dashboard** → ваш проект → **Authentication** → **URL Configuration**

2. Установите **Site URL**:
   ```
   https://hub-tender.vercel.app
   ```

3. Добавьте в **Redirect URLs**:
   ```
   https://hub-tender.vercel.app/reset-password
   https://hub-tender.vercel.app/**
   http://localhost:3000/reset-password
   http://localhost:3000/**
   ```

4. Сохраните изменения

### 3. Проверка

1. На Vercel: откройте https://hub-tender.vercel.app/forgot-password
2. Введите email и отправьте запрос на сброс пароля
3. Проверьте письмо - ссылка должна вести на https://hub-tender.vercel.app/reset-password?token=...
4. Перейдите по ссылке и установите новый пароль

## Локальная разработка

При локальной разработке:
- Если `VITE_APP_URL` НЕ указан в `.env.local` → используется `http://localhost:3000`
- Если `VITE_APP_URL` указан → используется Vercel URL (для тестирования production flow)

## Важно

- `.env.local` НЕ коммитится в git (добавлен в .gitignore)
- `.env.example` содержит шаблон всех необходимых переменных
- Переменные окружения в Vercel настраиваются отдельно в Dashboard
