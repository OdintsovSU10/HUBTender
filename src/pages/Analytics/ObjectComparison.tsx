import React, { useState, useEffect } from 'react';
import { Card, Typography, Select, Table, Space, Statistic, Row, Col, Button, message, Spin } from 'antd';
import { BarChartOutlined, ReloadOutlined, LineChartOutlined } from '@ant-design/icons';
import { supabase, type Tender } from '../../lib/supabase';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface TenderComparison {
  category: string;
  tender1_materials: number;
  tender1_works: number;
  tender1_total: number;
  tender2_materials: number;
  tender2_works: number;
  tender2_total: number;
  diff_materials: number;
  diff_works: number;
  diff_total: number;
  diff_materials_percent: number;
  diff_works_percent: number;
  diff_total_percent: number;
}

const ObjectComparison: React.FC = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTender1, setSelectedTender1] = useState<string | null>(null);
  const [selectedTender2, setSelectedTender2] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<TenderComparison[]>([]);
  const [tender1Info, setTender1Info] = useState<Tender | null>(null);
  const [tender2Info, setTender2Info] = useState<Tender | null>(null);

  // Загрузка списка тендеров
  useEffect(() => {
    fetchTenders();
  }, []);

  const fetchTenders = async () => {
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);
    } catch (error: any) {
      message.error('Ошибка загрузки тендеров: ' + error.message);
    }
  };

  // Загрузка данных для сравнения
  const loadComparisonData = async () => {
    if (!selectedTender1 || !selectedTender2) {
      message.warning('Выберите два тендера для сравнения');
      return;
    }

    if (selectedTender1 === selectedTender2) {
      message.warning('Выберите разные тендеры для сравнения');
      return;
    }

    setLoading(true);

    try {
      // Загружаем информацию о тендерах
      const { data: tender1Data, error: error1 } = await supabase
        .from('tenders')
        .select('*')
        .eq('id', selectedTender1)
        .single();

      const { data: tender2Data, error: error2 } = await supabase
        .from('tenders')
        .select('*')
        .eq('id', selectedTender2)
        .single();

      if (error1 || error2) throw error1 || error2;

      setTender1Info(tender1Data);
      setTender2Info(tender2Data);

      // Загружаем данные по затратам для первого тендера с батчингом
      let costs1: any[] = [];
      let from1 = 0;
      const batchSize = 1000;
      let hasMore1 = true;

      while (hasMore1) {
        const { data, error } = await supabase
          .from('boq_items')
          .select(`
            total_amount,
            boq_item_type,
            detail_cost_category_id,
            detail_cost_categories!inner(
              name,
              cost_categories(name)
            ),
            client_positions!inner(tender_id)
          `)
          .eq('client_positions.tender_id', selectedTender1)
          .range(from1, from1 + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          costs1 = [...costs1, ...data];
          from1 += batchSize;
          hasMore1 = data.length === batchSize;
        } else {
          hasMore1 = false;
        }
      }

      // Загружаем данные по затратам для второго тендера с батчингом
      let costs2: any[] = [];
      let from2 = 0;
      let hasMore2 = true;

      while (hasMore2) {
        const { data, error } = await supabase
          .from('boq_items')
          .select(`
            total_amount,
            boq_item_type,
            detail_cost_category_id,
            detail_cost_categories!inner(
              name,
              cost_categories(name)
            ),
            client_positions!inner(tender_id)
          `)
          .eq('client_positions.tender_id', selectedTender2)
          .range(from2, from2 + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          costs2 = [...costs2, ...data];
          from2 += batchSize;
          hasMore2 = data.length === batchSize;
        } else {
          hasMore2 = false;
        }
      }

      // Группируем данные по категориям
      const categories = new Map<string, TenderComparison>();

      // Обрабатываем данные первого тендера
      (costs1 || []).forEach((item: any) => {
        const categoryName = item.detail_cost_categories?.cost_categories?.name || 'Без категории';
        const amount = item.total_amount || 0;

        if (!categories.has(categoryName)) {
          categories.set(categoryName, {
            category: categoryName,
            tender1_materials: 0,
            tender1_works: 0,
            tender1_total: 0,
            tender2_materials: 0,
            tender2_works: 0,
            tender2_total: 0,
            diff_materials: 0,
            diff_works: 0,
            diff_total: 0,
            diff_materials_percent: 0,
            diff_works_percent: 0,
            diff_total_percent: 0,
          });
        }

        const category = categories.get(categoryName)!;

        switch (item.boq_item_type) {
          case 'мат':
          case 'суб-мат':
          case 'мат-комп.':
            category.tender1_materials += amount;
            break;
          case 'раб':
          case 'суб-раб':
          case 'раб-комп.':
            category.tender1_works += amount;
            break;
        }
        category.tender1_total += amount;
      });

      // Обрабатываем данные второго тендера
      (costs2 || []).forEach((item: any) => {
        const categoryName = item.detail_cost_categories?.cost_categories?.name || 'Без категории';
        const amount = item.total_amount || 0;

        if (!categories.has(categoryName)) {
          categories.set(categoryName, {
            category: categoryName,
            tender1_materials: 0,
            tender1_works: 0,
            tender1_total: 0,
            tender2_materials: 0,
            tender2_works: 0,
            tender2_total: 0,
            diff_materials: 0,
            diff_works: 0,
            diff_total: 0,
            diff_materials_percent: 0,
            diff_works_percent: 0,
            diff_total_percent: 0,
          });
        }

        const category = categories.get(categoryName)!;

        switch (item.boq_item_type) {
          case 'мат':
          case 'суб-мат':
          case 'мат-комп.':
            category.tender2_materials += amount;
            break;
          case 'раб':
          case 'суб-раб':
          case 'раб-комп.':
            category.tender2_works += amount;
            break;
        }
        category.tender2_total += amount;
      });

      // Вычисляем разницу и проценты
      const comparison: TenderComparison[] = Array.from(categories.values()).map(cat => ({
        ...cat,
        diff_materials: cat.tender2_materials - cat.tender1_materials,
        diff_works: cat.tender2_works - cat.tender1_works,
        diff_total: cat.tender2_total - cat.tender1_total,
        diff_materials_percent: cat.tender1_materials > 0
          ? ((cat.tender2_materials - cat.tender1_materials) / cat.tender1_materials) * 100
          : 0,
        diff_works_percent: cat.tender1_works > 0
          ? ((cat.tender2_works - cat.tender1_works) / cat.tender1_works) * 100
          : 0,
        diff_total_percent: cat.tender1_total > 0
          ? ((cat.tender2_total - cat.tender1_total) / cat.tender1_total) * 100
          : 0,
      }));

      setComparisonData(comparison);
      message.success('Данные успешно загружены');
    } catch (error: any) {
      message.error('Ошибка загрузки данных: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Колонки таблицы
  const columns: ColumnsType<TenderComparison> = [
    {
      title: <div style={{ textAlign: 'center' }}>Категория</div>,
      dataIndex: 'category',
      key: 'category',
      fixed: 'left',
      width: 200,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: <div style={{ textAlign: 'center' }}>Тендер 1 - Материалы</div>,
      dataIndex: 'tender1_materials',
      key: 'tender1_materials',
      align: 'right',
      width: 150,
      render: (value) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Тендер 1 - Работы</div>,
      dataIndex: 'tender1_works',
      key: 'tender1_works',
      align: 'right',
      width: 150,
      render: (value) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Тендер 1 - Итого</div>,
      dataIndex: 'tender1_total',
      key: 'tender1_total',
      align: 'right',
      width: 150,
      render: (value) => <Text strong>{value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>,
    },
    {
      title: <div style={{ textAlign: 'center' }}>Тендер 2 - Материалы</div>,
      dataIndex: 'tender2_materials',
      key: 'tender2_materials',
      align: 'right',
      width: 150,
      render: (value) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Тендер 2 - Работы</div>,
      dataIndex: 'tender2_works',
      key: 'tender2_works',
      align: 'right',
      width: 150,
      render: (value) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Тендер 2 - Итого</div>,
      dataIndex: 'tender2_total',
      key: 'tender2_total',
      align: 'right',
      width: 150,
      render: (value) => <Text strong>{value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>,
    },
    {
      title: <div style={{ textAlign: 'center' }}>Разница - Материалы</div>,
      dataIndex: 'diff_materials',
      key: 'diff_materials',
      align: 'right',
      width: 150,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ({record.diff_materials_percent >= 0 ? '+' : ''}{record.diff_materials_percent.toFixed(1)}%)
          </Text>
        </Space>
      ),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Разница - Работы</div>,
      dataIndex: 'diff_works',
      key: 'diff_works',
      align: 'right',
      width: 150,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ({record.diff_works_percent >= 0 ? '+' : ''}{record.diff_works_percent.toFixed(1)}%)
          </Text>
        </Space>
      ),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Разница - Итого</div>,
      dataIndex: 'diff_total',
      key: 'diff_total',
      align: 'right',
      width: 150,
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ({record.diff_total_percent >= 0 ? '+' : ''}{record.diff_total_percent.toFixed(1)}%)
          </Text>
        </Space>
      ),
    },
  ];

  // Вычисляем общие статистики
  const totalStats = comparisonData.reduce(
    (acc, item) => ({
      tender1_total: acc.tender1_total + item.tender1_total,
      tender2_total: acc.tender2_total + item.tender2_total,
      diff_total: acc.diff_total + item.diff_total,
    }),
    { tender1_total: 0, tender2_total: 0, diff_total: 0 }
  );

  const diffPercent = totalStats.tender1_total > 0
    ? ((totalStats.diff_total / totalStats.tender1_total) * 100).toFixed(2)
    : '0';

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Заголовок */}
        <Card>
          <Space align="center" size="middle">
            <LineChartOutlined style={{ fontSize: '32px', color: '#10b981' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>Сравнение объектов</Title>
              <Text type="secondary">Сравните затраты между двумя тендерами по категориям</Text>
            </div>
          </Space>
        </Card>

        {/* Выбор тендеров */}
        <Card title="Выбор тендеров для сравнения">
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Тендер 1:</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Выберите первый тендер"
                  value={selectedTender1}
                  onChange={setSelectedTender1}
                  showSearch
                  optionFilterProp="children"
                >
                  {tenders.map(tender => (
                    <Option key={tender.id} value={tender.id}>
                      {tender.title} (v{tender.version || 1})
                    </Option>
                  ))}
                </Select>
                {tender1Info && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Создан: {dayjs(tender1Info.created_at).format('DD.MM.YYYY')}
                  </Text>
                )}
              </Space>
            </Col>
            <Col xs={24} md={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChartOutlined style={{ fontSize: '24px', color: '#999' }} />
            </Col>
            <Col xs={24} md={10}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Тендер 2:</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Выберите второй тендер"
                  value={selectedTender2}
                  onChange={setSelectedTender2}
                  showSearch
                  optionFilterProp="children"
                >
                  {tenders.map(tender => (
                    <Option key={tender.id} value={tender.id}>
                      {tender.title} (v{tender.version || 1})
                    </Option>
                  ))}
                </Select>
                {tender2Info && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Создан: {dayjs(tender2Info.created_at).format('DD.MM.YYYY')}
                  </Text>
                )}
              </Space>
            </Col>
          </Row>
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadComparisonData}
              loading={loading}
              disabled={!selectedTender1 || !selectedTender2}
            >
              Загрузить сравнение
            </Button>
          </div>
        </Card>

        {/* Общая статистика */}
        {comparisonData.length > 0 && (
          <Card title="Общая статистика">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Statistic
                  title={`Итого: ${tender1Info?.title || 'Тендер 1'}`}
                  value={totalStats.tender1_total}
                  precision={2}
                  suffix="₽"
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title={`Итого: ${tender2Info?.title || 'Тендер 2'}`}
                  value={totalStats.tender2_total}
                  precision={2}
                  suffix="₽"
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Разница"
                  value={totalStats.diff_total}
                  precision={2}
                  suffix="₽"
                  valueStyle={{ color: totalStats.diff_total >= 0 ? '#52c41a' : '#ff4d4f' }}
                  prefix={totalStats.diff_total >= 0 ? '+' : ''}
                />
                <Text type="secondary">
                  ({diffPercent}% {totalStats.diff_total >= 0 ? 'больше' : 'меньше'})
                </Text>
              </Col>
            </Row>
          </Card>
        )}

        {/* Таблица сравнения */}
        {loading ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                <Text>Загрузка данных для сравнения...</Text>
              </div>
            </div>
          </Card>
        ) : comparisonData.length > 0 ? (
          <Card title="Детальное сравнение по категориям">
            <Table
              columns={columns}
              dataSource={comparisonData}
              rowKey="category"
              pagination={false}
              scroll={{ x: 1500 }}
              bordered
            />
          </Card>
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <BarChartOutlined style={{ fontSize: '64px', color: '#ccc' }} />
              <div style={{ marginTop: '16px' }}>
                <Text type="secondary">Выберите два тендера и нажмите "Загрузить сравнение"</Text>
              </div>
            </div>
          </Card>
        )}
      </Space>
    </div>
  );
};

export default ObjectComparison;
