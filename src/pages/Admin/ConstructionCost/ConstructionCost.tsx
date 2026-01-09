import React, { useState } from 'react';
import { Card, Table, Button, Space, Input, Tag, Select, Typography, Row, Col, Statistic } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  DollarOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text, Title } = Typography;
const { Option } = Select;

interface DetailCostCategoryRecord {
  key: string;
  id: string;
  categoryName: string;
  categoryId: string;
  locationName: string;
  locationId: string;
  name: string;
  unit: string;
  orderNum: number;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: string;
}

const ConstructionCost: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Временные данные для демонстрации
  const detailCostData: DetailCostCategoryRecord[] = [
    {
      key: '1',
      id: '1',
      categoryName: 'Земляные работы',
      categoryId: 'cat1',
      locationName: 'Москва',
      locationId: 'loc1',
      name: 'Разработка грунта экскаватором',
      unit: 'м3',
      orderNum: 1,
      estimatedCost: 850000,
      actualCost: 820000,
      createdAt: '2025-01-10',
    },
    {
      key: '2',
      id: '2',
      categoryName: 'Земляные работы',
      categoryId: 'cat1',
      locationName: 'Санкт-Петербург',
      locationId: 'loc2',
      name: 'Вывоз грунта',
      unit: 'м3',
      orderNum: 2,
      estimatedCost: 450000,
      actualCost: 480000,
      createdAt: '2025-01-11',
    },
    {
      key: '3',
      id: '3',
      categoryName: 'Фундаментные работы',
      categoryId: 'cat2',
      locationName: 'Москва',
      locationId: 'loc1',
      name: 'Устройство монолитного фундамента',
      unit: 'м3',
      orderNum: 1,
      estimatedCost: 2500000,
      actualCost: 2450000,
      createdAt: '2025-01-12',
    },
    {
      key: '4',
      id: '4',
      categoryName: 'Фундаментные работы',
      categoryId: 'cat2',
      locationName: 'Екатеринбург',
      locationId: 'loc3',
      name: 'Армирование фундамента',
      unit: 'т',
      orderNum: 2,
      estimatedCost: 1200000,
      actualCost: 1180000,
      createdAt: '2025-01-13',
    },
    {
      key: '5',
      id: '5',
      categoryName: 'Кровельные работы',
      categoryId: 'cat3',
      locationName: 'Москва',
      locationId: 'loc1',
      name: 'Монтаж металлочерепицы',
      unit: 'м2',
      orderNum: 1,
      estimatedCost: 950000,
      actualCost: 980000,
      createdAt: '2025-01-14',
    },
  ];

  const locations = [
    { value: 'all', label: 'Все локации' },
    { value: 'loc1', label: 'Москва' },
    { value: 'loc2', label: 'Санкт-Петербург' },
    { value: 'loc3', label: 'Екатеринбург' },
  ];

  const categories = [
    { value: 'all', label: 'Все категории' },
    { value: 'cat1', label: 'Земляные работы' },
    { value: 'cat2', label: 'Фундаментные работы' },
    { value: 'cat3', label: 'Кровельные работы' },
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

  // Фильтрация данных
  const filteredData = detailCostData.filter(item => {
    const matchesSearch = searchText === '' ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.categoryName.toLowerCase().includes(searchText.toLowerCase());
    const matchesLocation = selectedLocation === 'all' || item.locationId === selectedLocation;
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;

    return matchesSearch && matchesLocation && matchesCategory;
  });

  // Расчёт статистики
  const totalEstimated = filteredData.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
  const totalActual = filteredData.reduce((sum, item) => sum + (item.actualCost || 0), 0);
  const difference = totalActual - totalEstimated;
  const percentDiff = totalEstimated > 0 ? (difference / totalEstimated * 100).toFixed(2) : '0';

  const columns: ColumnsType<DetailCostCategoryRecord> = [
    {
      title: '№',
      dataIndex: 'orderNum',
      key: 'orderNum',
      width: 60,
      align: 'center',
      sorter: (a, b) => a.orderNum - b.orderNum,
    },
    {
      title: 'Категория',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 180,
      render: (text: string) => (
        <Tag color="blue" icon={<AppstoreOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Локация',
      dataIndex: 'locationName',
      key: 'locationName',
      width: 150,
      render: (text: string) => (
        <Space>
          <EnvironmentOutlined style={{ color: '#10b981' }} />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Наименование работ',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Ед. изм.',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
      align: 'center',
      render: (unit: string) => (
        <Tag color={unitColors[unit] || 'default'}>{unit}</Tag>
      ),
    },
    {
      title: 'Плановая стоимость',
      dataIndex: 'estimatedCost',
      key: 'estimatedCost',
      width: 150,
      align: 'right',
      render: (cost?: number) => (
        <Text>{cost ? `${cost.toLocaleString('ru-RU')} ₽` : '—'}</Text>
      ),
      sorter: (a, b) => (a.estimatedCost || 0) - (b.estimatedCost || 0),
    },
    {
      title: 'Фактическая стоимость',
      dataIndex: 'actualCost',
      key: 'actualCost',
      width: 150,
      align: 'right',
      render: (cost: number | undefined, record: any) => {
        const diff = (record.actualCost || 0) - (record.estimatedCost || 0);
        const color = diff > 0 ? '#ff4d4f' : diff < 0 ? '#52c41a' : undefined;
        return (
          <Text style={{ color }}>
            {cost ? `${cost.toLocaleString('ru-RU')} ₽` : '—'}
          </Text>
        );
      },
      sorter: (a, b) => (a.actualCost || 0) - (b.actualCost || 0),
    },
    {
      title: 'Отклонение',
      key: 'difference',
      width: 120,
      align: 'right',
      render: (_: any, record) => {
        const diff = (record.actualCost || 0) - (record.estimatedCost || 0);
        const percent = record.estimatedCost ? (diff / record.estimatedCost * 100).toFixed(1) : 0;
        const color = diff > 0 ? '#ff4d4f' : diff < 0 ? '#52c41a' : '#888';
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ color, fontWeight: 500 }}>
              {diff >= 0 ? '+' : ''}{diff.toLocaleString('ru-RU')} ₽
            </Text>
            <Text style={{ color, fontSize: 12 }}>
              ({diff >= 0 ? '+' : ''}{percent}%)
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Действия',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: any, record: DetailCostCategoryRecord) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} />
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Статистические карточки */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Плановая стоимость"
              value={totalEstimated}
              suffix="₽"
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />}
              formatter={(value) => `${Number(value).toLocaleString('ru-RU')}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Фактическая стоимость"
              value={totalActual}
              suffix="₽"
              valueStyle={{ color: '#52c41a' }}
              prefix={<BarChartOutlined />}
              formatter={(value) => `${Number(value).toLocaleString('ru-RU')}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Отклонение"
              value={Math.abs(difference)}
              suffix="₽"
              valueStyle={{ color: difference > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={difference >= 0 ? '↑' : '↓'}
              formatter={(value) => `${Number(value).toLocaleString('ru-RU')}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Отклонение в %"
              value={Math.abs(Number(percentDiff))}
              suffix="%"
              valueStyle={{ color: difference > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={difference >= 0 ? '↑' : '↓'}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      {/* Основная таблица */}
      <Card
        title="Затраты строительства"
        extra={
          <Space>
            <Select
              value={selectedLocation}
              onChange={setSelectedLocation}
              style={{ width: 150 }}
            >
              {locations.map(loc => (
                <Option key={loc.value} value={loc.value}>{loc.label}</Option>
              ))}
            </Select>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 180 }}
            >
              {categories.map(cat => (
                <Option key={cat.value} value={cat.value}>{cat.label}</Option>
              ))}
            </Select>
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
        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total} записей`,
          }}
          size="middle"
          scroll={{ x: 1400 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <Text strong>Итого:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong>{totalEstimated.toLocaleString('ru-RU')} ₽</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong style={{ color: difference > 0 ? '#ff4d4f' : '#52c41a' }}>
                    {totalActual.toLocaleString('ru-RU')} ₽
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <Text strong style={{ color: difference > 0 ? '#ff4d4f' : '#52c41a' }}>
                    {difference >= 0 ? '+' : ''}{difference.toLocaleString('ru-RU')} ₽
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

export default ConstructionCost;