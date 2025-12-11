import { useState, useEffect } from 'react';
import { Card, Table, Select, Tabs, Tag, Input, message, Button, Typography, Space, Row, Col } from 'antd';
import { SearchOutlined, FileExcelOutlined, ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import type { UnitType, BoqItemType } from '../../lib/supabase';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

interface TenderOption {
  value: string;
  label: string;
  clientName: string;
}

interface Tender {
  id: string;
  title: string;
  tender_number: string;
  client_name: string;
  version?: number;
}

interface BoqItemData {
  id: string;
  boq_item_type: BoqItemType;
  material_type?: 'основн.' | 'вспомогат.';
  name: string;
  total_quantity: number;
  unit_code: UnitType;
  price_per_unit: number;
  total_amount: number;
  usage_count: number; // количество позиций где используется
  quote_link?: string; // Ссылка на КП
  work_name_id?: string; // ID работы для UPDATE
  material_name_id?: string; // ID материала для UPDATE
}

const Bsm: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState<BoqItemData[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'materials' | 'works'>('all');

  // Fetch tenders
  const fetchTenders = async () => {
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('id, title, tender_number, client_name, version')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);
    } catch (error) {
      console.error('Error fetching tenders:', error);
      message.error('Ошибка загрузки тендеров');
    }
  };

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
    setSelectedTenderId(null);
    setSelectedVersion(null);
    setAllItems([]);
  };

  // Обработка выбора версии тендера
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const tender = tenders.find(t => t.title === selectedTenderTitle && t.version === version);
    if (tender) {
      setSelectedTenderId(tender.id);
      fetchBoqItems(tender.id);
    }
  };

  // Fetch BOQ items for selected tender
  const fetchBoqItems = async (tenderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('boq_items')
        .select(`
          id,
          boq_item_type,
          material_type,
          quantity,
          unit_code,
          total_amount,
          work_name_id,
          material_name_id,
          quote_link,
          work_names (
            name
          ),
          material_names (
            name
          )
        `)
        .eq('tender_id', tenderId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by material/work and aggregate
      const grouped = new Map<string, BoqItemData>();

      data?.forEach((item: any) => {
        const name = item.work_names?.name || item.material_names?.name || '—';
        const key = `${item.boq_item_type}_${item.work_name_id || item.material_name_id}`;

        if (grouped.has(key)) {
          const existing = grouped.get(key)!;
          existing.total_quantity += item.quantity || 0;
          existing.total_amount += item.total_amount || 0;
          existing.usage_count += 1;
          // Не перезаписывать quote_link если уже есть
        } else {
          grouped.set(key, {
            id: key,
            boq_item_type: item.boq_item_type,
            material_type: item.material_type,
            name: name,
            total_quantity: item.quantity || 0,
            unit_code: item.unit_code,
            price_per_unit: item.total_amount && item.quantity ? (item.total_amount / item.quantity) : 0,
            total_amount: item.total_amount || 0,
            usage_count: 1,
            quote_link: item.quote_link || '',
            work_name_id: item.work_name_id,
            material_name_id: item.material_name_id,
          });
        }
      });

      // Recalculate price per unit after aggregation
      const formatted = Array.from(grouped.values()).map(item => ({
        ...item,
        price_per_unit: item.total_quantity > 0 ? (item.total_amount / item.total_quantity) : 0
      }));

      setAllItems(formatted);
    } catch (error) {
      console.error('Error fetching BOQ items:', error);
      message.error('Ошибка загрузки позиций');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    if (selectedTenderId) {
      fetchBoqItems(selectedTenderId);
    } else {
      setAllItems([]);
    }
  }, [selectedTenderId]);

  // Handle inline quote link update
  const handleUpdateQuoteLink = async (record: BoqItemData, newQuoteLink: string) => {
    try {
      // Определить что обновлять: material или work
      const updateField = record.material_name_id ? 'material_name_id' : 'work_name_id';
      const updateValue = record.material_name_id || record.work_name_id;

      if (!updateValue) {
        message.error('Невозможно обновить ссылку: отсутствует ID материала/работы');
        return;
      }

      // UPDATE всех boq_items с тем же материалом/работой в текущем тендере
      const { error } = await supabase
        .from('boq_items')
        .update({ quote_link: newQuoteLink || null })
        .eq('tender_id', selectedTenderId!)
        .eq(updateField, updateValue);

      if (error) throw error;

      // Обновить локальное состояние
      setAllItems(prevItems =>
        prevItems.map(item =>
          item.id === record.id
            ? { ...item, quote_link: newQuoteLink }
            : item
        )
      );

      message.success('Ссылка на КП обновлена');
    } catch (error) {
      console.error('Error updating quote link:', error);
      message.error('Ошибка обновления ссылки на КП');
    }
  };

  // Handle automatic quote links application
  const handleApplyQuoteLinks = async () => {
    if (!selectedTenderId) {
      message.error('Не выбран тендер');
      return;
    }

    try {
      setLoading(true);

      // Шаг 1: Получить все строки БСМ с ссылками
      const itemsWithLinks = allItems.filter(item => item.quote_link && item.quote_link.trim() !== '');

      if (itemsWithLinks.length === 0) {
        message.warning('Нет ссылок для простановки. Сначала заполните ссылки на КП в таблице.');
        return;
      }

      // Шаг 2: Получить все boq_items текущего тендера
      const { data: boqItems, error: fetchError } = await supabase
        .from('boq_items')
        .select(`
          id,
          boq_item_type,
          material_type,
          work_name_id,
          material_name_id,
          unit_code,
          quantity,
          total_amount,
          work_names (
            name
          ),
          material_names (
            name
          )
        `)
        .eq('tender_id', selectedTenderId);

      if (fetchError) throw fetchError;

      // Шаг 3: Для каждой строки с ссылкой найти совпадения и обновить
      let updatedCount = 0;

      for (const sourceItem of itemsWithLinks) {
        const matchingItems = boqItems?.filter((targetItem: any) => {
          // Совпадение по виду строки
          if (targetItem.boq_item_type !== sourceItem.boq_item_type) return false;

          // Совпадение по типу материала (только для материалов)
          const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(sourceItem.boq_item_type);
          if (isMaterial && targetItem.material_type !== sourceItem.material_type) return false;

          // Совпадение по наименованию
          const targetName = targetItem.work_names?.name || targetItem.material_names?.name;
          if (targetName !== sourceItem.name) return false;

          // Совпадение по единице измерения
          if (targetItem.unit_code !== sourceItem.unit_code) return false;

          return true;
        }) || [];

        // UPDATE всех совпадающих записей
        if (matchingItems.length > 0) {
          const itemIds = matchingItems.map(item => item.id);

          const { error: updateError, count } = await supabase
            .from('boq_items')
            .update({ quote_link: sourceItem.quote_link })
            .in('id', itemIds)
            .select();

          if (updateError) {
            console.error('Error updating batch:', updateError);
          } else {
            updatedCount += matchingItems.length;
          }
        }
      }

      message.success(`Успешно проставлено ссылок в ${updatedCount} ${updatedCount === 1 ? 'запись' : updatedCount < 5 ? 'записи' : 'записей'}`);

      // Перезагрузить данные БСМ
      await fetchBoqItems(selectedTenderId);

    } catch (error) {
      console.error('Error applying quote links:', error);
      message.error('Ошибка простановки ссылок');
    } finally {
      setLoading(false);
    }
  };

  // Unit colors mapping
  const getUnitColor = (unit: UnitType): string => {
    const colors: Record<UnitType, string> = {
      'шт': 'blue',
      'м': 'green',
      'м2': 'cyan',
      'м3': 'purple',
      'кг': 'orange',
      'т': 'red',
      'л': 'magenta',
      'компл': 'volcano',
      'м.п.': 'geekblue'
    };
    return colors[unit] || 'default';
  };

  // Item type colors (из ItemsTable.tsx)
  const getItemTypeStyle = (type: BoqItemType): { backgroundColor: string; color: string } => {
    const isWork = ['раб', 'суб-раб', 'раб-комп.'].includes(type);

    if (isWork) {
      switch (type) {
        case 'раб':
          return { backgroundColor: 'rgba(239, 108, 0, 0.12)', color: '#f57c00' };
        case 'суб-раб':
          return { backgroundColor: 'rgba(106, 27, 154, 0.12)', color: '#7b1fa2' };
        case 'раб-комп.':
          return { backgroundColor: 'rgba(198, 40, 40, 0.12)', color: '#d32f2f' };
      }
    } else {
      switch (type) {
        case 'мат':
          return { backgroundColor: 'rgba(21, 101, 192, 0.12)', color: '#1976d2' };
        case 'суб-мат':
          return { backgroundColor: 'rgba(104, 159, 56, 0.12)', color: '#7cb342' };
        case 'мат-комп.':
          return { backgroundColor: 'rgba(0, 105, 92, 0.12)', color: '#00897b' };
      }
    }

    return { backgroundColor: 'rgba(0, 0, 0, 0.06)', color: '#000' };
  };

  // Material type colors (из ItemsTable.tsx)
  const getMaterialTypeStyle = (type?: 'основн.' | 'вспомогат.'): { backgroundColor: string; color: string } => {
    if (!type) return { backgroundColor: 'transparent', color: 'inherit' };

    if (type === 'основн.') {
      return { backgroundColor: 'rgba(255, 152, 0, 0.12)', color: '#fb8c00' };
    } else {
      return { backgroundColor: 'rgba(21, 101, 192, 0.12)', color: '#1976d2' };
    }
  };

  const isMaterial = (type: BoqItemType) =>
    ['мат', 'суб-мат', 'мат-комп.'].includes(type);

  // Filter items by type and search
  const getFilteredItems = (filterType: 'all' | 'materials' | 'works') => {
    let filtered = allItems;

    if (filterType === 'materials') {
      filtered = filtered.filter(item => isMaterial(item.boq_item_type));
    } else if (filterType === 'works') {
      filtered = filtered.filter(item => !isMaterial(item.boq_item_type));
    }

    if (searchText) {
      filtered = filtered.filter(item => {
        return item.name.toLowerCase().includes(searchText.toLowerCase());
      });
    }

    return filtered;
  };

  const columns = [
    {
      title: 'Вид строки',
      dataIndex: 'boq_item_type',
      key: 'boq_item_type',
      width: 110,
      align: 'center' as const,
      render: (type: BoqItemType) => {
        const style = getItemTypeStyle(type);
        return (
          <Tag style={{ backgroundColor: style.backgroundColor, color: style.color, border: 'none', margin: 0 }}>
            {type}
          </Tag>
        );
      },
      sorter: (a: BoqItemData, b: BoqItemData) => a.boq_item_type.localeCompare(b.boq_item_type),
    },
    {
      title: 'Тип материала',
      dataIndex: 'material_type',
      key: 'material_type',
      width: 120,
      align: 'center' as const,
      render: (type?: 'основн.' | 'вспомогат.') => {
        if (!type) return <span>—</span>;
        const style = getMaterialTypeStyle(type);
        return (
          <Tag style={{ backgroundColor: style.backgroundColor, color: style.color, border: 'none', margin: 0, fontSize: 11 }}>
            {type}
          </Tag>
        );
      },
      sorter: (a: BoqItemData, b: BoqItemData) => {
        const aType = a.material_type || '';
        const bType = b.material_type || '';
        return aType.localeCompare(bType);
      },
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (name: string) => (
        <div style={{ whiteSpace: 'normal', wordWrap: 'break-word', wordBreak: 'break-word' }}>
          {name}
        </div>
      ),
      sorter: (a: BoqItemData, b: BoqItemData) => a.name.localeCompare(b.name),
    },
    {
      title: 'Количество',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 120,
      align: 'center' as const,
      render: (qty: number) => (
        <div style={{ textAlign: 'center' }}>{qty.toFixed(2)}</div>
      ),
    },
    {
      title: 'Ед.изм.',
      dataIndex: 'unit_code',
      key: 'unit_code',
      width: 100,
      align: 'center' as const,
      render: (unit: UnitType) => (
        <Tag color={getUnitColor(unit)}>{unit}</Tag>
      ),
    },
    {
      title: 'Цена за ед.',
      dataIndex: 'price_per_unit',
      key: 'price_per_unit',
      width: 150,
      align: 'center' as const,
      render: (price: number) => (
        <div style={{ textAlign: 'center' }}>{price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</div>
      ),
      sorter: (a: BoqItemData, b: BoqItemData) => a.price_per_unit - b.price_per_unit,
    },
    {
      title: 'Сумма',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 180,
      align: 'center' as const,
      render: (amount: number) => (
        <div style={{ textAlign: 'center' }}>{Math.round(amount).toLocaleString('ru-RU')}</div>
      ),
      sorter: (a: BoqItemData, b: BoqItemData) => a.total_amount - b.total_amount,
    },
    {
      title: 'Кол-во позиций',
      dataIndex: 'usage_count',
      key: 'usage_count',
      width: 130,
      align: 'center' as const,
      render: (count: number) => (
        <div style={{ textAlign: 'center' }}>{count}</div>
      ),
      sorter: (a: BoqItemData, b: BoqItemData) => a.usage_count - b.usage_count,
    },
    {
      title: 'Ссылка на КП',
      dataIndex: 'quote_link',
      key: 'quote_link',
      width: 325,
      align: 'center' as const,
      render: (_: string, record: BoqItemData) => (
        <Input
          placeholder="Введите ссылку"
          defaultValue={record.quote_link || ''}
          onBlur={(e) => handleUpdateQuoteLink(record, e.target.value)}
          onPressEnter={(e) => {
            e.currentTarget.blur();
          }}
          style={{ width: '100%' }}
        />
      ),
      sorter: (a: BoqItemData, b: BoqItemData) => {
        const aLink = a.quote_link || '';
        const bLink = b.quote_link || '';
        return aLink.localeCompare(bLink);
      },
    },
  ];

  const filteredItems = getFilteredItems(activeTab);

  // Export to Excel
  const handleExportToExcel = () => {
    if (filteredItems.length === 0) {
      message.warning('Нет данных для экспорта');
      return;
    }

    const exportData = filteredItems.map((item, index) => ({
      '№': index + 1,
      'Тип': item.boq_item_type,
      'Наименование': item.name,
      'Количество': item.total_quantity,
      'Ед.изм.': item.unit_code,
      'Цена за ед., ₽': item.price_per_unit,
      'Сумма, ₽': item.total_amount,
      'Кол-во позиций': item.usage_count,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'БСМ');

    const fileName = `БСМ_${selectedTenderTitle || 'тендер'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    message.success('Данные успешно экспортированы');
  };

  const tabItems = [
    {
      key: 'all',
      label: `Общее (${allItems.length})`,
    },
    {
      key: 'materials',
      label: `Материалы (${allItems.filter(item => isMaterial(item.boq_item_type)).length})`,
    },
    {
      key: 'works',
      label: `Работы (${allItems.filter(item => !isMaterial(item.boq_item_type)).length})`,
    },
  ];

  // Если тендер не выбран, показываем экран выбора тендера
  if (!selectedTenderId) {
    return (
      <Card bordered={false} style={{ height: '100%' }}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Title level={3} style={{ marginBottom: 24 }}>
              Базовая Стоимость Материалов и Работ
            </Title>
            <Text type="secondary" style={{ fontSize: 16, marginBottom: 24, display: 'block' }}>
              Выберите тендер для просмотра базовой стоимости
            </Text>
            <Select
              style={{ width: 400, marginBottom: 32 }}
              placeholder="Выберите тендер"
              value={selectedTenderTitle}
              onChange={handleTenderTitleChange}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={getTenderTitles()}
              size="large"
            />

            {selectedTenderTitle && (
              <Select
                style={{ width: 200, marginBottom: 32, marginLeft: 16 }}
                placeholder="Выберите версию"
                value={selectedVersion}
                onChange={handleVersionChange}
                options={getVersionsForTitle(selectedTenderTitle)}
                size="large"
              />
            )}

            {/* Быстрый выбор через карточки */}
            {tenders.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Или выберите из списка:
                </Text>
                <Row gutter={[16, 16]} justify="center">
                  {tenders.slice(0, 6).map(tender => (
                    <Col key={tender.id}>
                      <Card
                        hoverable
                        style={{
                          width: 200,
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedTenderTitle(tender.title);
                          setSelectedVersion(tender.version || 1);
                          setSelectedTenderId(tender.id);
                          fetchBoqItems(tender.id);
                        }}
                      >
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="blue">{tender.tender_number}</Tag>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong style={{ marginRight: 8 }}>
                            {tender.title}
                          </Text>
                          <Tag color="orange">v{tender.version || 1}</Tag>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {tender.client_name}
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </div>
      </Card>
    );
  }

  return (
    <Card
      bordered={false}
      style={{ height: '100%' }}
      headStyle={{ borderBottom: 'none', paddingBottom: 0 }}
      title={
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="primary"
            onClick={() => {
              setSelectedTenderId(null);
              setSelectedTenderTitle(null);
              setSelectedVersion(null);
            }}
            style={{
              padding: '4px 15px',
              display: 'inline-flex',
              alignItems: 'center',
              width: 'fit-content',
              backgroundColor: '#10b981',
              borderColor: '#10b981'
            }}
          >
            Назад к выбору
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Базовая Стоимость Материалов и Работ
          </Title>
          <Space size="middle">
            <Space size="small">
              <Text type="secondary" style={{ fontSize: 16 }}>Тендер:</Text>
              <Select
                placeholder="Выберите тендер"
                style={{ width: 350, fontSize: 16 }}
                value={selectedTenderTitle}
                onChange={handleTenderTitleChange}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={getTenderTitles()}
                allowClear
              />
            </Space>
            <Space size="small">
              <Text type="secondary" style={{ fontSize: 16 }}>Версия:</Text>
              <Select
                placeholder="Версия"
                value={selectedVersion}
                onChange={handleVersionChange}
                disabled={!selectedTenderTitle}
                options={selectedTenderTitle ? getVersionsForTitle(selectedTenderTitle) : []}
                style={{ width: 140 }}
              />
            </Space>
          </Space>
        </Space>
      }
    >
      {selectedTenderId && (
        <>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'all' | 'materials' | 'works')}
            items={tabItems}
            style={{ marginBottom: 16 }}
            tabBarExtraContent={
              <Space>
                <Button
                  icon={<LinkOutlined />}
                  onClick={handleApplyQuoteLinks}
                  disabled={!selectedTenderId}
                  type="default"
                >
                  Проставить ссылки
                </Button>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={handleExportToExcel}
                  disabled={!selectedTenderId}
                >
                  Экспорт в Excel
                </Button>
                <Input
                  placeholder="Поиск..."
                  prefix={<SearchOutlined />}
                  style={{ width: 250 }}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                />
              </Space>
            }
          />

          <Table
            bordered
            dataSource={filteredItems}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={false}
            scroll={{ x: 'max-content', y: 'calc(100vh - 450px)' }}
            size="middle"
          />
        </>
      )}

      {!selectedTenderId && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          Выберите тендер для просмотра позиций
        </div>
      )}
    </Card>
  );
};

export default Bsm;
