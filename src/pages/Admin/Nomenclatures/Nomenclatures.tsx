import React, { useState } from 'react';
import { Card, Tabs, Table, Button, Space, Input, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { TabsProps, ColumnsType } from 'antd/es';

interface MaterialRecord {
  key: string;
  id: string;
  name: string;
  unit: string;
  createdAt: string;
}

interface WorkRecord {
  key: string;
  id: string;
  name: string;
  unit: string;
  createdAt: string;
}

interface LocationRecord {
  key: string;
  id: string;
  location: string;
  createdAt: string;
}

interface CostCategoryRecord {
  key: string;
  id: string;
  name: string;
  unit: string;
  createdAt: string;
}

const Nomenclatures: React.FC = () => {
  const [searchText, setSearchText] = useState('');

  // Временные данные для демонстрации
  const materialsData: MaterialRecord[] = [
    { key: '1', id: '1', name: 'Бетон B25', unit: 'м3', createdAt: '2024-01-15' },
    { key: '2', id: '2', name: 'Арматура А500С', unit: 'т', createdAt: '2024-01-16' },
    { key: '3', id: '3', name: 'Кирпич керамический', unit: 'шт', createdAt: '2024-01-17' },
  ];

  const worksData: WorkRecord[] = [
    { key: '1', id: '1', name: 'Монтаж опалубки', unit: 'м2', createdAt: '2024-01-15' },
    { key: '2', id: '2', name: 'Бетонирование', unit: 'м3', createdAt: '2024-01-16' },
    { key: '3', id: '3', name: 'Армирование', unit: 'т', createdAt: '2024-01-17' },
  ];

  const locationsData: LocationRecord[] = [
    { key: '1', id: '1', location: 'Москва', createdAt: '2024-01-15' },
    { key: '2', id: '2', location: 'Санкт-Петербург', createdAt: '2024-01-16' },
    { key: '3', id: '3', location: 'Екатеринбург', createdAt: '2024-01-17' },
  ];

  const costCategoriesData: CostCategoryRecord[] = [
    { key: '1', id: '1', name: 'Земляные работы', unit: 'м3', createdAt: '2024-01-15' },
    { key: '2', id: '2', name: 'Фундаментные работы', unit: 'м3', createdAt: '2024-01-16' },
    { key: '3', id: '3', name: 'Кровельные работы', unit: 'м2', createdAt: '2024-01-17' },
  ];

  const unitColors: Record<string, string> = {
    'шт': 'blue',
    'м': 'green',
    'м2': 'cyan',
    'м3': 'purple',
    'кг': 'orange',
    'т': 'red',
    'л': 'magenta',
    'компл': 'volcano',
    'м.п.': 'geekblue',
  };

  const materialColumns: ColumnsType<MaterialRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.name.toLowerCase().includes(value.toString().toLowerCase()),
    },
    {
      title: 'Единица измерения',
      dataIndex: 'unit',
      key: 'unit',
      width: 150,
      render: (unit: string) => (
        <Tag color={unitColors[unit] || 'default'}>{unit}</Tag>
      ),
    },
    {
      title: 'Дата создания',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
    },
    {
      title: 'Действия',
      key: 'action',
      width: 120,
      render: (_: any, record: MaterialRecord) => (
        <Space size="small">
          <Tooltip title="Редактировать">
            <Button type="text" icon={<EditOutlined />} />
          </Tooltip>
          <Tooltip title="Удалить">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const workColumns: ColumnsType<WorkRecord> = [
    ...materialColumns as ColumnsType<WorkRecord>,
  ];

  const locationColumns: ColumnsType<LocationRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: 'Локация',
      dataIndex: 'location',
      key: 'location',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.location.toLowerCase().includes(value.toString().toLowerCase()),
    },
    {
      title: 'Дата создания',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
    },
    {
      title: 'Действия',
      key: 'action',
      width: 120,
      render: (_: any, record: LocationRecord) => (
        <Space size="small">
          <Tooltip title="Редактировать">
            <Button type="text" icon={<EditOutlined />} />
          </Tooltip>
          <Tooltip title="Удалить">
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const costCategoryColumns: ColumnsType<CostCategoryRecord> = [
    ...materialColumns as ColumnsType<CostCategoryRecord>,
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'materials',
      label: 'Материалы',
      children: (
        <Table
          columns={materialColumns}
          dataSource={materialsData}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
    {
      key: 'works',
      label: 'Работы',
      children: (
        <Table
          columns={workColumns}
          dataSource={worksData}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
    {
      key: 'locations',
      label: 'Локации',
      children: (
        <Table
          columns={locationColumns}
          dataSource={locationsData}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
    {
      key: 'cost_categories',
      label: 'Категории затрат',
      children: (
        <Table
          columns={costCategoryColumns}
          dataSource={costCategoriesData}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Номенклатуры"
        extra={
          <Space>
            <Input
              placeholder="Поиск..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Button type="primary" icon={<PlusOutlined />}>
              Добавить
            </Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="materials"
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
};

export default Nomenclatures;