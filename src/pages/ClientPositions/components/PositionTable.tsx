import React, { useMemo, useState } from 'react';
import { Card, Table, Typography, Tag, Tooltip, Space, Button } from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  CheckOutlined,
  DownloadOutlined,
  DeleteOutlined,
  MoreOutlined,
  ClearOutlined,
  FileTextOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ClientPosition, Tender } from '../../../lib/supabase';

const { Text } = Typography;

interface PositionTableProps {
  clientPositions: ClientPosition[];
  selectedTender: Tender | null;
  loading: boolean;
  copiedPositionId: string | null;
  copiedNotePositionId: string | null;
  positionCounts: Record<string, { works: number; materials: number }>;
  currentTheme: string;
  leafPositionIndices: Set<number>;
  readOnly?: boolean;
  onRowClick: (record: ClientPosition, index: number) => void;
  onOpenAdditionalModal: (parentId: string, event: React.MouseEvent) => void;
  onCopyPosition: (positionId: string, event: React.MouseEvent) => void;
  onPastePosition: (positionId: string, event: React.MouseEvent) => void;
  onCopyNote: (positionId: string, noteValue: string | null, event: React.MouseEvent) => void;
  onPasteNote: (positionId: string, event: React.MouseEvent) => void;
  onDeleteBoqItems: (positionId: string, positionName: string, event: React.MouseEvent) => void;
  onDeleteAdditionalPosition: (positionId: string, positionName: string, event: React.MouseEvent) => void;
  onExportToExcel: () => void;
}

