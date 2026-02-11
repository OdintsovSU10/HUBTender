import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Select, Space, Drawer, Descriptions, Tag, Typography, message, Button, Modal } from 'antd';
import { FileTextOutlined, SearchOutlined, PlusOutlined, EditOutlined, UploadOutlined, DeleteOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { supabase, type TenderRegistryWithRelations, type TenderStatus, type ConstructionScope, type TenderRegistry } from '../../lib/supabase';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import TenderModal from './TenderModal';
import ImportTendersModal from './ImportTendersModal';
import './Tenders.css';

const { Search } = Input;
const { Title, Text } = Typography;

const Tenders: React.FC = () => {
  const { user } = useAuth();
  // Проверяем оба возможных кода роли: 'director' и 'general_director'
  const isDirector = user?.role_code === 'director' || user?.role_code === 'general_director';

  // Debug logging
  useEffect(() => {
    console.log('[Tenders] User object:', user);
    console.log('[Tenders] User role_code:', user?.role_code);
    console.log('[Tenders] isDirector flag:', isDirector);
  }, [user, isDirector]);

  const [tenders, setTenders] = useState<TenderRegistryWithRelations[]>([]);
  const [filteredTenders, setFilteredTenders] = useState<TenderRegistryWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedTender, setSelectedTender] = useState<TenderRegistryWithRelations | null>(null);
  const [statuses, setStatuses] = useState<TenderStatus[]>([]);
  const [constructionScopes, setConstructionScopes] = useState<ConstructionScope[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<TenderRegistry | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    fetchStatuses();
    fetchConstructionScopes();
    fetchTenders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tenders, searchText, selectedStatus, selectedClient]);

  const fetchStatuses = async () => {
    const { data, error } = await supabase
      .from('tender_statuses')
      .select('*')
      .order('name');

    if (!error && data) {
      setStatuses(data);
    }
  };

  const fetchConstructionScopes = async () => {
    const { data, error } = await supabase
      .from('construction_scopes')
      .select('*')
      .order('name');

    if (!error && data) {
      setConstructionScopes(data);
    }
  };

  const fetchTenders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tender_registry')
      .select(`
        *,
        status:status_id(id, name),
        construction_scope:construction_scope_id(id, name)
      `)
      .order('sort_order', { ascending: true });

    if (error) {
      message.error('Ошибка загрузки тендеров: ' + error.message);
      setLoading(false);
      return;
    }

    setTenders(data || []);

    // Извлечь уникальных заказчиков
    const uniqueClients = Array.from(new Set(data?.map(t => t.client_name) || []));
    setClients(uniqueClients);

    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...tenders];

    // Поиск по названию
    if (searchText) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(searchText.toLowerCase()) ||
        t.client_name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Фильтр по статусу
    if (selectedStatus) {
      filtered = filtered.filter(t => t.status_id === selectedStatus);
    }

    // Фильтр по заказчику
    if (selectedClient) {
      filtered = filtered.filter(t => t.client_name === selectedClient);
    }

    setFilteredTenders(filtered);
  };

  const handleRowClick = (tender: TenderRegistryWithRelations) => {
    setSelectedTender(tender);
    setDrawerVisible(true);
  };

  const handleAddTender = () => {
    setEditingTender(null);
    setModalOpen(true);
  };

  const handleEditTender = (tender: TenderRegistry) => {
    setEditingTender(tender);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingTender(null);
  };

  const handleModalSuccess = () => {
    setModalOpen(false);
    setEditingTender(null);
    fetchTenders();
  };

  const handleDeleteTender = async (tender: TenderRegistry, event: React.MouseEvent) => {
    event.stopPropagation();

    Modal.confirm({
      title: 'Удалить тендер?',
      content: `Вы уверены, что хотите удалить тендер "${tender.title}"?`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        const { error } = await supabase
          .from('tender_registry')
          .delete()
          .eq('id', tender.id);

        if (error) {
          message.error('Ошибка удаления: ' + error.message);
        } else {
          message.success('Тендер удален');
          fetchTenders();
        }
      },
    });
  };

  const handleMoveUp = async (tender: TenderRegistry, event: React.MouseEvent) => {
    event.stopPropagation();

    const currentIndex = filteredTenders.findIndex(t => t.id === tender.id);
    if (currentIndex <= 0) return;

    const prevTender = filteredTenders[currentIndex - 1];

    // Поменять местами sort_order
    await supabase
      .from('tender_registry')
      .update({ sort_order: prevTender.sort_order })
      .eq('id', tender.id);

    await supabase
      .from('tender_registry')
      .update({ sort_order: tender.sort_order })
      .eq('id', prevTender.id);

    fetchTenders();
  };

  const handleMoveDown = async (tender: TenderRegistry, event: React.MouseEvent) => {
    event.stopPropagation();

    const currentIndex = filteredTenders.findIndex(t => t.id === tender.id);
    if (currentIndex >= filteredTenders.length - 1) return;

    const nextTender = filteredTenders[currentIndex + 1];

    // Поменять местами sort_order
    await supabase
      .from('tender_registry')
      .update({ sort_order: nextTender.sort_order })
      .eq('id', tender.id);

    await supabase
      .from('tender_registry')
      .update({ sort_order: tender.sort_order })
      .eq('id', nextTender.id);

    fetchTenders();
  };

  const getRowClassName = (record: TenderRegistryWithRelations) => {
    const statusName = (record.status as any)?.name;
    if (statusName === 'В работе') return 'tender-status-working';
    if (statusName === 'Ожидаем тендерный пакет') return 'tender-status-waiting';
    if (statusName === 'Проиграли') return 'tender-status-lost';
    if (statusName === 'Выиграли') return 'tender-status-won';
    return '';
  };

  const columns = [
    {
      title: '№',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Наименование',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      align: 'center' as const,
      onCell: () => ({ style: { textAlign: 'left' as const } }),
      sorter: (a: TenderRegistryWithRelations, b: TenderRegistryWithRelations) =>
        a.title.localeCompare(b.title),
    },
    {
      title: 'Заказчик',
      dataIndex: 'client_name',
      key: 'client_name',
      width: 200,
      align: 'center' as const,
      sorter: (a: TenderRegistryWithRelations, b: TenderRegistryWithRelations) =>
        a.client_name.localeCompare(b.client_name),
    },
    {
      title: 'Площадь',
      dataIndex: 'area',
      key: 'area',
      width: 120,
      align: 'center' as const,
      render: (val: number | null) => {
        if (!val) return '-';
        // Для чисел >= 10000 используем разделение тысяч
        if (val >= 10000) {
          return `${val.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} м²`;
        }
        return `${val.toFixed(2)} м²`;
      },
      sorter: (a: TenderRegistryWithRelations, b: TenderRegistryWithRelations) =>
        (a.area || 0) - (b.area || 0),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: TenderRegistryWithRelations) => {
        const status = record.status as any;
        return status?.name ? (
          <Tag color="blue">{status.name}</Tag>
        ) : (
          <Tag color="default">Не указан</Tag>
        );
      },
      sorter: (a: TenderRegistryWithRelations, b: TenderRegistryWithRelations) => {
        const statusA = (a.status as any)?.name || '';
        const statusB = (b.status as any)?.name || '';
        return statusA.localeCompare(statusB);
      },
    },
    ...(!isDirector ? [{
      title: 'Действия',
      key: 'actions',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: TenderRegistryWithRelations, index: number) => (
        <Space size="small">
          <Button
            size="small"
            icon={<UpOutlined />}
            disabled={index === 0}
            onClick={(e) => handleMoveUp(record as TenderRegistry, e)}
          />
          <Button
            size="small"
            icon={<DownOutlined />}
            disabled={index === filteredTenders.length - 1}
            onClick={(e) => handleMoveDown(record as TenderRegistry, e)}
          />
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleEditTender(record as TenderRegistry);
            }}
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => handleDeleteTender(record as TenderRegistry, e)}
          />
        </Space>
      ),
    }] : []),
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>Перечень тендеров</span>
          </Space>
        }
        extra={
          <Space>
            <Search
              placeholder="Поиск по названию или заказчику"
              allowClear
              style={{ width: 300 }}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
            <Select
              placeholder="Фильтр по заказчику"
              allowClear
              style={{ width: 200 }}
              onChange={(value) => setSelectedClient(value)}
              options={clients.map(client => ({ label: client, value: client }))}
            />
            <Select
              placeholder="Фильтр по статусу"
              allowClear
              style={{ width: 200 }}
              onChange={(value) => setSelectedStatus(value)}
              options={statuses.map(s => ({ label: s.name, value: s.id }))}
            />
            {!isDirector && (
              <>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddTender}
                >
                  Добавить тендер
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setImportModalOpen(true)}
                >
                  Импорт из Excel
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Table
          dataSource={filteredTenders}
          columns={columns}
          rowKey="id"
          loading={loading}
          rowClassName={getRowClassName}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Drawer
        title={selectedTender?.title}
        placement="right"
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {selectedTender && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Наименование">
              {selectedTender.title}
            </Descriptions.Item>
            <Descriptions.Item label="Заказчик">
              {selectedTender.client_name}
            </Descriptions.Item>
            <Descriptions.Item label="Объем строительства">
              {(selectedTender.construction_scope as any)?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Площадь">
              {selectedTender.area
                ? (selectedTender.area >= 10000
                    ? `${selectedTender.area.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} м²`
                    : `${selectedTender.area.toFixed(2)} м²`)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Дата подачи КП">
              {selectedTender.submission_date
                ? dayjs(selectedTender.submission_date).format('DD.MM.YYYY')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Хронология">
              {selectedTender.chronology || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Дата выхода на площадку">
              {selectedTender.construction_start_date
                ? dayjs(selectedTender.construction_start_date).format('DD.MM.YYYY')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Фото и дата посещения площадки">
              {selectedTender.site_visit_date && (
                <>
                  <Text>Дата: {dayjs(selectedTender.site_visit_date).format('DD.MM.YYYY')}</Text>
                  <br />
                </>
              )}
              {selectedTender.site_visit_photo_url ? (
                <a href={selectedTender.site_visit_photo_url} target="_blank" rel="noopener noreferrer">
                  Открыть фото
                </a>
              ) : (
                <Text type="secondary">Нет фото</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Наличие тендерного пакета">
              {selectedTender.has_tender_package || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Дата приглашения">
              {selectedTender.invitation_date
                ? dayjs(selectedTender.invitation_date).format('DD.MM.YYYY')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Статус">
              {(selectedTender.status as any)?.name || 'Не указан'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <TenderModal
        open={modalOpen}
        tender={editingTender}
        statuses={statuses}
        constructionScopes={constructionScopes}
        onCancel={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      <ImportTendersModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onSuccess={() => {
          setImportModalOpen(false);
          fetchTenders();
        }}
        constructionScopes={constructionScopes}
        statuses={statuses}
      />
    </div>
  );
};

export default Tenders;
