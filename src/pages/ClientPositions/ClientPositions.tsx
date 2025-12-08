import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientPositions } from './hooks/useClientPositions';
import { usePositionActions } from './hooks/usePositionActions';
import { useDeadlineCheck } from '../../hooks/useDeadlineCheck';
import { TenderSelectionScreen } from './components/TenderSelectionScreen';
import { PositionToolbar } from './components/PositionToolbar';
import { DeadlineBar } from './components/DeadlineBar';
import { PositionTable } from './components/PositionTable';
import AddAdditionalPositionModal from './AddAdditionalPositionModal';
import type { Tender } from '../../lib/supabase';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

interface TenderOption {
  value: string;
  label: string;
  clientName: string;
}

const ClientPositions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme: currentTheme } = useTheme();

  // State management
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [additionalModalOpen, setAdditionalModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Hooks
  const {
    tenders,
    selectedTender,
    setSelectedTender,
    clientPositions,
    setClientPositions,
    loading,
    setLoading,
    positionCounts,
    totalSum,
    leafPositionIndices,
    fetchClientPositions,
  } = useClientPositions();

  const {
    copiedPositionId,
    copiedNotePositionId,
    handleCopyPosition,
    handlePastePosition,
    handleCopyNote,
    handlePasteNote,
    handleDeleteBoqItems,
    handleExportToExcel,
    handleDeleteAdditionalPosition,
  } = usePositionActions(clientPositions, setClientPositions, setLoading, fetchClientPositions, currentTheme);

  // Проверка дедлайна для блокировки редактирования
  const { canEdit: canEditByDeadline, loading: deadlineLoading } =
    useDeadlineCheck(selectedTender?.id);

  // Получение уникальных наименований тендеров
  const tenderTitles = useMemo((): TenderOption[] => {
    const uniqueTitles = new Map<string, TenderOption>();

    tenders.forEach(tender => {
      if (!uniqueTitles.has(tender.title)) {
        uniqueTitles.set(tender.title, {
          value: tender.title,
          label: tender.title,
          clientName: tender.client_name,
        });
      }
    });

    return Array.from(uniqueTitles.values());
  }, [tenders]);

  // Получение версий для выбранного наименования тендера
  const versions = useMemo((): { value: number; label: string }[] => {
    if (!selectedTenderTitle) return [];

    return tenders
      .filter(tender => tender.title === selectedTenderTitle)
      .map(tender => ({
        value: tender.version || 1,
        label: `Версия ${tender.version || 1}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [tenders, selectedTenderTitle]);

  // Обработка выбора наименования тендера
  const handleTenderTitleChange = (title: string) => {
    setSelectedTenderTitle(title);
    setSelectedTender(null);
    setSelectedTenderId(null);
    setSelectedVersion(null);
    setClientPositions([]);
  };

  // Обработка выбора версии тендера
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const tender = tenders.find(t => t.title === selectedTenderTitle && t.version === version);
    if (tender) {
      setSelectedTender(tender);
      setSelectedTenderId(tender.id);
      fetchClientPositions(tender.id);
    }
  };

  // Обработчики модального окна
  const handleOpenAdditionalModal = useCallback((parentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedParentId(parentId);
    setAdditionalModalOpen(true);
  }, []);

  const handleAdditionalSuccess = () => {
    setAdditionalModalOpen(false);
    setSelectedParentId(null);
    if (selectedTenderId) {
      fetchClientPositions(selectedTenderId);
    }
  };

  // Обработчик клика по строке
  const handleRowClick = useCallback((record: any, index: number) => {
    const isLeaf = leafPositionIndices.has(index);
    if (isLeaf && selectedTender) {
      // Открываем в новой вкладке
      const url = `/positions/${record.id}/items?tenderId=${selectedTender.id}&positionId=${record.id}`;
      window.open(url, '_blank');
    }
  }, [leafPositionIndices, selectedTender]);


  // Обработчик возврата к выбору
  const handleBackToSelection = () => {
    setSelectedTender(null);
    setSelectedTenderId(null);
    setSelectedTenderTitle(null);
    setSelectedVersion(null);
    setClientPositions([]);
  };

  // Обработчик клика по карточке тендера
  const handleTenderCardClick = (tender: Tender) => {
    setSelectedTenderTitle(tender.title);
    setSelectedVersion(tender.version || 1);
    setSelectedTender(tender);
    setSelectedTenderId(tender.id);
    fetchClientPositions(tender.id);
  };

  // Если тендер не выбран, показываем экран выбора тендера
  if (!selectedTender) {
    return (
      <TenderSelectionScreen
        tenders={tenders}
        selectedTenderTitle={selectedTenderTitle}
        selectedVersion={selectedVersion}
        tenderTitles={tenderTitles}
        versions={versions}
        onTenderTitleChange={handleTenderTitleChange}
        onVersionChange={handleVersionChange}
        onTenderCardClick={handleTenderCardClick}
      />
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Блок с названием тендера, кнопками, фильтрами и информацией */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
        borderRadius: '8px',
        margin: '16px 0 0 0',
      }}>
        <PositionToolbar
          selectedTender={selectedTender}
          selectedTenderTitle={selectedTenderTitle}
          selectedVersion={selectedVersion}
          tenderTitles={tenderTitles}
          versions={versions}
          currentTheme={currentTheme}
          totalSum={totalSum}
          onTenderTitleChange={handleTenderTitleChange}
          onVersionChange={handleVersionChange}
          onBackToSelection={handleBackToSelection}
        />

        <DeadlineBar selectedTender={selectedTender} currentTheme={currentTheme} />
      </div>

      {/* Таблица позиций заказчика */}
      {selectedTender && (
        <PositionTable
          clientPositions={clientPositions}
          selectedTender={selectedTender}
          loading={loading}
          copiedPositionId={copiedPositionId}
          copiedNotePositionId={copiedNotePositionId}
          positionCounts={positionCounts}
          currentTheme={currentTheme}
          leafPositionIndices={leafPositionIndices}
          readOnly={!canEditByDeadline || deadlineLoading}
          onRowClick={handleRowClick}
          onOpenAdditionalModal={handleOpenAdditionalModal}
          onCopyPosition={handleCopyPosition}
          onPastePosition={(positionId, event) => handlePastePosition(positionId, event, selectedTenderId)}
          onCopyNote={handleCopyNote}
          onPasteNote={(positionId, event) => handlePasteNote(positionId, event, selectedTenderId)}
          onDeleteBoqItems={(positionId, positionName, event) =>
            handleDeleteBoqItems(positionId, positionName, selectedTenderId, event)
          }
          onDeleteAdditionalPosition={(positionId, positionName, event) =>
            handleDeleteAdditionalPosition(positionId, positionName, selectedTenderId, event)
          }
          onExportToExcel={() => handleExportToExcel(selectedTender)}
        />
      )}

      {/* Модальное окно добавления доп работы */}
      <AddAdditionalPositionModal
        open={additionalModalOpen}
        parentPositionId={selectedParentId}
        tenderId={selectedTenderId || ''}
        onCancel={() => {
          setAdditionalModalOpen(false);
          setSelectedParentId(null);
        }}
        onSuccess={handleAdditionalSuccess}
      />
    </div>
  );
};

export default ClientPositions;
