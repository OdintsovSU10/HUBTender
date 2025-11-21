/**
 * Страница "Коммерция" - отображение коммерческих стоимостей позиций заказчика
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Select,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  message,
  Spin,
  Empty,
  Tooltip,
  Tag,
  Modal
} from 'antd';
import {
  ReloadOutlined,
  CalculatorOutlined,
  DollarOutlined,
  FileExcelOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { supabase } from '../../lib/supabase';
import type { Tender, ClientPosition } from '../../lib/supabase';
import { applyTacticToTender } from '../../services/markupTacticService';
import { formatCommercialCost } from '../../utils/markupCalculator';
import { checkCommercialData } from '../../utils/checkCommercialData';
import { initializeTestMarkup } from '../../utils/initializeTestMarkup';
import { debugCommercialCalculation } from '../../utils/debugCommercialCalculation';
import { checkDatabaseStructure } from '../../utils/checkDatabaseStructure';
import { verifyCoefficients } from '../../utils/verifyCoefficients';
import { showGlobalTactic } from '../../utils/showGlobalTactic';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

interface PositionWithCommercialCost extends ClientPosition {
  commercial_total?: number;
  base_total?: number;
  markup_percentage?: number;
  items_count?: number;
  material_cost_total?: number;
  work_cost_total?: number;
}

interface MarkupTactic {
  id: string;
  name: string;
  is_global: boolean;
  created_at: string;
  sequences?: any;
  base_costs?: any;
}

interface TenderOption {
  value: string;
  label: string;
  clientName: string;
}

export default function Commerce() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string | undefined>();
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionWithCommercialCost[]>([]);
  const [markupTactics, setMarkupTactics] = useState<MarkupTactic[]>([]);
  const [selectedTacticId, setSelectedTacticId] = useState<string | undefined>();
  const [tacticChanged, setTacticChanged] = useState(false);

  // Загрузка списка тендеров и тактик
  useEffect(() => {
    loadTenders();
    loadMarkupTactics();
    // В dev режиме проверяем структуру БД при первой загрузке
    if (process.env.NODE_ENV === 'development') {
      checkDatabaseStructure();
    }
  }, []);

  // Загрузка позиций при выборе тендера
  useEffect(() => {
    if (selectedTenderId) {
      loadPositions(selectedTenderId);
      // Установить тактику из тендера
      const tender = tenders.find(t => t.id === selectedTenderId);
      if (tender?.markup_tactic_id) {
        setSelectedTacticId(tender.markup_tactic_id);
        setTacticChanged(false);
      } else {
        setSelectedTacticId(undefined);
      }
    } else {
      setPositions([]);
    }
  }, [selectedTenderId, tenders]);

  const loadTenders = async () => {
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);

      // НЕ выбираем автоматически первый тендер - пользователь должен выбрать
    } catch (error) {
      console.error('Ошибка загрузки тендеров:', error);
      message.error('Не удалось загрузить список тендеров');
    }
  };

  const loadMarkupTactics = async () => {
    try {
      const { data, error } = await supabase
        .from('markup_tactics')
        .select('*')
        .order('is_global', { ascending: false })
        .order('name');

      if (error) throw error;
      setMarkupTactics(data || []);
    } catch (error) {
      console.error('Ошибка загрузки тактик наценок:', error);
      message.error('Не удалось загрузить список тактик');
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
    setSelectedTenderId(undefined);
    setSelectedVersion(null);
    setPositions([]);
  };

  // Обработка выбора версии тендера
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const tender = tenders.find(t => t.title === selectedTenderTitle && t.version === version);
    if (tender) {
      setSelectedTenderId(tender.id);
    }
  };

  const loadPositions = async (tenderId: string) => {
    setLoading(true);

    // Диагностика данных (только в dev режиме)
    if (process.env.NODE_ENV === 'development') {
      checkCommercialData(tenderId);
    }

    try {
      console.log('🔄 Загрузка позиций для тендера:', tenderId);
      const startTime = Date.now();

      // Загружаем позиции заказчика
      const { data: clientPositions, error: posError } = await supabase
        .from('client_positions')
        .select('*')
        .eq('tender_id', tenderId)
        .order('position_number');

      if (posError) throw posError;
      console.log(`📋 Загружено позиций: ${clientPositions?.length || 0}`);

      // ОПТИМИЗАЦИЯ: Загружаем ВСЕ BOQ элементы для тендера ОДНИМ запросом
      const { data: allBoqItems, error: itemsError } = await supabase
        .from('boq_items')
        .select('client_position_id, total_amount, total_commercial_material_cost, total_commercial_work_cost')
        .eq('tender_id', tenderId);

      if (itemsError) {
        console.error('Ошибка загрузки элементов:', itemsError);
        throw itemsError;
      }

      console.log(`📝 Загружено BOQ элементов: ${allBoqItems?.length || 0}`);

      // Группируем элементы по позициям в памяти
      const itemsByPosition = new Map<string, typeof allBoqItems>();
      for (const item of allBoqItems || []) {
        if (!itemsByPosition.has(item.client_position_id)) {
          itemsByPosition.set(item.client_position_id, []);
        }
        itemsByPosition.get(item.client_position_id)!.push(item);
      }

      // Обрабатываем позиции с уже загруженными данными
      const positionsWithCosts = (clientPositions || []).map((position) => {
        const boqItems = itemsByPosition.get(position.id) || [];

        // Суммируем стоимости
        let baseTotal = 0;
        let commercialTotal = 0;
        let materialCostTotal = 0;
        let workCostTotal = 0;
        let itemsCount = 0;

        for (const item of boqItems) {
          const itemBase = item.total_amount || 0;
          const itemMaterial = item.total_commercial_material_cost || 0;
          const itemWork = item.total_commercial_work_cost || 0;
          const itemCommercial = itemMaterial + itemWork;

          baseTotal += itemBase;
          commercialTotal += itemCommercial;
          materialCostTotal += itemMaterial;
          workCostTotal += itemWork;
          itemsCount++;
        }

        // Рассчитываем коэффициент наценки
        const markupCoefficient = baseTotal > 0
          ? commercialTotal / baseTotal
          : 1;

        return {
          ...position,
          base_total: baseTotal,
          commercial_total: commercialTotal,
          material_cost_total: materialCostTotal,
          work_cost_total: workCostTotal,
          markup_percentage: markupCoefficient,
          items_count: itemsCount
        } as PositionWithCommercialCost;
      });

      const loadTime = Date.now() - startTime;
      console.log(`✅ Данные загружены за ${loadTime}ms`);

      setPositions(positionsWithCosts);
    } catch (error) {
      console.error('Ошибка загрузки позиций:', error);
      message.error('Не удалось загрузить позиции заказчика');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!selectedTenderId) {
      message.warning('Выберите тендер для пересчета');
      return;
    }

    setCalculating(true);
    try {
      const result = await applyTacticToTender(selectedTenderId);

      if (result.success) {
        message.success(`Пересчитано элементов: ${result.updatedCount}`);
        // Перезагружаем позиции после пересчета
        await loadPositions(selectedTenderId);
      } else {
        message.error('Ошибка при пересчете: ' + (result.errors?.join(', ') || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Ошибка пересчета:', error);
      message.error('Не удалось выполнить пересчет');
    } finally {
      setCalculating(false);
    }
  };

  const handleInitializeTestData = async () => {
    if (!selectedTenderId) {
      message.warning('Выберите тендер для инициализации');
      return;
    }

    try {
      const tacticId = await initializeTestMarkup(selectedTenderId);
      if (tacticId) {
        message.success('Тестовые данные инициализированы');
        // Перезагружаем тендеры и позиции
        await loadTenders();
        await loadPositions(selectedTenderId);
      }
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      message.error('Не удалось инициализировать тестовые данные');
    }
  };

  const handleTacticChange = (tacticId: string) => {
    setSelectedTacticId(tacticId);
    // Проверяем, изменилась ли тактика относительно сохраненной в тендере
    const tender = tenders.find(t => t.id === selectedTenderId);
    setTacticChanged(tacticId !== tender?.markup_tactic_id);
  };

  const handleApplyTactic = async () => {
    if (!selectedTenderId || !selectedTacticId) {
      message.warning('Выберите тендер и тактику');
      return;
    }

    Modal.confirm({
      title: 'Применить новую тактику?',
      content: (
        <div>
          <p>Это действие:</p>
          <ul>
            <li>Изменит тактику наценок для тендера</li>
            <li>Пересчитает все коммерческие стоимости</li>
            <li>Перезапишет существующие расчеты</li>
          </ul>
        </div>
      ),
      okText: 'Применить',
      cancelText: 'Отмена',
      onOk: async () => {
        setCalculating(true);
        try {
          // Обновляем тактику в тендере
          const { error: updateError } = await supabase
            .from('tenders')
            .update({ markup_tactic_id: selectedTacticId })
            .eq('id', selectedTenderId);

          if (updateError) throw updateError;

          // Пересчитываем с новой тактикой
          const result = await applyTacticToTender(selectedTenderId);

          if (result.success) {
            message.success('Тактика применена и выполнен пересчет');
            setTacticChanged(false);
            // Перезагружаем тендеры и позиции
            await loadTenders();
            await loadPositions(selectedTenderId);
          } else {
            message.error('Ошибка при пересчете: ' + (result.errors?.join(', ') || 'Неизвестная ошибка'));
          }
        } catch (error) {
          console.error('Ошибка применения тактики:', error);
          message.error('Не удалось применить тактику');
        } finally {
          setCalculating(false);
        }
      }
    });
  };

  const handleExportToExcel = () => {
    if (positions.length === 0) {
      message.warning('Нет данных для экспорта');
      return;
    }

    const selectedTender = tenders.find(t => t.id === selectedTenderId);

    // Подготавливаем данные для экспорта
    const exportData = positions.map(pos => ({
      'Номер позиции': pos.position_number,
      'Название': pos.work_name,
      'Примечание клиента': pos.client_note || '',
      'Единица': pos.unit_code || '',
      'Количество (ГП)': pos.manual_volume || 0,
      'Кол-во элементов': pos.items_count || 0,
      'Базовая стоимость': pos.base_total || 0,
      'Коммерческая стоимость': pos.commercial_total || 0,
      'Коэффициент': pos.markup_percentage?.toFixed(4) || '1.0000',
      'За единицу (база)': pos.manual_volume && pos.manual_volume > 0 ? (pos.base_total || 0) / pos.manual_volume : 0,
      'За единицу (коммерч.)': pos.manual_volume && pos.manual_volume > 0 ? (pos.commercial_total || 0) / pos.manual_volume : 0,
      'За единицу материалов': pos.manual_volume && pos.manual_volume > 0 ? (pos.material_cost_total || 0) / pos.manual_volume : 0,
      'За единицу работ': pos.manual_volume && pos.manual_volume > 0 ? (pos.work_cost_total || 0) / pos.manual_volume : 0,
    }));

    // Добавляем итоговую строку
    const totalBase = positions.reduce((sum, pos) => sum + (pos.base_total || 0), 0);
    const totalCommercial = positions.reduce((sum, pos) => sum + (pos.commercial_total || 0), 0);
    const avgMarkup = totalBase > 0 ? ((totalCommercial - totalBase) / totalBase) * 100 : 0;

    exportData.push({
      'Номер позиции': 0,
      'Название': 'ИТОГО',
      'Примечание клиента': '',
      'Единица': '',
      'Количество (ГП)': positions.reduce((sum, pos) => sum + (pos.manual_volume || 0), 0),
      'Кол-во элементов': positions.reduce((sum, pos) => sum + (pos.items_count || 0), 0),
      'Базовая стоимость': totalBase,
      'Коммерческая стоимость': totalCommercial,
      'Наценка, %': avgMarkup.toFixed(2),
      'За единицу (база)': 0,
      'За единицу (коммерч.)': 0,
      'За единицу материалов': 0,
      'За единицу работ': 0,
    });

    // Создаем книгу Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Коммерческие стоимости');

    // Устанавливаем ширину колонок
    ws['!cols'] = [
      { wch: 15 }, // Номер позиции
      { wch: 30 }, // Название
      { wch: 40 }, // Описание
      { wch: 10 }, // Единица
      { wch: 12 }, // Количество
      { wch: 15 }, // Кол-во элементов
      { wch: 18 }, // Базовая стоимость
      { wch: 20 }, // Коммерческая стоимость
      { wch: 12 }, // Наценка, %
      { wch: 18 }, // За единицу (база)
      { wch: 20 }, // За единицу (коммерч.)
    ];

    // Сохраняем файл
    const fileName = `Коммерция_${selectedTender?.tender_number || 'тендер'}_${new Date().toLocaleDateString('ru-RU')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    message.success(`Данные экспортированы в файл ${fileName}`);
  };

  // Рассчитываем итоговые суммы
  const totals = useMemo(() => {
    const baseTotal = positions.reduce((sum, pos) => sum + (pos.base_total || 0), 0);
    const commercialTotal = positions.reduce((sum, pos) => sum + (pos.commercial_total || 0), 0);
    const difference = commercialTotal - baseTotal;
    const markupPercentage = baseTotal > 0 ? (difference / baseTotal) * 100 : 0;

    return {
      base: baseTotal,
      commercial: commercialTotal,
      difference,
      markupPercentage
    };
  }, [positions]);

  // Определение конечной позиции (листового узла) на основе иерархии
  const isLeafPosition = (record: PositionWithCommercialCost, index: number): boolean => {
    // Последняя строка всегда конечная
    if (index === positions.length - 1) {
      return true;
    }

    const currentLevel = record.hierarchy_level || 0;
    const nextLevel = positions[index + 1]?.hierarchy_level || 0;

    // Если текущий уровень >= следующего, значит это листовой узел
    return currentLevel >= nextLevel;
  };

  const columns: ColumnsType<PositionWithCommercialCost> = [
    {
      title: 'Наименование',
      key: 'work_name',
      width: 350,
      render: (_, record, index) => {
        // Определяем, является ли позиция конечной (на основе иерархии)
        const isLeaf = isLeafPosition(record, index);
        const sectionColor = isLeaf ? '#52c41a' : '#ff7875'; // Зеленый для конечных, красноватый для разделов

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: isLeaf ? 'pointer' : 'default',
              whiteSpace: 'normal',
              wordBreak: 'break-word'
            }}
            onClick={() => {
              if (isLeaf && selectedTenderId) {
                navigate(`/positions/${record.id}/items?tenderId=${selectedTenderId}&positionId=${record.id}`);
              }
            }}
          >
            {record.item_no && (
              <Text strong style={{ color: sectionColor, marginRight: 8, flexShrink: 0 }}>
                {record.item_no}
              </Text>
            )}
            <Text style={{ textDecoration: isLeaf ? 'underline' : 'none' }}>{record.work_name}</Text>
          </div>
        );
      },
    },
    {
      title: 'Кол-во',
      key: 'volume',
      width: 100,
      render: (_, record) => (
        <div>
          <div>{record.manual_volume || 0} {record.unit_code || ''}</div>
          <div style={{ fontSize: '11px', color: '#999' }}>
            {record.items_count || 0} элем.
          </div>
        </div>
      ),
    },
    {
      title: 'Цена за единицу',
      key: 'per_unit',
      width: 150,
      align: 'right',
      render: (_, record) => {
        if (!record.manual_volume || record.manual_volume === 0) return '-';
        const perUnit = (record.commercial_total || 0) / record.manual_volume;
        return (
          <Text type="secondary">
            {formatCommercialCost(perUnit)}
          </Text>
        );
      },
    },
    {
      title: 'Цена за единицу материалов, Руб.',
      key: 'per_unit_material',
      width: 150,
      align: 'right',
      render: (_, record) => {
        if (!record.manual_volume || record.manual_volume === 0) return '-';
        const perUnitMaterial = (record.material_cost_total || 0) / record.manual_volume;
        return (
          <Text type="secondary" style={{ color: '#1890ff' }}>
            {formatCommercialCost(perUnitMaterial)}
          </Text>
        );
      },
    },
    {
      title: 'Цена за единицу работ, Руб.',
      key: 'per_unit_work',
      width: 150,
      align: 'right',
      render: (_, record) => {
        if (!record.manual_volume || record.manual_volume === 0) return '-';
        const perUnitWork = (record.work_cost_total || 0) / record.manual_volume;
        return (
          <Text type="secondary" style={{ color: '#52c41a' }}>
            {formatCommercialCost(perUnitWork)}
          </Text>
        );
      },
    },
    {
      title: 'Базовая стоимость',
      key: 'base_total',
      width: 150,
      align: 'right',
      render: (_, record) => (
        <Tooltip title="Сумма total_amount всех элементов позиции">
          <Text>{formatCommercialCost(record.base_total || 0)}</Text>
        </Tooltip>
      ),
      sorter: (a, b) => (a.base_total || 0) - (b.base_total || 0),
    },
    {
      title: 'Коммерческая стоимость',
      key: 'commercial_total',
      width: 180,
      align: 'right',
      render: (_, record) => (
        <Tooltip title="Сумма коммерческих стоимостей всех элементов">
          <Text strong style={{ color: '#52c41a' }}>
            {formatCommercialCost(record.commercial_total || 0)}
          </Text>
        </Tooltip>
      ),
      sorter: (a, b) => (a.commercial_total || 0) - (b.commercial_total || 0),
    },
    {
      title: 'Коэффициент',
      key: 'markup',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const coefficient = record.markup_percentage || 1; // Теперь это коэффициент
        const color = coefficient > 1 ? 'green' : coefficient < 1 ? 'red' : 'default';
        return (
          <Tooltip title={`Наценка: ${((coefficient - 1) * 100).toFixed(2)}%`}>
            <Tag color={color}>
              {coefficient.toFixed(4)}
            </Tag>
          </Tooltip>
        );
      },
      sorter: (a, b) => (a.markup_percentage || 0) - (b.markup_percentage || 0),
    },
    {
      title: 'Примечание ГП',
      dataIndex: 'manual_note',
      key: 'manual_note',
      width: 200,
      responsive: ['lg'],
    },
  ];

  const selectedTender = tenders.find(t => t.id === selectedTenderId);

  // Если тендер не выбран, показываем только выбор тендера
  if (!selectedTenderId) {
    return (
      <Card bordered={false} style={{ height: '100%' }}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Title level={3} style={{ marginBottom: 24 }}>
              <DollarOutlined /> Коммерция
            </Title>
            <Text type="secondary" style={{ fontSize: 16, marginBottom: 24, display: 'block' }}>
              Выберите тендер для просмотра коммерческих стоимостей
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

            {/* Быстрый выбор тендера через карточки */}
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
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="primary"
            onClick={() => {
              setSelectedTenderId(undefined);
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
            <DollarOutlined /> Коммерция
          </Title>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <Space size="middle" wrap>
              <Space size="small">
                <Text type="secondary" style={{ fontSize: 16 }}>Тендер:</Text>
                <Select
                  style={{ width: 350, fontSize: 16 }}
                  placeholder="Выберите тендер"
                  value={selectedTenderTitle}
                  onChange={handleTenderTitleChange}
                  loading={loading}
                  options={getTenderTitles()}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                />
              </Space>
              <Space size="small">
                <Text type="secondary" style={{ fontSize: 16 }}>Версия:</Text>
                <Select
                  style={{ width: 140 }}
                  placeholder="Версия"
                  value={selectedVersion}
                  onChange={handleVersionChange}
                  loading={loading}
                  disabled={!selectedTenderTitle}
                  options={selectedTenderTitle ? getVersionsForTitle(selectedTenderTitle) : []}
                />
              </Space>
              <Space size="small">
                <Text type="secondary" style={{ fontSize: 16 }}>Схема:</Text>
                <Select
                  style={{ width: 250 }}
                  placeholder="Выберите тактику наценок"
                  value={selectedTacticId}
                  onChange={handleTacticChange}
                  loading={loading}
                  disabled={!selectedTenderId}
                  options={markupTactics.map(t => ({
                    label: (
                      <span>
                        {t.name || 'Без названия'}
                        {t.is_global && <Tag color="blue" style={{ marginLeft: 8 }}>Глобальная</Tag>}
                      </span>
                    ),
                    value: t.id
                  }))}
                />
              </Space>
            </Space>
            <div>
            <Space>
              {tacticChanged && (
                <Tooltip title="Применить новую тактику к тендеру">
                  <Button
                    type="primary"
                    danger
                    onClick={handleApplyTactic}
                    loading={calculating}
                  >
                    Применить тактику
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Пересчитать коммерческие стоимости">
                <Button
                  type="primary"
                  icon={<CalculatorOutlined />}
                  onClick={handleRecalculate}
                  loading={calculating}
                  disabled={!selectedTenderId}
                >
                  Пересчитать
                </Button>
              </Tooltip>
              <Tooltip title="Экспорт в Excel">
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={handleExportToExcel}
                  disabled={positions.length === 0}
                >
                  Экспорт
                </Button>
              </Tooltip>
              <Tooltip title="Обновить данные">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => selectedTenderId && loadPositions(selectedTenderId)}
                  loading={loading}
                />
              </Tooltip>
            </Space>
            </div>
          </div>
        </Space>
      }
    >
          {/* Таблица позиций */}
          {selectedTenderId ? (
            <Spin spinning={loading || calculating}>
              <Table
                columns={columns}
                dataSource={positions}
                rowKey="id"
                size="small"
                locale={{
                  emptyText: <Empty description="Нет позиций заказчика" />
                }}
                pagination={false}
                scroll={{ y: 'calc(100vh - 320px)' }}
                summary={() => {
                  const totalBase = positions.reduce((sum, pos) => sum + (pos.base_total || 0), 0);
                  const totalCommercial = positions.reduce((sum, pos) => sum + (pos.commercial_total || 0), 0);

                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Text strong>Итого:</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong>{formatCommercialCost(totalBase)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong style={{ color: '#52c41a' }}>
                            {formatCommercialCost(totalCommercial)}
                          </Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} colSpan={3} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </Spin>
          ) : (
            <Empty description="Выберите тендер для просмотра коммерческих стоимостей" />
          )}
    </Card>
  );
}