import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useClientPositions } from './hooks/useClientPositions';
import { usePositionActions } from './hooks/usePositionActions';
import { usePositionFilters } from './hooks/usePositionFilters';
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
  const [tempSelectedPositionIds, setTempSelectedPositionIds] = useState<Set<string>>(new Set());

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
    selectedTargetIds,
    isBulkPasting,
    handleCopyPosition,
    handlePastePosition,
    handleToggleSelection,
    handleBulkPaste,
    handleCopyNote,
    handlePasteNote,
    handleDeleteBoqItems,
    handleExportToExcel,
    handleDeleteAdditionalPosition,
  } = usePositionActions(clientPositions, setClientPositions, setLoading, fetchClientPositions, currentTheme);

  // Хук фильтрации позиций и получение информации о пользователе
  const { user } = useAuth();

  // Проверка роли для фильтрации архивных тендеров
  const shouldFilterArchived = user?.role_code === 'engineer' || user?.role_code === 'moderator';

  const {
    selectedPositionIds,
    isFilterActive,
    loading: filterLoading,
    saveFilter,
    clearFilter,
  } = usePositionFilters(user?.id, selectedTenderId);

  // Проверка дедлайна для блокировки редактирования
  const { canEdit: canEditByDeadline, loading: deadlineLoading } =
    useDeadlineCheck(selectedTender?.id);

  // Получение уникальных наименований тендеров
  const tenderTitles = useMemo((): TenderOption[] => {
    const uniqueTitles = new Map<string, TenderOption>();

    const filteredTenders = shouldFilterArchived
      ? tenders.filter(t => !t.is_archived)
      : tenders;

    filteredTenders.forEach(tender => {
      if (!uniqueTitles.has(tender.title)) {
        uniqueTitles.set(tender.title, {
          value: tender.title,
          label: tender.title,
          clientName: tender.client_name,
        });
      }
    });

    return Array.from(uniqueTitles.values());
  }, [tenders, shouldFilterArchived]);

  // Получение версий для выбранного наименования тендера
  const versions = useMemo((): { value: number; label: string }[] => {
    if (!selectedTenderTitle) return [];

    const filtered = shouldFilterArchived
      ? tenders.filter(tender => tender.title === selectedTenderTitle && !tender.is_archived)
      : tenders.filter(tender => tender.title === selectedTenderTitle);

    return filtered
      .map(tender => ({
        value: tender.version || 1,
        label: `Версия ${tender.version || 1}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [tenders, selectedTenderTitle, shouldFilterArchived]);

  // Фильтрация позиций в зависимости от активного фильтра
  const displayedPositions = useMemo(() => {
    if (!isFilterActive || selectedPositionIds.size === 0) {
      return clientPositions;
    }
    // Строгая фильтрация: показываем только выбранные позиции
    return clientPositions.filter(pos => selectedPositionIds.has(pos.id));
  }, [clientPositions, isFilterActive, selectedPositionIds]);

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

  // Автоматический выбор тендера из URL параметров
  useEffect(() => {
    const tenderId = searchParams.get('tenderId');
    if (tenderId && tenders.length > 0 && !selectedTender) {
      const tender = tenders.find(t => t.id === tenderId);
      if (tender) {
        setSelectedTenderTitle(tender.title);
        setSelectedVersion(tender.version || 1);
        setSelectedTender(tender);
        setSelectedTenderId(tender.id);
        fetchClientPositions(tender.id);
      }
    }
  }, [searchParams, tenders, selectedTender]);

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
    const isLeaf = leafPositionIndices.has(record.id);
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

  // Обработчики фильтра
  const handleToggleFilterCheckbox = (positionId: string) => {
    setTempSelectedPositionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(positionId)) {
        newSet.delete(positionId);
      } else {
        newSet.add(positionId);
      }
      return newSet;
    });
  };

  const handleApplyFilter = async () => {
    const positionIds = Array.from(tempSelectedPositionIds);
    await saveFilter(positionIds);
  };

  const handleClearFilter = async () => {
    await clearFilter();
    setTempSelectedPositionIds(new Set());
  };

  // Синхронизация tempSelectedPositionIds с загруженным фильтром
  useEffect(() => {
    setTempSelectedPositionIds(selectedPositionIds);
  }, [selectedPositionIds]);

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
        shouldFilterArchived={shouldFilterArchived}
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
          clientPositions={displayedPositions}
          selectedTender={selectedTender}
          loading={loading || filterLoading}
          copiedPositionId={copiedPositionId}
          copiedNotePositionId={copiedNotePositionId}
          selectedTargetIds={selectedTargetIds}
          isBulkPasting={isBulkPasting}
          positionCounts={positionCounts}
          currentTheme={currentTheme}
          leafPositionIndices={leafPositionIndices}
          readOnly={!canEditByDeadline || deadlineLoading}
          isFilterActive={isFilterActive}
          filterSelectedCount={selectedPositionIds.size}
          totalPositionsCount={clientPositions.length}
          onRowClick={handleRowClick}
          onOpenAdditionalModal={handleOpenAdditionalModal}
          onCopyPosition={handleCopyPosition}
          onPastePosition={(positionId, event) => handlePastePosition(positionId, event, selectedTenderId)}
          onToggleSelection={handleToggleSelection}
          onBulkPaste={() => handleBulkPaste(selectedTenderId)}
          onCopyNote={handleCopyNote}
          onPasteNote={(positionId, event) => handlePasteNote(positionId, event, selectedTenderId)}
          onDeleteBoqItems={(positionId, positionName, event) =>
            handleDeleteBoqItems(positionId, positionName, selectedTenderId, event)
          }
          onDeleteAdditionalPosition={(positionId, positionName, event) =>
            handleDeleteAdditionalPosition(positionId, positionName, selectedTenderId, event)
          }
          onExportToExcel={() => handleExportToExcel(selectedTender)}
          tempSelectedPositionIds={tempSelectedPositionIds}
          onToggleFilterCheckbox={handleToggleFilterCheckbox}
          onApplyFilter={handleApplyFilter}
          onClearFilter={handleClearFilter}
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
