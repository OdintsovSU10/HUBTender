import { useState } from 'react';
import { message, Modal } from 'antd';
import { supabase, type ClientPosition } from '../../../lib/supabase';
import { copyBoqItems } from '../../../utils/copyBoqItems';
import { exportPositionsToExcel } from '../../../utils/excel';

export const usePositionActions = (
  _clientPositions: ClientPosition[],
  setClientPositions: React.Dispatch<React.SetStateAction<ClientPosition[]>>,
  setLoading: (loading: boolean) => void,
  fetchClientPositions: (tenderId: string) => Promise<void>,
  currentTheme: string
) => {
  const [copiedPositionId, setCopiedPositionId] = useState<string | null>(null);

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
    handleUpdatePosition,
    handleCopyPosition,
    handlePastePosition,
    handleExportToExcel,
    handleDeleteAdditionalPosition,
  };
};
