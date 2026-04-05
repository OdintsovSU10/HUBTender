import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { supabase } from '../lib/supabase';
import type { TenderNote, TenderNoteFull } from '../lib/supabase/types';

interface UseTenderNotesResult {
  myNote: TenderNote | null;
  allNotes: TenderNoteFull[];
  loading: boolean;
  saving: boolean;
  saveNote: (text: string) => Promise<void>;
}

export const useTenderNotes = (
  tenderId: string | null,
  userId: string | null,
  canViewAll: boolean,
): UseTenderNotesResult => {
  const [myNote, setMyNote] = useState<TenderNote | null>(null);
  const [allNotes, setAllNotes] = useState<TenderNoteFull[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!tenderId || !userId) {
      setMyNote(null);
      setAllNotes([]);
      return;
    }

    setLoading(true);
    try {
      if (canViewAll) {
        // Шаг 1: все заметки тендера
        const { data: notesData, error: notesError } = await supabase
          .from('tender_notes')
          .select('*')
          .eq('tender_id', tenderId)
          .order('updated_at', { ascending: false });

        if (notesError) throw notesError;

        const rows = notesData || [];

        // Шаг 2: имена авторов из public.users
        const userIds = [...new Set(rows.map(r => r.user_id))];
        const { data: usersData } = userIds.length > 0
          ? await supabase.from('users').select('id, full_name').in('id', userIds)
          : { data: [] };

        const nameMap = Object.fromEntries(
          (usersData || []).map((u: { id: string; full_name: string }) => [u.id, u.full_name]),
        );

        const notes: TenderNoteFull[] = rows
          .filter(row => row.note_text.trim() !== '')
          .map(row => ({
            id: row.id,
            tender_id: row.tender_id,
            user_id: row.user_id,
            note_text: row.note_text,
            created_at: row.created_at,
            updated_at: row.updated_at,
            user_full_name: nameMap[row.user_id] ?? 'Неизвестный',
          }));

        setAllNotes(notes);
        const own = notes.find(n => n.user_id === userId) ?? null;
        setMyNote(own);
      } else {
        // Обычный пользователь видит только свою заметку (RLS уже фильтрует)
        const { data, error } = await supabase
          .from('tender_notes')
          .select('*')
          .eq('tender_id', tenderId)
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;
        // Игнорируем запись с пустым текстом
        setMyNote(data && data.note_text.trim() !== '' ? data : null);
        setAllNotes([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки заметок:', err);
    } finally {
      setLoading(false);
    }
  }, [tenderId, userId, canViewAll]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const saveNote = useCallback(async (text: string) => {
    if (!tenderId || !userId) return;

    setSaving(true);
    try {
      if (text.trim() === '') {
        // Пустой текст — удаляем запись, чтобы пользователь не фигурировал в списке
        const { error } = await supabase
          .from('tender_notes')
          .delete()
          .eq('tender_id', tenderId)
          .eq('user_id', userId);

        if (error) throw error;
        message.success('Заметка удалена');
      } else {
        const { error } = await supabase
          .from('tender_notes')
          .upsert(
            { tender_id: tenderId, user_id: userId, note_text: text },
            { onConflict: 'tender_id,user_id' },
          );

        if (error) throw error;
        message.success('Заметка сохранена');
      }

      await fetchNotes();
    } catch (err) {
      console.error('Ошибка сохранения заметки:', err);
      message.error('Не удалось сохранить заметку');
    } finally {
      setSaving(false);
    }
  }, [tenderId, userId, fetchNotes]);

  return { myNote, allNotes, loading, saving, saveNote };
};
