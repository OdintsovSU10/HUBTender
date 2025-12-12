import React from 'react';
import { Space, Typography, Segmented, Button, Input } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface CostFiltersProps {
  costType: 'base' | 'commercial';
  viewMode: 'detailed' | 'summary' | 'simplified';
  searchText: string;
  onCostTypeChange: (value: 'base' | 'commercial') => void;
  onViewModeChange: (value: 'detailed' | 'summary' | 'simplified') => void;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  onExport: () => void;
  disableExport: boolean;
}

const CostFilters: React.FC<CostFiltersProps> = ({
  costType,
  viewMode,
  searchText,
  onCostTypeChange,
  onViewModeChange,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  onRefresh,
  onExport,
  disableExport,
}) => {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Левая часть */}
        <Space direction="vertical" size="middle">
          <Space>
            <Text>Тип затрат:</Text>
            <Segmented
              options={[
                { label: 'Прямые затраты', value: 'base' },
                { label: 'Коммерческие затраты', value: 'commercial' },
              ]}
              value={costType}
              onChange={(value) => onCostTypeChange(value as 'base' | 'commercial')}
            />
          </Space>
          <Space size="large">
            <Space>
              <Text>Представление:</Text>
              <Segmented
                options={[
                  { label: 'Детальное', value: 'detailed' },
                  { label: 'Итоговое', value: 'summary' },
                  { label: 'Упрощенное', value: 'simplified' },
                ]}
                value={viewMode}
                onChange={(value) => onViewModeChange(value as 'detailed' | 'summary' | 'simplified')}
              />
            </Space>
            <Space>
              <Button size="small" onClick={onExpandAll}>
                Развернуть все
              </Button>
              <Button size="small" onClick={onCollapseAll}>
                Свернуть все
              </Button>
            </Space>
          </Space>
        </Space>

        {/* Правая часть */}
        <Space direction="vertical" size="middle" align="end">
          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={onExport}
              disabled={disableExport}
            >
              Экспорт
            </Button>
            <Button icon={<ReloadOutlined />} onClick={onRefresh}>
              Обновить
            </Button>
          </Space>
          <Input
            placeholder="Поиск..."
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            allowClear
          />
        </Space>
      </div>
    </div>
  );
};

export default CostFilters;
