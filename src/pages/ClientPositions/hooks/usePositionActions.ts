import { useState } from 'react';
import { message, Modal } from 'antd';
import { supabase, type ClientPosition } from '../../../lib/supabase';
import { copyBoqItems } from '../../../utils/copyBoqItems';
import { exportPositionsToExcel } from '../../../utils/excel';
import { pluralize } from '../../../utils/pluralize';

export const usePositionActions = (
  _clientPositions: ClientPosition[],
  setClientPositions: React.Dispatch<React.SetStateAction<ClientPosition[]>>,
  setLoading: (loading: boolean) => void,
  fetchClientPositions: (tenderId: string) => Promise<void>,
  currentTheme: string
) => {
  const [copiedPositionId, setCopiedPositionId] = useState<string | null>(null);
  const [copiedNoteValue, setCopiedNoteValue] = useState<string | null>(null);
  const [copiedNotePositionId, setCopiedNotePositionId] = useState<string | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [isBulkPasting, setIsBulkPasting] = useState(false);
  const [isDeleteSelectionMode, setIsDeleteSelectionMode] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Обновление позиции в БД
  const handleUpdatePosition = async (
    positionId: string,
    field: 'manual_volume' | 'manual_note',
    value: number | string | null
  ) => {
    try {
      // Валидация для количества
      if (field === 'manual_volume') {
        if (value === null || value === '') {
          message.error('Количество ГП обязательно для заполнения');
          return;
        }

        const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

        if (isNaN(numValue) || numValue <= 0) {
          message.error('Количество должно быть положительным числом');
          return;
        }

        value = numValue;
      }

      // Обновление в БД
      const { error } = await supabase
        .from('client_positions')
        .update({ [field]: value })
        .eq('id', positionId);

      if (error) throw error;

      // Обновление локального состояния
      setClientPositions(prev =>
        prev.map(pos =>
          pos.id === positionId ? { ...pos, [field]: value } : pos
        )
      );

      message.success('Данные сохранены');
    } catch (error: any) {
      console.error('Ошибка обновления позиции:', error);
      message.error('Ошибка сохранения: ' + error.message);
    }
  };

  // Копирование позиции
  const handleCopyPosition = (positionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setCopiedPositionId(positionId);
    setSelectedTargetIds(new Set());
    setIsDeleteSelectionMode(false);
    setSelectedDeleteIds(new Set());
    message.success('Позиция скопирована в буфер обмена');
  };

  // Вставка позиции
  const handlePastePosition = async (targetPositionId: string, event: React.MouseEvent, selectedTenderId: string | null) => {
    event.stopPropagation();
    if (!copiedPositionId) return;

    setLoading(true);
    try {
      const result = await copyBoqItems(copiedPositionId, targetPositionId);
      message.success(
        `Вставлено: ${result.worksCount} работ, ${result.materialsCount} материалов`
      );
      setCopiedPositionId(null); // Сброс после вставки
      if (selectedTenderId) {
        await fetchClientPositions(selectedTenderId); // Обновить таблицу
      }
    } catch (error: any) {
      console.error('Ошибка вставки:', error);
      message.error('Ошибка вставки: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle выбора строки для массовой вставки
  const handleToggleSelection = (positionId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (positionId === copiedPositionId) {
      message.warning('Нельзя вставить позицию саму в себя');
      return;
    }

    setSelectedTargetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(positionId)) {
        newSet.delete(positionId);
      } else {
        newSet.add(positionId);
      }
      return newSet;
    });
  };

  // Массовая вставка в выбранные позиции
  const handleBulkPaste = async (selectedTenderId: string | null) => {
    if (!copiedPositionId || selectedTargetIds.size === 0) return;

    setIsBulkPasting(true);
    const results = { success: 0, failed: 0 };

    try {
      for (const targetId of selectedTargetIds) {
        try {
          await copyBoqItems(copiedPositionId, targetId);
          results.success++;
        } catch (error) {
          console.error(`Failed to paste to ${targetId}:`, error);
          results.failed++;
        }
      }

      const total = selectedTargetIds.size;
      if (results.failed === 0) {
        message.success(
          `Успешно вставлено в ${total} ${pluralize(total, 'позицию', 'позиции', 'позиций')}`
        );
      } else {
        message.warning(
          `Вставлено в ${results.success} из ${total} ${pluralize(total, 'позиции', 'позиций', 'позиций')}`
        );
      }

      setSelectedTargetIds(new Set());
      setCopiedPositionId(null); // Сбросить буфер обмена

      if (selectedTenderId) {
        await fetchClientPositions(selectedTenderId);
      }
    } catch (error: any) {
      console.error('Ошибка массовой вставки:', error);
      message.error('Ошибка массовой вставки: ' + error.message);
    } finally {
      setIsBulkPasting(false);
    }
  };

  // Экспорт в Excel
  const handleExportToExcel = async (selectedTender: any) => {
    if (!selectedTender) {
      message.error('Выберите тендер для экспорта');
      return;
    }

    const hideLoading = message.loading('Формирование Excel файла...', 0);
    try {
      await exportPositionsToExcel(
        selectedTender.id,
        selectedTender.title,
        selectedTender.version
      );
      hideLoading();
      message.success('Файл успешно экспортирован');
    } catch (error: any) {
      console.error('Ошибка экспорта:', error);
      hideLoading();
      message.error('Ошибка экспорта: ' + error.message);
    }
  };

  // Копирование примечания ГП
  const handleCopyNote = (positionId: string, noteValue: string | null, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!noteValue || noteValue.trim() === '') {
      message.warning('Примечание ГП пустое. Нечего копировать.');
      return;
    }

    setCopiedNoteValue(noteValue);
    setCopiedNotePositionId(positionId);
    setSelectedTargetIds(new Set());
    setIsDeleteSelectionMode(false);
    setSelectedDeleteIds(new Set());
    message.success('Примечание ГП скопировано в буфер обмена');
  };

  // Вставка примечания ГП
  const handlePasteNote = async (targetPositionId: string, event: React.MouseEvent, selectedTenderId: string | null) => {
    event.stopPropagation();

    if (!copiedNoteValue || !copiedNotePositionId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('client_positions')
        .update({ manual_note: copiedNoteValue })
        .eq('id', targetPositionId);

      if (error) throw error;

      // Сбросить состояние
      setCopiedNoteValue(null);
      setCopiedNotePositionId(null);

      // Обновить таблицу
      if (selectedTenderId) {
        await fetchClientPositions(selectedTenderId);
      }

      message.success('Примечание ГП успешно вставлено');
    } catch (error: any) {
      console.error('Ошибка вставки примечания:', error);
      message.error('Ошибка вставки примечания: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Массовая вставка примечания ГП в выбранные позиции
  const handleBulkPasteNote = async (selectedTenderId: string | null) => {
    if (!copiedNoteValue || !copiedNotePositionId || selectedTargetIds.size === 0) return;

    setIsBulkPasting(true);
    const results = { success: 0, failed: 0 };

    try {
      for (const targetId of selectedTargetIds) {
        try {
          const { error } = await supabase
            .from('client_positions')
            .update({ manual_note: copiedNoteValue })
            .eq('id', targetId);

          if (error) throw error;
          results.success++;
        } catch (error) {
          console.error(`Failed to paste note to ${targetId}:`, error);
          results.failed++;
        }
      }

      const total = selectedTargetIds.size;
      if (results.failed === 0) {
        message.success(
          `Успешно вставлено примечание в ${total} ${pluralize(total, 'позицию', 'позиции', 'позиций')}`
        );
      } else {
        message.warning(
          `Вставлено примечание в ${results.success} из ${total} ${pluralize(total, 'позиции', 'позиций', 'позиций')}`
        );
      }

      setSelectedTargetIds(new Set());
      setCopiedNoteValue(null);
      setCopiedNotePositionId(null);

      if (selectedTenderId) {
        await fetchClientPositions(selectedTenderId);
      }
    } catch (error: any) {
      console.error('Ошибка массовой вставки примечания:', error);
      message.error('Ошибка массовой вставки примечания: ' + error.message);
    } finally {
      setIsBulkPasting(false);
    }
  };

  // Вход в режим массового удаления работ и материалов
  const handleStartDeleteSelection = (positionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    // Сбрасываем режимы копирования
    setCopiedPositionId(null);
    setCopiedNoteValue(null);
    setCopiedNotePositionId(null);
    setSelectedTargetIds(new Set());
    // Включаем режим удаления с первой выбранной позицией
    setIsDeleteSelectionMode(true);
    setSelectedDeleteIds(new Set([positionId]));
  };

  // Toggle выбора строки для массового удаления
  const handleToggleDeleteSelection = (positionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedDeleteIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(positionId)) {
        newSet.delete(positionId);
      } else {
        newSet.add(positionId);
      }
      return newSet;
    });
  };

  // Отмена режима массового удаления
  const handleCancelDeleteSelection = () => {
    setIsDeleteSelectionMode(false);
    setSelectedDeleteIds(new Set());
  };

  // Массовое удаление работ и материалов из выбранных позиций
  const handleBulkDeleteBoqItems = async (selectedTenderId: string | null) => {
    if (selectedDeleteIds.size === 0) return;

    const count = selectedDeleteIds.size;

    Modal.confirm({
      title: 'Удалить работы и материалы?',
      content: `Вы уверены, что хотите удалить все работы и материалы из ${count} ${pluralize(count, 'позиции', 'позиций', 'позиций')}? Это действие нельзя отменить.`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      rootClassName: currentTheme === 'dark' ? 'dark-modal' : '',
      onOk: async () => {
        setIsBulkDeleting(true);
        setLoading(true);
        try {
          const positionIds = Array.from(selectedDeleteIds);
          const batchSize = 100;

          // 1. Удалить boq_items батчами
          for (let i = 0; i < positionIds.length; i += batchSize) {
            const batch = positionIds.slice(i, i + batchSize);
            const { error } = await supabase
              .from('boq_items')
              .delete()
              .in('client_position_id', batch);
            if (error) throw error;
          }

          // 2. Обнулить totals батчами
          for (let i = 0; i < positionIds.length; i += batchSize) {
            const batch = positionIds.slice(i, i + batchSize);
            const { error } = await supabase
              .from('client_positions')
              .update({ total_material: 0, total_works: 0 })
              .in('id', batch);
            if (error) throw error;
          }

          // 3. Сброс состояния и обновление таблицы
          setSelectedDeleteIds(new Set());
          setIsDeleteSelectionMode(false);

          if (selectedTenderId) {
            await fetchClientPositions(selectedTenderId);
          }

          message.success(
            `Работы и материалы удалены из ${count} ${pluralize(count, 'позиции', 'позиций', 'позиций')}`
          );
        } catch (error: any) {
          console.error('Ошибка массового удаления:', error);
          message.error('Ошибка удаления: ' + error.message);
        } finally {
          setIsBulkDeleting(false);
          setLoading(false);
        }
      },
    });
  };

  // Удаление ДОП работы
  const handleDeleteAdditionalPosition = async (
    positionId: string,
    positionName: string,
    selectedTenderId: string | null,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();

    Modal.confirm({
      title: 'Удалить ДОП работу?',
      content: `Вы действительно хотите удалить ДОП работу "${positionName}"? Все связанные работы и материалы также будут удалены. Это действие необратимо.`,
      okText: 'Да, удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      rootClassName: currentTheme === 'dark' ? 'dark-modal' : '',
      onOk: async () => {
        setLoading(true);
        try {
          // Сначала удаляем все boq_items для этой позиции
          const { error: boqError } = await supabase
            .from('boq_items')
            .delete()
            .eq('client_position_id', positionId);

          if (boqError) throw boqError;

          // Затем удаляем саму позицию
          const { error: posError } = await supabase
            .from('client_positions')
            .delete()
            .eq('id', positionId);

          if (posError) throw posError;

          message.success('ДОП работа успешно удалена');

          // Обновляем список позиций
          if (selectedTenderId) {
            await fetchClientPositions(selectedTenderId);
          }
        } catch (error: any) {
          console.error('Ошибка удаления ДОП работы:', error);
          message.error('Ошибка удаления: ' + error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return {
    copiedPositionId,
    copiedNotePositionId,
    selectedTargetIds,
    isBulkPasting,
    isDeleteSelectionMode,
    selectedDeleteIds,
    isBulkDeleting,
    handleUpdatePosition,
    handleCopyPosition,
    handlePastePosition,
    handleToggleSelection,
    handleBulkPaste,
    handleCopyNote,
    handlePasteNote,
    handleBulkPasteNote,
    handleStartDeleteSelection,
    handleToggleDeleteSelection,
    handleCancelDeleteSelection,
    handleBulkDeleteBoqItems,
    handleExportToExcel,
    handleDeleteAdditionalPosition,
  };
};
