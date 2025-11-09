import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Input, Tag, Select, Typography, Row, Col, Statistic, Upload, message, Progress } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  DollarOutlined,
  BarChartOutlined,
  FileExcelOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { supabase } from '../../../lib/supabase';
import { costImportService } from '../../../services/costImportService';

const { Text } = Typography;
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
  const [data, setData] = useState<DetailCostCategoryRecord[]>([]);
  const [locations, setLocations] = useState<Array<{value: string; label: string}>>([
    { value: 'all', label: 'Все локации' }
  ]);
  const [categories, setCategories] = useState<Array<{value: string; label: string}>>([
    { value: 'all', label: 'Все категории' }
  ]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

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

  // Загрузка данных из Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // Загружаем детальные категории затрат с привязанными категориями и локациями
      const { data: detailData, error: detailError } = await supabase
        .from('detail_cost_categories')
        .select(`
          *,
          cost_categories (
            id,
            name,
            unit
          ),
          locations (
            id,
            location
          )
        `)
        .order('order_num', { ascending: true });

      if (detailError) {
        console.error('Ошибка загрузки данных:', detailError);
        message.error('Ошибка загрузки данных');
        return;
      }

      // Преобразуем данные для таблицы
      const transformedData = (detailData || []).map((item: any) => ({
        key: item.id,
        id: item.id,
        categoryName: item.cost_categories?.name || '',
        categoryId: item.cost_category_id,
        locationName: item.locations?.location || '',
        locationId: item.location_id,
        name: item.name,
        unit: item.unit,
        orderNum: item.order_num,
        createdAt: item.created_at,
      }));

      setData(transformedData);

      // Загружаем список локаций
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, location')
        .order('location');

      if (locationData) {
        const locationOptions = [
          { value: 'all', label: 'Все локации' },
          ...locationData.map(loc => ({ value: loc.id, label: loc.location }))
        ];
        setLocations(locationOptions);
      }

      // Загружаем список категорий
      const { data: categoryData } = await supabase
        .from('cost_categories')
        .select('id, name')
        .order('name');

      if (categoryData) {
        const categoryOptions = [
          { value: 'all', label: 'Все категории' },
          ...categoryData.map(cat => ({ value: cat.id, label: cat.name }))
        ];
        setCategories(categoryOptions);
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
      message.error('Произошла ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Функция обработки импорта Excel файла
  const handleImport = async (file: File) => {
    setImporting(true);
    setImportProgress(0);

    try {
      const result = await costImportService.importFromExcel(file, (progress) => {
        setImportProgress(progress);
      });

      if (result.success) {
        message.success(`Импорт завершен! Добавлено ${result.recordsAdded} записей`);
        // Перезагружаем данные
        await fetchData();
      } else {
        message.error(result.error || 'Ошибка при импорте данных');
      }
    } catch (error) {
      console.error('Ошибка импорта:', error);
      message.error('Произошла ошибка при импорте');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }

    return false; // Предотвращаем загрузку файла на сервер
  };

  // Фильтрация данных
  const filteredData = data.filter(item => {
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
      render: (cost: number | undefined, record: DetailCostCategoryRecord) => {
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
      render: (_: any) => (
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
              disabled={loading}
            >
              {locations.map(loc => (
                <Option key={loc.value} value={loc.value}>{loc.label}</Option>
              ))}
            </Select>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 180 }}
              disabled={loading}
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
              disabled={loading}
            />
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={handleImport}
              disabled={importing}
            >
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                loading={importing}
              >
                Импорт затрат
              </Button>
            </Upload>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
            >
              Обновить
            </Button>
            <Button icon={<PlusOutlined />}>
              Добавить
            </Button>
          </Space>
        }
      >
        {importing && (
          <div style={{ marginBottom: 16 }}>
            <Progress percent={importProgress} status="active" />
            <Text type="secondary">Импорт данных...</Text>
          </div>
        )}
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total} записей`,
          }}
          size="middle"
          scroll={{ x: 1400 }}
          locale={{
            emptyText: data.length === 0
              ? 'Нет данных. Используйте кнопку "Импорт затрат" для загрузки данных из Excel файла.'
              : 'Нет данных по выбранным фильтрам'
          }}
          summary={() => (
            filteredData.length > 0 && (
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
            )
          )}
        />
      </Card>
    </div>
  );
};

export default ConstructionCost;