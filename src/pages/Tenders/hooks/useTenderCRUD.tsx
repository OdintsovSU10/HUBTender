import { Modal, message } from 'antd';
import { supabase } from '../../../lib/supabase';
import type { TenderRegistry, TenderRegistryWithRelations } from '../../../lib/supabase';

export const useTenderCRUD = (tenders: TenderRegistryWithRelations[], refetch: () => void) => {
  const handleMoveUp = async (tender: TenderRegistry) => {
    const currentIndex = tenders.findIndex(t => t.id === tender.id);
    if (currentIndex <= 0) return;

    const prevTender = tenders[currentIndex - 1];
    await supabase.from('tender_registry').update({ sort_order: prevTender.sort_order }).eq('id', tender.id);
    await supabase.from('tender_registry').update({ sort_order: tender.sort_order }).eq('id', prevTender.id);
    refetch();
  };

  const handleMoveDown = async (tender: TenderRegistry) => {
    const currentIndex = tenders.findIndex(t => t.id === tender.id);
    if (currentIndex >= tenders.length - 1) return;

    const nextTender = tenders[currentIndex + 1];
    await supabase.from('tender_registry').update({ sort_order: nextTender.sort_order }).eq('id', tender.id);
    await supabase.from('tender_registry').update({ sort_order: tender.sort_order }).eq('id', nextTender.id);
    refetch();
  };

  const handleArchive = async (tender: TenderRegistry) => {
    Modal.confirm({
      title: 'Архивировать тендер?',
      content: `Вы уверены, что хотите переместить "${tender.title}" в архив?`,
      okText: 'Архивировать',
      cancelText: 'Отмена',
      onOk: async () => {
        const { error } = await supabase
          .from('tender_registry')
          .update({ is_archived: true })
          .eq('id', tender.id);

        if (!error) {
          message.success('Тендер перемещен в архив');
          refetch();
        } else {
          message.error('Ошибка архивации');
        }
      },
    });
  };

  return { handleMoveUp, handleMoveDown, handleArchive };
};
