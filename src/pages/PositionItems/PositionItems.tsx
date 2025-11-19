import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  message,
  InputNumber,
  Input,
  AutoComplete,
  Select,
  Popconfirm,
  Form,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  supabase,
  type ClientPosition,
  type BoqItemFull,
  type BoqItemInsert,
  type WorkLibraryFull,
  type MaterialLibraryFull,
  type BoqItemType,
  type MaterialType,
  type CurrencyType,
  type DeliveryPriceType,
} from '../../lib/supabase';
import WorkEditForm from './WorkEditForm';
import MaterialEditForm from './MaterialEditForm';

const { Text, Title } = Typography;

const currencySymbols: Record<CurrencyType, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  CNY: '¥',
};

const PositionItems: React.FC = () => {
  const { positionId } = useParams<{ positionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [position, setPosition] = useState<ClientPosition | null>(null);
  const [items, setItems] = useState<BoqItemFull[]>([]);
  const [works, setWorks] = useState<WorkLibraryFull[]>([]);
  const [materials, setMaterials] = useState<MaterialLibraryFull[]>([]);
  const [loading, setLoading] = useState(false);

  const [workSearchText, setWorkSearchText] = useState<string>('');
  const [materialSearchText, setMaterialSearchText] = useState<string>('');

  // Состояния для expandable форм
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [currencyRates, setCurrencyRates] = useState<{ usd: number; eur: number; cny: number }>({ usd: 0, eur: 0, cny: 0 });
  const [costCategories, setCostCategories] = useState<any[]>([]);
  const [workNames, setWorkNames] = useState<any[]>([]);
  const [materialNames, setMaterialNames] = useState<any[]>([]);

  useEffect(() => {
    if (positionId) {
      fetchPositionData();
      fetchItems();
      fetchWorks();
      fetchMaterials();
      fetchCostCategories();
      fetchWorkNames();
      fetchMaterialNames();
    }
  }, [positionId]);

  // Функция для получения курса валюты
  const getCurrencyRate = (currency: CurrencyType): number => {
    switch (currency) {
      case 'USD':
        return currencyRates.usd;
      case 'EUR':
        return currencyRates.eur;
      case 'CNY':
        return currencyRates.cny;
      case 'RUB':
      default:
        return 1;
    }
  };

  const fetchPositionData = async () => {
    try {
      const { data, error } = await supabase
        .from('client_positions')
        .select('*, tenders(usd_rate, eur_rate, cny_rate)')
        .eq('id', positionId)
        .single();

      if (error) throw error;
      setPosition(data);

      // Сохранить курсы валют
      if (data.tenders) {
        setCurrencyRates({
          usd: data.tenders.usd_rate || 0,
          eur: data.tenders.eur_rate || 0,
          cny: data.tenders.cny_rate || 0,
        });
      }
    } catch (error: any) {
      message.error('Ошибка загрузки позиции: ' + error.message);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('boq_items')
        .select(`
          *,
          material_names(name, unit),
          work_names(name, unit),
          parent_work:parent_work_item_id(work_names(name))
        `)
        .eq('client_position_id', positionId)
        .order('sort_number', { ascending: true });

      if (error) throw error;

      // Fetch unit rates from libraries
      const materialIds = (data || [])
        .filter(item => item.material_name_id)
        .map(item => item.material_name_id);

      const workIds = (data || [])
        .filter(item => item.work_name_id)
        .map(item => item.work_name_id);

      let materialRates: Record<string, number> = {};
      let workRates: Record<string, number> = {};

      if (materialIds.length > 0) {
        const { data: matData } = await supabase
          .from('materials_library')
          .select('material_name_id, unit_rate')
          .in('material_name_id', materialIds);

        materialRates = (matData || []).reduce((acc, item) => {
          acc[item.material_name_id] = item.unit_rate;
          return acc;
        }, {} as Record<string, number>);
      }

      if (workIds.length > 0) {
        const { data: workData } = await supabase
          .from('works_library')
          .select('work_name_id, unit_rate')
          .in('work_name_id', workIds);

        workRates = (workData || []).reduce((acc, item) => {
          acc[item.work_name_id] = item.unit_rate;
          return acc;
        }, {} as Record<string, number>);
      }

      const formattedItems: BoqItemFull[] = (data || []).map((item: any) => ({
        ...item,
        material_name: item.material_names?.name,
        material_unit: item.material_names?.unit,
        work_name: item.work_names?.name,
        work_unit: item.work_names?.unit,
        parent_work_name: item.parent_work?.work_names?.name,
        unit_rate: item.material_name_id
          ? materialRates[item.material_name_id]
          : workRates[item.work_name_id],
      }));

      setItems(formattedItems);
    } catch (error: any) {
      message.error('Ошибка загрузки элементов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorks = async () => {
    try {
      const { data, error } = await supabase
        .from('works_library')
        .select('*, work_names(name, unit)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: WorkLibraryFull[] = (data || []).map((item: any) => ({
        ...item,
        work_name: item.work_names?.name,
        unit: item.work_names?.unit,
      }));

      setWorks(formatted);
    } catch (error: any) {
      message.error('Ошибка загрузки работ: ' + error.message);
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials_library')
        .select('*, material_names(name, unit)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: MaterialLibraryFull[] = (data || []).map((item: any) => ({
        ...item,
        material_name: item.material_names?.name,
        unit: item.material_names?.unit,
      }));

      setMaterials(formatted);
    } catch (error: any) {
      message.error('Ошибка загрузки материалов: ' + error.message);
    }
  };

  const fetchCostCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('detail_cost_categories')
        .select(`
          id,
          name,
          cost_category_id,
          location,
          cost_categories(name)
        `)
        .order('order_num', { ascending: true });

      if (error) throw error;

      const options = (data || []).map((item: any) => ({
        value: item.id,
        label: `${item.cost_categories?.name} / ${item.name} / ${item.location}`,
        cost_category_name: item.cost_categories?.name || '',
        location: item.location || '',
      }));

      setCostCategories(options);
    } catch (error: any) {
      message.error('Ошибка загрузки категорий затрат: ' + error.message);
    }
  };

  const fetchWorkNames = async () => {
    try {
      const { data, error } = await supabase
        .from('work_names')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setWorkNames(data || []);
    } catch (error: any) {
      message.error('Ошибка загрузки наименований работ: ' + error.message);
    }
  };

  const fetchMaterialNames = async () => {
    try {
      const { data, error } = await supabase
        .from('material_names')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setMaterialNames(data || []);
    } catch (error: any) {
      message.error('Ошибка загрузки наименований материалов: ' + error.message);
    }
  };

  const handleAddWork = async (workNameId: string) => {
    if (!workNameId || !position) {
      message.error('Выберите работу');
      return;
    }

    try {
      const workLib = works.find(w => w.work_name_id === workNameId);
      if (!workLib) throw new Error('Работа не найдена в библиотеке');

      const maxSort = Math.max(...items.map(i => i.sort_number || 0), 0);

      const newItem: BoqItemInsert = {
        tender_id: position.tender_id,
        client_position_id: position.id,
        sort_number: maxSort + 1,
        boq_item_type: workLib.item_type as BoqItemType,
        work_name_id: workLib.work_name_id,
        unit_code: workLib.unit,
        quantity: 1,
        currency_type: workLib.currency_type as CurrencyType,
      };

      const { error } = await supabase.from('boq_items').insert(newItem);

      if (error) throw error;

      message.success('Работа добавлена');
      setWorkSearchText('');
      fetchItems();
    } catch (error: any) {
      message.error('Ошибка добавления работы: ' + error.message);
    }
  };

  const handleAddMaterial = async (materialNameId: string) => {
    if (!materialNameId || !position) {
      message.error('Выберите материал');
      return;
    }

    try {
      const matLib = materials.find(m => m.material_name_id === materialNameId);
      if (!matLib) throw new Error('Материал не найден в библиотеке');

      const maxSort = Math.max(...items.map(i => i.sort_number || 0), 0);

      const newItem: BoqItemInsert = {
        tender_id: position.tender_id,
        client_position_id: position.id,
        sort_number: maxSort + 1,
        boq_item_type: matLib.item_type as BoqItemType,
        material_type: matLib.material_type as MaterialType,
        material_name_id: matLib.material_name_id,
        unit_code: matLib.unit,
        quantity: 1,
        consumption_coefficient: matLib.consumption_coefficient,
        currency_type: matLib.currency_type as CurrencyType,
        delivery_price_type: matLib.delivery_price_type as DeliveryPriceType,
        delivery_amount: matLib.delivery_amount,
      };

      const { error } = await supabase.from('boq_items').insert(newItem);

      if (error) throw error;

      message.success('Материал добавлен');
      setMaterialSearchText('');
      fetchItems();
    } catch (error: any) {
      message.error('Ошибка добавления материала: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('boq_items').delete().eq('id', id);

      if (error) throw error;

      message.success('Элемент удален');
      fetchItems();
    } catch (error: any) {
      message.error('Ошибка удаления: ' + error.message);
    }
  };

  // Обработчики для expandable форм
  const handleEditClick = (record: BoqItemFull) => {
    setExpandedRowKeys([record.id]);
  };

  const handleFormSave = async (data: any) => {
    try {
      const recordId = expandedRowKeys[0];
      if (!recordId) return;

      const { error } = await supabase
        .from('boq_items')
        .update(data)
        .eq('id', recordId);

      if (error) throw error;

      message.success('Изменения сохранены');
      setExpandedRowKeys([]);
      fetchItems();
    } catch (error: any) {
      message.error('Ошибка сохранения: ' + error.message);
    }
  };

  const handleFormCancel = () => {
    setExpandedRowKeys([]);
  };

  const getRowClassName = (record: BoqItemFull): string => {
    const itemType = record.boq_item_type;

    switch (itemType) {
      case 'раб':
        return 'boq-row-rab';
      case 'суб-раб':
        return 'boq-row-sub-rab';
      case 'раб-комп.':
        return 'boq-row-rab-comp';
      case 'мат':
        return 'boq-row-mat';
      case 'суб-мат':
        return 'boq-row-sub-mat';
      case 'мат-комп.':
        return 'boq-row-mat-comp';
      default:
        return '';
    }
  };

  const getAvailableWorks = () => {
    return items.filter(
      item => item.boq_item_type === 'раб' ||
        item.boq_item_type === 'суб-раб' ||
        item.boq_item_type === 'раб-комп.'
    );
  };

  const getDeliveryText = (record: BoqItemFull): string => {
    if (!record.delivery_price_type) return '-';

    if (record.delivery_price_type === 'в цене') {
      return 'Включена';
    } else if (record.delivery_price_type === 'не в цене' && record.delivery_amount) {
      return `Не включена (${record.delivery_amount}%)`;
    } else if (record.delivery_price_type === 'суммой' && record.delivery_amount) {
      const symbol = currencySymbols[record.currency_type || 'RUB'];
      return `${record.delivery_amount.toLocaleString('ru-RU')} ${symbol}`;
    }
    return '-';
  };

  const calculateTotal = (record: BoqItemFull): number => {
    // This will be implemented later with proper price calculation logic
    return record.total_amount || 0;
  };


  const columns: any[] = [
    {
      title: <div style={{ textAlign: 'center' }}>Тип</div>,
      key: 'type',
      width: 80,
      align: 'center',
      render: (_: any, record: BoqItemFull) => {
        const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(record.boq_item_type);
        const itemType = record.boq_item_type;

        // Цвета из Templates (точное соответствие)
        let bgColor = '';
        let textColor = '';

        if (['раб', 'суб-раб', 'раб-комп.'].includes(itemType)) {
          switch (itemType) {
            case 'раб':
              bgColor = 'rgba(239, 108, 0, 0.12)';
              textColor = '#f57c00';
              break;
            case 'суб-раб':
              bgColor = 'rgba(106, 27, 154, 0.12)';
              textColor = '#7b1fa2';
              break;
            case 'раб-комп.':
              bgColor = 'rgba(198, 40, 40, 0.12)';
              textColor = '#d32f2f';
              break;
          }
        } else {
          switch (itemType) {
            case 'мат':
              bgColor = 'rgba(21, 101, 192, 0.12)';
              textColor = '#1976d2';
              break;
            case 'суб-мат':
              bgColor = 'rgba(104, 159, 56, 0.12)';
              textColor = '#7cb342';
              break;
            case 'мат-комп.':
              bgColor = 'rgba(0, 105, 92, 0.12)';
              textColor = '#00897b';
              break;
          }
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Tag style={{ backgroundColor: bgColor, color: textColor, border: 'none', margin: 0 }}>
              {itemType}
            </Tag>
            {isMaterial && record.material_type && (
              <Tag
                style={{
                  backgroundColor: record.material_type === 'основн.' ? 'rgba(255, 152, 0, 0.12)' : 'rgba(21, 101, 192, 0.12)',
                  color: record.material_type === 'основн.' ? '#fb8c00' : '#1976d2',
                  border: 'none',
                  margin: 0,
                  fontSize: 11,
                }}
              >
                {record.material_type}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Наименование</div>,
      key: 'name',
      width: 200,
      render: (_: any, record: BoqItemFull) => {
        const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(record.boq_item_type);
        const parentWork = record.parent_work_item_id
          ? items.find(item => item.id === record.parent_work_item_id)
          : null;

        return (
          <div style={{ textAlign: 'left' }}>
            <div>{record.work_name || record.material_name}</div>
            {isMaterial && parentWork && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                <LinkOutlined style={{ marginRight: 4 }} />
                {parentWork.work_name}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>К перв</div>,
      dataIndex: 'conversion_coefficient',
      key: 'conversion',
      width: 70,
      align: 'center',
      render: (value: number) => value?.toFixed(3) || '-',
    },
    {
      title: <div style={{ textAlign: 'center' }}>К расх</div>,
      dataIndex: 'consumption_coefficient',
      key: 'consumption',
      width: 70,
      align: 'center',
      render: (value: number) => value?.toFixed(4) || '-',
    },
    {
      title: <div style={{ textAlign: 'center' }}>Кол-во</div>,
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center',
      render: (value: number, record: BoqItemFull) => {
        const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(record.boq_item_type);
        const displayValue = value?.toFixed(2) || '-';

        if (isMaterial && value) {
          let tooltipTitle = '';
          if (record.parent_work_item_id) {
            // Материал привязан к работе
            const parentWork = items.find(item => item.id === record.parent_work_item_id);
            const workQty = parentWork?.quantity || 0;
            const convCoef = record.conversion_coefficient || 1;
            const consCoef = record.consumption_coefficient || 1;
            tooltipTitle = `Кол-во = ${workQty.toFixed(2)} (кол-во работы) × ${convCoef.toFixed(3)} (К перв) × ${consCoef.toFixed(4)} (К расх) = ${displayValue}`;
          } else if (record.base_quantity) {
            // Материал не привязан к работе
            const baseQty = record.base_quantity;
            const consCoef = record.consumption_coefficient || 1;
            tooltipTitle = `Кол-во = ${baseQty.toFixed(2)} (базовое кол-во) × ${consCoef.toFixed(4)} (К расх) = ${displayValue}`;
          }

          return (
            <Tooltip title={tooltipTitle}>
              <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>{displayValue}</span>
            </Tooltip>
          );
        }

        return displayValue;
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Ед.изм.</div>,
      dataIndex: 'unit_code',
      key: 'unit',
      width: 70,
      align: 'center',
    },
    {
      title: <div style={{ textAlign: 'center' }}>Цена за ед.</div>,
      key: 'price',
      width: 100,
      align: 'center',
      render: (_: any, record: BoqItemFull) => {
        const symbol = currencySymbols[record.currency_type || 'RUB'];
        return record.unit_rate
          ? `${record.unit_rate.toLocaleString('ru-RU')} ${symbol}`
          : '-';
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Доставка</div>,
      key: 'delivery',
      width: 110,
      align: 'center',
      render: (_: any, record: BoqItemFull) => getDeliveryText(record),
    },
    {
      title: <div style={{ textAlign: 'center' }}>Итого</div>,
      key: 'total',
      width: 100,
      align: 'center',
      render: (_: any, record: BoqItemFull) => {
        const total = calculateTotal(record);
        const displayValue = total > 0 ? `${total.toLocaleString('ru-RU')}` : '-';

        if (total > 0) {
          const qty = record.quantity || 0;
          const price = record.unit_rate || 0;
          const rate = getCurrencyRate(record.currency_type || 'RUB');

          const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(record.boq_item_type);
          let tooltipTitle = '';

          if (isMaterial) {
            let deliveryPrice = 0;
            if (record.delivery_price_type === 'не в цене') {
              deliveryPrice = price * rate * 0.03;
            } else if (record.delivery_price_type === 'суммой') {
              deliveryPrice = record.delivery_amount || 0;
            }

            tooltipTitle = `${total.toFixed(2)} = ${qty.toFixed(2)} × (${price.toFixed(2)} * ${rate.toFixed(2)} + ${deliveryPrice.toFixed(2)})`;
          } else {
            // Для работ
            tooltipTitle = `${total.toFixed(2)} = ${qty.toFixed(2)} × (${price.toFixed(2)} * ${rate.toFixed(2)} + 0)`;
          }

          return (
            <Tooltip title={tooltipTitle}>
              <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>{displayValue}</span>
            </Tooltip>
          );
        }

        return displayValue;
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Затрата на стр-во</div>,
      key: 'cost_category',
      width: 150,
      align: 'center',
      render: (_: any, record: BoqItemFull) => record.detail_cost_category_full || '-',
    },
    {
      title: <div style={{ textAlign: 'center' }}>Ссылка на КП</div>,
      dataIndex: 'quote_link',
      key: 'quote_link',
      width: 100,
      align: 'center',
      render: (value: string) => value || '-',
    },
    {
      title: <div style={{ textAlign: 'center' }}>Примечание</div>,
      dataIndex: 'description',
      key: 'description',
      width: 120,
      align: 'center',
      render: (value: string) => value || '-',
    },
    {
      title: <div style={{ textAlign: 'center' }}>Действия</div>,
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_: any, record: BoqItemFull) => {
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              disabled={expandedRowKeys.length > 0 && !expandedRowKeys.includes(record.id)}
            />
            <Popconfirm
              title="Удалить элемент?"
              onConfirm={() => handleDelete(record.id)}
              okText="Да"
              cancelText="Нет"
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  if (!position) {
    return <div>Загрузка...</div>;
  }

  return (
    <div style={{ padding: '0 8px' }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                const tenderId = searchParams.get('tenderId');
                const positionId = searchParams.get('positionId');
                if (tenderId && positionId) {
                  navigate(`/positions?tenderId=${tenderId}&positionId=${positionId}`);
                } else {
                  navigate('/positions');
                }
              }}
            >
              Назад
            </Button>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {position.position_number}. {position.work_name}
              </Title>
              <Space style={{ marginTop: 8 }}>
                <Text type="secondary">
                  Кол-во заказчика: <Text strong>{position.volume?.toFixed(2) || '-'}</Text> {position.unit_code}
                </Text>
                <Text type="secondary">|</Text>
                <Text type="secondary">
                  Кол-во ГП: <Text strong>{position.manual_volume?.toFixed(2) || '-'}</Text> {position.unit_code}
                </Text>
                <Text type="secondary">|</Text>
                <Text type="secondary">
                  Итого: <Text strong>{items.reduce((sum, item) => sum + calculateTotal(item), 0).toLocaleString('ru-RU')}</Text> ₽
                </Text>
                <Text type="secondary">|</Text>
                <Text type="secondary">
                  <Text strong>
                    Р {items.filter(item => ['раб', 'суб-раб', 'раб-комп.'].includes(item.boq_item_type)).length},
                    М {items.filter(item => ['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type)).length}
                  </Text>
                </Text>
              </Space>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Добавление работ и материалов" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <AutoComplete
            style={{ flex: 1 }}
            placeholder="Введите работу (2+ символа)..."
            options={works
              .filter(w =>
                workSearchText.length >= 2 &&
                w.work_name.toLowerCase().includes(workSearchText.toLowerCase())
              )
              .map(w => ({
                value: w.work_name_id,
                label: w.work_name,
              }))
            }
            value={workSearchText}
            onSelect={(value) => {
              handleAddWork(value);
            }}
            onChange={(value) => {
              setWorkSearchText(value);
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#10b981' }}
            disabled={!workSearchText || works.filter(w =>
              w.work_name.toLowerCase().includes(workSearchText.toLowerCase())
            ).length === 0}
            onClick={() => {
              const work = works.find(w =>
                w.work_name.toLowerCase().includes(workSearchText.toLowerCase())
              );
              if (work) {
                handleAddWork(work.work_name_id);
              }
            }}
          />

          <AutoComplete
            style={{ flex: 1 }}
            placeholder="Введите материал (2+ символа)..."
            options={materials
              .filter(m =>
                materialSearchText.length >= 2 &&
                m.material_name.toLowerCase().includes(materialSearchText.toLowerCase())
              )
              .map(m => ({
                value: m.material_name_id,
                label: m.material_name,
              }))
            }
            value={materialSearchText}
            onSelect={(value) => {
              handleAddMaterial(value);
            }}
            onChange={(value) => {
              setMaterialSearchText(value);
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#10b981' }}
            disabled={!materialSearchText || materials.filter(m =>
              m.material_name.toLowerCase().includes(materialSearchText.toLowerCase())
            ).length === 0}
            onClick={() => {
              const material = materials.find(m =>
                m.material_name.toLowerCase().includes(materialSearchText.toLowerCase())
              );
              if (material) {
                handleAddMaterial(material.material_name_id);
              }
            }}
          />
        </div>
      </Card>

      <Card title="Элементы позиции">
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          rowClassName={getRowClassName}
          loading={loading}
          pagination={false}
          scroll={{ y: 'calc(100vh - 500px)' }}
          size="small"
          summary={() => {
            const totalSum = items.reduce((sum, item) => sum + calculateTotal(item), 0);
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ backgroundColor: '#1a1a1a', fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0} colSpan={10} align="right">
                    ИТОГО:
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10} align="center">
                    {totalSum.toLocaleString('ru-RU')}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={11} colSpan={3} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
          expandable={{
            showExpandColumn: false,
            expandedRowKeys: expandedRowKeys,
            onExpand: (expanded, record) => {
              setExpandedRowKeys(expanded ? [record.id] : []);
            },
            expandedRowRender: (record: BoqItemFull) => {
              const isWork = ['раб', 'суб-раб', 'раб-комп.'].includes(record.boq_item_type);

              if (isWork) {
                return (
                  <WorkEditForm
                    record={record}
                    workNames={workNames}
                    costCategories={costCategories}
                    currencyRates={currencyRates}
                    onSave={handleFormSave}
                    onCancel={handleFormCancel}
                  />
                );
              } else {
                // Material form
                const workItems = items.filter(
                  item => item.boq_item_type === 'раб' ||
                    item.boq_item_type === 'суб-раб' ||
                    item.boq_item_type === 'раб-комп.'
                );

                return (
                  <MaterialEditForm
                    record={record}
                    materialNames={materialNames}
                    workItems={workItems}
                    costCategories={costCategories}
                    currencyRates={currencyRates}
                    onSave={handleFormSave}
                    onCancel={handleFormCancel}
                  />
                );
              }
            },
          }}
        />
      </Card>
    </div>
  );
};

// Стили для подсветки строк по типу (из Templates.tsx)
const styles = `
  .boq-row-rab {
    background-color: rgba(255, 152, 0, 0.15) !important;
  }
  .boq-row-rab:hover > td {
    background-color: rgba(255, 152, 0, 0.25) !important;
  }
  .boq-row-sub-rab {
    background-color: rgba(156, 39, 176, 0.15) !important;
  }
  .boq-row-sub-rab:hover > td {
    background-color: rgba(156, 39, 176, 0.25) !important;
  }
  .boq-row-rab-comp {
    background-color: rgba(244, 67, 54, 0.15) !important;
  }
  .boq-row-rab-comp:hover > td {
    background-color: rgba(244, 67, 54, 0.25) !important;
  }
  .boq-row-mat {
    background-color: rgba(33, 150, 243, 0.15) !important;
  }
  .boq-row-mat:hover > td {
    background-color: rgba(33, 150, 243, 0.25) !important;
  }
  .boq-row-sub-mat {
    background-color: rgba(156, 204, 101, 0.15) !important;
  }
  .boq-row-sub-mat:hover > td {
    background-color: rgba(156, 204, 101, 0.25) !important;
  }
  .boq-row-mat-comp {
    background-color: rgba(0, 137, 123, 0.15) !important;
  }
  .boq-row-mat-comp:hover > td {
    background-color: rgba(0, 137, 123, 0.25) !important;
  }
`;

// Inject styles into the document
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default PositionItems;