export const PositionTable: React.FC<PositionTableProps> = ({
  clientPositions,
  selectedTender,
  loading,
  copiedPositionId,
  copiedNotePositionId,
  positionCounts,
  currentTheme,
  leafPositionIndices,
  readOnly,
  onRowClick,
  onOpenAdditionalModal,
  onCopyPosition,
  onPastePosition,
  onCopyNote,
  onPasteNote,
  onDeleteBoqItems,
  onDeleteAdditionalPosition,
  onExportToExcel,
}) => {
  // Состояние для отслеживания открытой позиции
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);

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
      width: 110,
      align: 'center',
      render: (_, record, index) => {
        const isLeaf = leafPositionIndices.has(index);
        const counts = positionCounts[record.id] || { works: 0, materials: 0 };
        const total = (record.total_works || 0) + (record.total_material || 0);
        const isExpanded = expandedPositionId === record.id;

        const tooltipColor = currentTheme === 'dark' ? {
          overlayInnerStyle: { backgroundColor: '#434343', color: '#fff' }
        } : {};

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minHeight: '48px' }}>
            {/* Пустой div для баланса слева */}
            <div style={{ flex: 1, minWidth: 0 }} />

            {/* ЦЕНТР: Счетчики и сумма */}
            {(counts.works > 0 || counts.materials > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                {/* Сумма */}
                {total > 0 && (
                  <Text
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: currentTheme === 'dark' ? '#52c41a' : '#389e0d',
                    }}
                  >
                    {Math.round(total).toLocaleString('ru-RU')}
                  </Text>
                )}
                {/* Счётчики */}
                <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                  <span>
                    Р: <span style={{ color: '#ff9800', fontWeight: 600 }}>{counts.works}</span>
                  </span>
                  <span>
                    М: <span style={{ color: '#1890ff', fontWeight: 600 }}>{counts.materials}</span>
                  </span>
                </div>
              </div>
            )}

            {/* СПРАВА: Кнопки действий */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, alignSelf: 'center' }}>
              {/* Кнопка "Вставить работы и материалы" */}
              {isLeaf && copiedPositionId && copiedPositionId !== record.id && (
                <Tooltip title="Вставить работы и материалы" {...tooltipColor}>
                  <Tag
                    color="success"
                    style={{
                      cursor: readOnly ? 'not-allowed' : 'pointer',
                      margin: 0,
                      opacity: readOnly ? 0.5 : 1,
                      pointerEvents: readOnly ? 'none' : 'auto'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPastePosition(record.id, e);
                    }}
                  >
                    <CheckOutlined />
                  </Tag>
                </Tooltip>
              )}

              {/* Кнопка "Вставить примечание ГП" */}
              {copiedNotePositionId && copiedNotePositionId !== record.id && (
                <Tooltip title="Вставить примечание ГП" {...tooltipColor}>
                  <Tag
                    color="lime"
                    style={{
                      cursor: readOnly ? 'not-allowed' : 'pointer',
                      margin: 0,
                      opacity: readOnly ? 0.5 : 1,
                      pointerEvents: readOnly ? 'none' : 'auto'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPasteNote(record.id, e);
                    }}
                  >
                    <FileAddOutlined />
                  </Tag>
                </Tooltip>
              )}

              {/* Раскрывающиеся кнопки действий */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Строка 1: Копирование (только для листовых) */}
                  {isLeaf && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {/* Скопировать работы и материалы */}
                      {copiedPositionId !== record.id && (
                        <Tooltip title="Скопировать работы и материалы" {...tooltipColor}>
                          <Tag
                            color="blue"
                            style={{ cursor: 'pointer', margin: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyPosition(record.id, e);
                            }}
                          >
                            <CopyOutlined />
                          </Tag>
                        </Tooltip>
                      )}

                      {/* Скопировать примечание ГП */}
                      <Tooltip title="Скопировать примечание ГП" {...tooltipColor}>
                        <Tag
                          color="purple"
                          style={{ cursor: 'pointer', margin: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyNote(record.id, record.manual_note, e);
                          }}
                        >
                          <FileTextOutlined />
                        </Tag>
                      </Tooltip>
                    </div>
                  )}

                  {/* Строка 2: Добавление/Удаление */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {/* Добавить ДОП работу (для НЕ-ДОП позиций) */}
                    {!record.is_additional && (
                      <Tooltip title="Добавить ДОП работу" {...tooltipColor}>
                        <Tag
                          color="success"
                          style={{ cursor: 'pointer', margin: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAdditionalModal(record.id, e);
                          }}
                        >
                          <PlusOutlined />
                        </Tag>
                      </Tooltip>
                    )}

                    {/* Удалить ДОП работу (для ДОП позиций) */}
                    {record.is_additional && (
                      <Tooltip title="Удалить ДОП работу" {...tooltipColor}>
                        <Tag
                          color="error"
                          style={{ cursor: 'pointer', margin: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAdditionalPosition(record.id, record.work_name, e);
                          }}
                        >
                          <DeleteOutlined />
                        </Tag>
                      </Tooltip>
                    )}

                    {/* Удалить работы и материалы (только для листовых) */}
                    {isLeaf && (
                      <Tooltip title="Удалить работы и материалы" {...tooltipColor}>
                        <Tag
                          color="orange"
                          style={{ cursor: 'pointer', margin: 0 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBoqItems(record.id, record.work_name, e);
                          }}
                        >
                          <ClearOutlined />
                        </Tag>
                      </Tooltip>
                    )}
                  </div>
                </div>
              )}

              {/* Кнопка троеточия */}
              <Tooltip title="Действия" {...tooltipColor}>
                <Tag
                  color="default"
                  style={{
                    cursor: readOnly ? 'not-allowed' : 'pointer',
                    margin: 0,
                    opacity: readOnly ? 0.5 : 1,
                    pointerEvents: readOnly ? 'none' : 'auto'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedPositionId(isExpanded ? null : record.id);
                  }}
                >
                  <MoreOutlined />
                </Tag>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
  ], [
    positionCounts,
    leafPositionIndices,
    copiedPositionId,
    copiedNotePositionId,
    currentTheme,
    expandedPositionId,
    readOnly,
    onOpenAdditionalModal,
    onDeleteAdditionalPosition,
    onCopyPosition,
    onPastePosition,
    onCopyNote,
    onPasteNote,
    onDeleteBoqItems,
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
