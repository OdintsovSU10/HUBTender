import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientPositions } from './hooks/useClientPositions';
import { usePositionActions } from './hooks/usePositionActions';
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
  const [scrollToPositionId, setScrollToPositionId] = useState<string | null>(null);
  const [additionalModalOpen, setAdditionalModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState<string>('');
  const [searchOptions, setSearchOptions] = useState<Array<{ key: string; value: string; label: string }>>([]);

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
    fetchClientPositions,
  } = useClientPositions();

  const {
    copiedPositionId,
    handleCopyPosition,
    handlePastePosition,
    handleExportToExcel,
  } = usePositionActions(clientPositions, setClientPositions, setLoading, fetchClientPositions);

  // Восстановление состояния из URL при возврате
  useEffect(() => {
    if (tenders.length > 0) {
      const tenderId = searchParams.get('tenderId');
      const positionId = searchParams.get('positionId');

      if (tenderId) {
        const tender = tenders.find(t => t.id === tenderId);
        if (tender) {
          setSelectedTender(tender);
          setSelectedTenderId(tender.id);
          setSelectedTenderTitle(tender.title);
          setSelectedVersion(tender.version || 1);
          fetchClientPositions(tender.id);

          if (positionId) {
            setScrollToPositionId(positionId);
          }
        }
      }
    }
  }, [tenders, searchParams]);

  // Debounce для поиска позиций
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchValue && searchValue.length >= 2) {
        const searchLower = searchValue.toLowerCase();
        const filtered = [];

        for (let i = 0; i < clientPositions.length && filtered.length < 50; i++) {
          const p = clientPositions[i];
          if (p.work_name.toLowerCase().includes(searchLower)) {
            filtered.push({
              key: p.id,
              value: `${p.position_number} - ${p.work_name}`,
              label: `${p.position_number} - ${p.work_name}`,
            });
          }
        }
        setSearchOptions(filtered);
      } else {
        setSearchOptions([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue, clientPositions]);

  // Прокрутка к позиции после загрузки данных
  useEffect(() => {
    if (scrollToPositionId && clientPositions.length > 0 && !loading) {
      setTimeout(() => {
        let element = document.querySelector(`[data-row-key="${scrollToPositionId}"]`) as HTMLElement;

        if (!element) {
          const allRows = document.querySelectorAll('.ant-table-row');
          element = Array.from(allRows).find(
            (row) => (row as HTMLElement).getAttribute('data-row-key') === scrollToPositionId
          ) as HTMLElement;
        }

        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          setTimeout(() => {
            setScrollToPositionId(null);
            setSearchParams({});
          }, 2000);
        } else {
          setTimeout(() => {
            setScrollToPositionId(null);
            setSearchParams({});
          }, 1000);
        }
      }, 500);
    }
  }, [scrollToPositionId, clientPositions, loading]);

  // Получение уникальных наименований тендеров
  const getTenderTitles = (): TenderOption[] => {
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
  };

  // Получение версий для выбранного наименования тендера
  const getVersionsForTitle = (title: string): { value: number; label: string }[] => {
    return tenders
      .filter(tender => tender.title === title)
      .map(tender => ({
        value: tender.version || 1,
        label: `Версия ${tender.version || 1}`,
      }))
      .sort((a, b) => b.value - a.value);
  };

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

  // Определение конечной строки (листового узла)
  const isLeafPosition = (index: number): boolean => {
    if (index === clientPositions.length - 1) {
      return true;
    }

    const currentLevel = clientPositions[index].hierarchy_level || 0;
    const nextLevel = clientPositions[index + 1]?.hierarchy_level || 0;

    return currentLevel >= nextLevel;
  };

  // Обработчики модального окна
  const handleOpenAdditionalModal = (parentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedParentId(parentId);
    setAdditionalModalOpen(true);
  };

  const handleAdditionalSuccess = () => {
    setAdditionalModalOpen(false);
    setSelectedParentId(null);
    if (selectedTenderId) {
      fetchClientPositions(selectedTenderId);
    }
  };

  // Обработчик клика по строке
  const handleRowClick = (record: any, index: number) => {
    const isLeaf = isLeafPosition(index);
    if (isLeaf && selectedTender) {
      navigate(`/positions/${record.id}/items?tenderId=${selectedTender.id}&positionId=${record.id}`);
    }
  };

  // Обработчик поиска
  const handleSearchSelect = (_value: string, option: any) => {
    const positionId = option.key;
    setScrollToPositionId(positionId);
    setSearchValue('');
    setSearchOptions([]);

    setTimeout(() => {
      setScrollToPositionId(null);
    }, 3000);
  };

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
        tenderTitles={getTenderTitles()}
        versions={selectedTenderTitle ? getVersionsForTitle(selectedTenderTitle) : []}
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
          tenderTitles={getTenderTitles()}
          versions={selectedTenderTitle ? getVersionsForTitle(selectedTenderTitle) : []}
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
          scrollToPositionId={scrollToPositionId}
          copiedPositionId={copiedPositionId}
          positionCounts={positionCounts}
          searchValue={searchValue}
          searchOptions={searchOptions}
          currentTheme={currentTheme}
          onRowClick={handleRowClick}
          onOpenAdditionalModal={handleOpenAdditionalModal}
          onCopyPosition={handleCopyPosition}
          onPastePosition={(positionId, event) => handlePastePosition(positionId, event, selectedTenderId)}
          onSearchChange={setSearchValue}
          onSearchSelect={handleSearchSelect}
          onExportToExcel={() => handleExportToExcel(selectedTender)}
          isLeafPosition={isLeafPosition}
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
