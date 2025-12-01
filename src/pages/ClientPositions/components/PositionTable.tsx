import React, { useMemo } from 'react';
import { Card, Table, Typography, Tag, Tooltip, Space, Button } from 'antd';
import { PlusOutlined, CopyOutlined, CheckOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ClientPosition, Tender } from '../../../lib/supabase';

const { Text } = Typography;

interface PositionTableProps {
  clientPositions: ClientPosition[];
  selectedTender: Tender | null;
  loading: boolean;
  copiedPositionId: string | null;
  positionCounts: Record<string, { works: number; materials: number }>;
  currentTheme: string;
  leafPositionIndices: Set<number>;
  onRowClick: (record: ClientPosition, index: number) => void;
  onOpenAdditionalModal: (parentId: string, event: React.MouseEvent) => void;
  onCopyPosition: (positionId: string, event: React.MouseEvent) => void;
  onPastePosition: (positionId: string, event: React.MouseEvent) => void;
  onDeleteAdditionalPosition: (positionId: string, positionName: string, event: React.MouseEvent) => void;
  onExportToExcel: () => void;
}

export const PositionTable: React.FC<PositionTableProps> = ({
  clientPositions,
  selectedTender,
  loading,
  copiedPositionId,
  positionCounts,
  currentTheme,
  leafPositionIndices,
  onRowClick,
  onOpenAdditionalModal,
  onCopyPosition,
  onPastePosition,
  onDeleteAdditionalPosition,
  onExportToExcel,
}) => {
  const columns: ColumnsType<ClientPosition> = useMemo(() => [
    {
      title: <div style={{ textAlign: 'center' }}>№</div>,
      dataIndex: 'position_number',
      key: 'position_number',
      width: 60,
      align: 'center',
      fixed: 'left',
    },
    {
      title: <div style={{ textAlign: 'center' }}>Раздел / Наименование</div>,
      key: 'section_name',
      width: 400,
      fixed: 'left',
      render: (_, record, index) => {
        const isLeaf = leafPositionIndices.has(index);
        const sectionColor = isLeaf ? '#52c41a' : '#ff7875';
        const isAdditional = record.is_additional;
        const paddingLeft = isAdditional ? 20 : 0;

        if (isLeaf && selectedTender) {
          return (
            <div
              style={{
                display: 'block',
                paddingLeft: `${paddingLeft}px`,
              }}
            >
              {isAdditional ? (
                <Tag color="orange" style={{ marginRight: 8 }}>ДОП</Tag>
              ) : (
                record.item_no && (
                  <Text strong style={{ color: sectionColor, marginRight: 8 }}>
                    {record.item_no}
                  </Text>
                )
              )}
              <Text style={{ textDecoration: 'underline' }}>{record.work_name}</Text>
            </div>
          );
        }

        return (
          <div style={{ paddingLeft: `${paddingLeft}px` }}>
            {isAdditional ? (
              <Tag color="orange" style={{ marginRight: 8 }}>ДОП</Tag>
            ) : (
              record.item_no && (
                <Text strong style={{ color: sectionColor, marginRight: 8 }}>
                  {record.item_no}
                </Text>
              )
            )}
            <Text>{record.work_name}</Text>
          </div>
        );
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Данные заказчика</div>,
      key: 'client_data',
      width: 250,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          {record.volume && (
            <div>
              <Text type="secondary">Кол-во: </Text>
              <Text strong>{record.volume.toFixed(2)}</Text>
            </div>
          )}
          {record.unit_code && (
            <div>
              <Text type="secondary">Ед.изм.: </Text>
              <Text>{record.unit_code}</Text>
            </div>
          )}
          {record.client_note && (
            <div>
              <Text type="secondary">Примечание: </Text>
              <Text italic>{record.client_note}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Данные ГП</div>,
      key: 'gp_data',
      width: 300,
      render: (_, record, index) => {
        const isLeaf = leafPositionIndices.has(index);

        return (
          <div style={{ fontSize: 12 }}>
            {isLeaf && (
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">Кол-во: </Text>
                <Text>{record.manual_volume?.toFixed(2) || '-'}</Text>
              </div>
            )}
            {isLeaf && record.unit_code && (
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">Ед.изм.: </Text>
                <Text>{record.unit_code}</Text>
              </div>
            )}
            <div>
              <Text type="secondary">Примечание: </Text>
              <Text>{record.manual_note || '-'}</Text>
            </div>
          </div>
        );
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Итого</div>,
      key: 'total',
      width: 220,
      align: 'center',
      render: (_, record, index) => {
        const total = (record.total_material || 0) + (record.total_works || 0);
        const counts = positionCounts[record.id] || { works: 0, materials: 0 };
        const isLeaf = leafPositionIndices.has(index);
        const isAdditional = record.is_additional;

        return (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              {!isAdditional && (
                <Tooltip title="Добавить ДОП работу">
                  <Tag
                    color="success"
                    style={{ cursor: 'pointer', margin: 0 }}
                    onClick={(e) => onOpenAdditionalModal(record.id, e)}
                  >
                    <PlusOutlined />
                  </Tag>
                </Tooltip>
              )}
              {isAdditional && (
                <Tooltip title="Удалить ДОП работу">
                  <Tag
                    style={{
                      cursor: 'pointer',
                      margin: 0,
                      backgroundColor: currentTheme === 'dark' ? '#2d1818' : '#ffe6e6',
                      borderColor: currentTheme === 'dark' ? '#5a3030' : '#ffb3b3',
                      color: currentTheme === 'dark' ? '#d49999' : '#a65050',
                    }}
                    onClick={(e) => onDeleteAdditionalPosition(record.id, record.work_name, e)}
                  >
                    <DeleteOutlined />
                  </Tag>
                </Tooltip>
              )}
              {isLeaf && copiedPositionId !== record.id && (
                <Tooltip title="Скопировать работы и материалы">
                  <Tag
                    color="processing"
                    style={{ cursor: 'pointer', margin: 0 }}
                    onClick={(e) => onCopyPosition(record.id, e)}
                  >
                    <CopyOutlined />
                  </Tag>
                </Tooltip>
              )}
              {isLeaf && copiedPositionId !== null && (
                <Tooltip title="Вставить работы и материалы">
                  <Tag
                    color="success"
                    style={{ cursor: 'pointer', margin: 0 }}
                    onClick={(e) => onPastePosition(record.id, e)}
                  >
                    <CheckOutlined />
                  </Tag>
                </Tooltip>
              )}
            </div>
            {/* Показываем сумму и счетчики для любой позиции, у которой есть работы/материалы, независимо от того, листовая она или нет */}
            {(counts.works > 0 || counts.materials > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                {total > 0 && (
                  <Text style={{ margin: 0, fontWeight: 600, fontSize: 15, color: currentTheme === 'dark' ? '#52c41a' : '#389e0d' }}>
                    {Math.round(total).toLocaleString('ru-RU')}
                  </Text>
                )}
                <div style={{ display: 'flex', gap: 8, fontSize: 15, fontWeight: 600 }}>
                  <span style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>Р:</span>
                  <span style={{ color: '#ff9800' }}>{counts.works}</span>
                  <span style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>М:</span>
                  <span style={{ color: '#1890ff' }}>{counts.materials}</span>
                </div>
              </div>
            )}
          </div>
        );
      },
    },
  ], [
    positionCounts,
    leafPositionIndices,
    copiedPositionId,
    currentTheme,
    onOpenAdditionalModal,
    onDeleteAdditionalPosition,
    onCopyPosition,
    onPastePosition,
  ]);

  return (
    <Card
      bordered={false}
      title="Позиции заказчика"
      extra={
        <Button
          icon={<DownloadOutlined />}
          onClick={onExportToExcel}
          disabled={!selectedTender || loading}
        >
          Экспорт в Excel
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Table
        columns={columns}
        dataSource={clientPositions}
        rowKey="id"
        loading={loading}
        rowClassName={(record) => {
          if (copiedPositionId === record.id) return 'copied-row';
          return '';
        }}
        onRow={(record, index) => {
          const isLeaf = leafPositionIndices.has(index!);
          return {
            onClick: () => onRowClick(record, index!),
            style: {
              cursor: isLeaf ? 'pointer' : 'default',
            },
          };
        }}
        pagination={false}
        scroll={{ x: 1200, y: 600 }}
        virtual
        size="small"
      />
    </Card>
  );
};
