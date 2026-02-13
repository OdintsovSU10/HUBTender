import React, { useState, useRef, useMemo } from 'react';
import { Card, Tabs, Button, Space } from 'antd';
import { UploadOutlined, PlusOutlined } from '@ant-design/icons';
import type { TenderRegistryWithRelations, TenderRegistry } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenderData } from './hooks/useTenderData';
import { useTenderCRUD } from './hooks/useTenderCRUD';
import { TenderAddForm, TenderDrawer, TenderTable } from './components';
import ImportTendersModal from './ImportTendersModal';
import './Tenders.css';

const Tenders: React.FC = () => {
  const { user } = useAuth();
  const isDirector = user?.role_code === 'director' || user?.role_code === 'general_director';

  const [activeTab, setActiveTab] = useState<'current' | 'waiting' | 'archive'>('current');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTender, setSelectedTender] = useState<TenderRegistryWithRelations | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  const { tenders, statuses, constructionScopes, tenderNumbers, loading, refetch } = useTenderData();
  const { handleMoveUp, handleMoveDown, handleArchive } = useTenderCRUD(tenders, refetch);

  // Фильтрация тендеров по активной вкладке
  const filteredTenders = useMemo(() => {
    return tenders.filter((t) => {
      if (activeTab === 'current') {
        // Текущие: не архивные и не в ожидании
        return !t.is_archived && (t.status as any)?.name !== 'Ожидаем тендерный пакет';
      }
      if (activeTab === 'waiting') {
        // В ожидании: не архивные и статус "Ожидаем тендерный пакет"
        return !t.is_archived && (t.status as any)?.name === 'Ожидаем тендерный пакет';
      }
      // Архив
      return t.is_archived;
    });
  }, [tenders, activeTab]);

  const handleRowClick = (record: TenderRegistryWithRelations) => {
    // Сохранить текущую позицию прокрутки
    if (tableContainerRef.current) {
      setScrollPosition(tableContainerRef.current.scrollTop);
    }

    // Обновляем выбранный тендер и открываем/обновляем Drawer
    setSelectedTender(record);
    setEditMode(false);
    setDrawerVisible(true);
  };

  const handleEditClick = (record: TenderRegistryWithRelations) => {
    // Сохранить текущую позицию прокрутки
    if (tableContainerRef.current) {
      setScrollPosition(tableContainerRef.current.scrollTop);
    }

    // Обновляем выбранный тендер и открываем/обновляем Drawer в режиме редактирования
    setSelectedTender(record);
    setEditMode(true);
    setDrawerVisible(true);
  };

  const handleDrawerClose = () => {
    setDrawerVisible(false);
    setSelectedTender(null);
    setEditMode(false);

    // Восстановить прокрутку после анимации закрытия
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = scrollPosition;
      }
    }, 300);
  };

  return (
    <div className="tenders-layout">
      <div className={`tenders-content ${drawerVisible ? 'drawer-open' : ''}`}>
        <Card
          title="Перечень тендеров"
          extra={
            !isDirector && activeTab === 'current' && (
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  {showAddForm ? 'Скрыть форму' : 'Добавить тендер'}
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setImportModalOpen(true)}
                >
                  Импорт из Excel
                </Button>
              </Space>
            )
          }
        >
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'current' | 'waiting' | 'archive')}
            items={[
              {
                key: 'current',
                label: `Текущие (${tenders.filter((t) => !t.is_archived && (t.status as any)?.name !== 'Ожидаем тендерный пакет').length})`,
                children: (
                  <>
                    {/* Inline-форма добавления (только во вкладке "Текущие") */}
                    {!isDirector && showAddForm && (
                      <TenderAddForm
                        statuses={statuses}
                        constructionScopes={constructionScopes}
                        tenderNumbers={tenderNumbers}
                        onSuccess={() => {
                          refetch();
                          setShowAddForm(false);
                        }}
                        onCancel={() => setShowAddForm(false)}
                      />
                    )}

                    {/* Таблица текущих тендеров */}
                    <div ref={tableContainerRef} className="tenders-table-wrapper">
                      <TenderTable
                        dataSource={filteredTenders}
                        loading={loading}
                        isDirector={isDirector}
                        onRowClick={handleRowClick}
                        onEditClick={handleEditClick}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onArchive={handleArchive}
                      />
                    </div>
                  </>
                ),
              },
              {
                key: 'waiting',
                label: `В ожидании (${tenders.filter((t) => !t.is_archived && (t.status as any)?.name === 'Ожидаем тендерный пакет').length})`,
                children: (
                  <div ref={tableContainerRef} className="tenders-table-wrapper">
                    <TenderTable
                      dataSource={filteredTenders}
                      loading={loading}
                      isDirector={isDirector}
                      onRowClick={handleRowClick}
                      onEditClick={handleEditClick}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onArchive={handleArchive}
                    />
                  </div>
                ),
              },
              {
                key: 'archive',
                label: `Архив (${tenders.filter((t) => t.is_archived).length})`,
                children: (
                  <div ref={tableContainerRef} className="tenders-table-wrapper">
                    <TenderTable
                      dataSource={filteredTenders}
                      loading={loading}
                      isDirector={isDirector}
                      isArchiveTab={true}
                      onRowClick={handleRowClick}
                      onEditClick={handleEditClick}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onArchive={handleArchive}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Drawer с push-эффектом */}
      <TenderDrawer
        open={drawerVisible}
        tender={selectedTender}
        tenderNumbers={tenderNumbers}
        statuses={statuses}
        constructionScopes={constructionScopes}
        isDirector={isDirector}
        initialEditMode={editMode}
        onClose={handleDrawerClose}
        onUpdate={refetch}
      />

      {/* Import Modal */}
      <ImportTendersModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onSuccess={() => {
          setImportModalOpen(false);
          refetch();
        }}
        constructionScopes={constructionScopes}
        statuses={statuses}
      />
    </div>
  );
};

export default Tenders;
