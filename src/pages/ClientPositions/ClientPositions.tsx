import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Space,
  Tag,
  Divider,
  Button,
  message,
  Input,
  InputNumber,
} from 'antd';
import {
  CalendarOutlined,
  DollarOutlined,
  LinkOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  ArrowLeftOutlined,
  DashboardOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { supabase, type Tender, type ClientPosition } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

const { Title, Text, Link } = Typography;

interface TenderOption {
  value: string;
  label: string;
  clientName: string;
}

const currencySymbols: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  CNY: '¥',
};

const ClientPositions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme: currentTheme } = useTheme();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [clientPositions, setClientPositions] = useState<ClientPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrollToPositionId, setScrollToPositionId] = useState<string | null>(null);
  const [positionCounts, setPositionCounts] = useState<Record<string, { works: number; materials: number }>>({});

  // Загрузка тендеров
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

  // Восстановление состояния из URL при возврате
  useEffect(() => {
    if (tenders.length > 0) {
      const tenderId = searchParams.get('tenderId');
      const positionId = searchParams.get('positionId');

      if (tenderId) {
        const tender = tenders.find(t => t.id === tenderId);
        if (tender) {
          setSelectedTender(tender);
          setSelectedTenderId(tender.id);
          setSelectedTenderTitle(tender.title);
          setSelectedVersion(tender.version || 1);
          fetchClientPositions(tender.id);

          if (positionId) {
            setScrollToPositionId(positionId);
          }
        }
      }
    }
  }, [tenders, searchParams]);

  // Загрузка позиций заказчика
  const fetchClientPositions = async (tenderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_positions')
        .select('*')
        .eq('tender_id', tenderId)
        .order('position_number', { ascending: true });

      if (error) throw error;
      setClientPositions(data || []);

      // Загружаем счетчики работ и материалов для каждой позиции
      if (data && data.length > 0) {
        await fetchPositionCounts(data.map(p => p.id));
      }
    } catch (error: any) {
      message.error('Ошибка загрузки позиций: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка количества работ и материалов для позиций
  const fetchPositionCounts = async (positionIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('boq_items')
        .select('client_position_id, boq_item_type')
        .in('client_position_id', positionIds);

      if (error) throw error;

      // Подсчитываем количество работ и материалов для каждой позиции
      const counts: Record<string, { works: number; materials: number }> = {};

      (data || []).forEach((item) => {
        if (!counts[item.client_position_id]) {
          counts[item.client_position_id] = { works: 0, materials: 0 };
        }

        if (['раб', 'суб-раб', 'раб-комп.'].includes(item.boq_item_type)) {
          counts[item.client_position_id].works += 1;
        } else if (['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type)) {
          counts[item.client_position_id].materials += 1;
        }
      });

      setPositionCounts(counts);
    } catch (error: any) {
      console.error('Ошибка загрузки счетчиков:', error);
    }
  };

  // Прокрутка к позиции после загрузки данных
  useEffect(() => {
    if (scrollToPositionId && clientPositions.length > 0 && !loading) {
      // Увеличиваем задержку для обеспечения полной загрузки таблицы
      setTimeout(() => {
        // Пытаемся найти элемент по data-row-key
        let element = document.querySelector(`[data-row-key="${scrollToPositionId}"]`) as HTMLElement;

        // Если не найден, пытаемся найти по классу (альтернативный способ)
        if (!element) {
          const allRows = document.querySelectorAll('.ant-table-row');
          element = Array.from(allRows).find(
            (row) => (row as HTMLElement).getAttribute('data-row-key') === scrollToPositionId
          ) as HTMLElement;
        }

        if (element) {
          // Прокручиваем к элементу
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Убираем подсветку и очищаем параметры URL через 2 секунды
          setTimeout(() => {
            setScrollToPositionId(null);
            setSearchParams({});
          }, 2000);
        } else {
          console.warn('Не удалось найти строку с id:', scrollToPositionId);
          // Всё равно очищаем состояние
          setTimeout(() => {
            setScrollToPositionId(null);
            setSearchParams({});
          }, 1000);
        }
      }, 500); // Увеличили задержку с 300 до 500мс
    }
  }, [scrollToPositionId, clientPositions, loading]);

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
      .sort((a, b) => b.value - a.value); // Сортировка по убыванию версий
  };

  // Обработка выбора наименования тендера
  const handleTenderTitleChange = (title: string) => {
    setSelectedTenderTitle(title);
    setSelectedTender(null);
    setSelectedTenderId(null);
    setSelectedVersion(null);
    setClientPositions([]);
  };

  // Обработка выбора версии тендера
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const tender = tenders.find(t => t.title === selectedTenderTitle && t.version === version);
    if (tender) {
      setSelectedTender(tender);
      setSelectedTenderId(tender.id);
      fetchClientPositions(tender.id);
    }
  };

  // Расчет времени до срока сдачи
  const getTimeUntilDeadline = (): string => {
    if (!selectedTender?.submission_deadline) return '-';

    const deadline = dayjs(selectedTender.submission_deadline);
    const now = dayjs();
    const diff = deadline.diff(now);

    if (diff < 0) {
      return 'Срок истек';
    }

    const dur = dayjs.duration(diff);
    const days = Math.floor(dur.asDays());
    const hours = dur.hours();
    const minutes = dur.minutes();

    if (days > 0) {
      return `${days} дн. ${hours} ч.`;
    } else if (hours > 0) {
      return `${hours} ч. ${minutes} мин.`;
    } else {
      return `${minutes} мин.`;
    }
  };

  // Расчет итоговой стоимости (сумма всех позиций)
  const getTotalCost = (): number => {
    return clientPositions.reduce((sum, position) => {
      return sum + (position.total_material || 0) + (position.total_works || 0);
    }, 0);
  };

  // Определение конечной строки (листового узла)
  const isLeafPosition = (index: number): boolean => {
    // Последняя строка всегда конечная
    if (index === clientPositions.length - 1) {
      return true;
    }

    const currentLevel = clientPositions[index].hierarchy_level || 0;
    const nextLevel = clientPositions[index + 1]?.hierarchy_level || 0;

    // Если текущий уровень >= следующего, значит это листовой узел
    return currentLevel >= nextLevel;
  };

  // Обновление позиции в БД
  const handleUpdatePosition = async (
    positionId: string,
    field: 'manual_volume' | 'manual_note',
    value: number | string | null
  ) => {
    try {
      // Валидация для количества
      if (field === 'manual_volume') {
        if (value === null || value === '') {
          message.error('Количество ГП обязательно для заполнения');
          return;
        }

        const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;

        if (isNaN(numValue) || numValue <= 0) {
          message.error('Количество должно быть положительным числом');
          return;
        }

        value = numValue;
      }

      // Обновление в БД
      const { error } = await supabase
        .from('client_positions')
        .update({ [field]: value })
        .eq('id', positionId);

      if (error) throw error;

      // Обновление локального состояния
      setClientPositions(prev =>
        prev.map(pos =>
          pos.id === positionId ? { ...pos, [field]: value } : pos
        )
      );

      message.success('Данные сохранены');
    } catch (error: any) {
      console.error('Ошибка обновления позиции:', error);
      message.error('Ошибка сохранения: ' + error.message);
    }
  };

  // Колонки таблицы
  const columns: ColumnsType<ClientPosition> = [
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
        const isLeaf = isLeafPosition(index);
        const sectionColor = isLeaf ? '#52c41a' : '#ff7875'; // Зеленый для конечных, бледно-красный для неконечных

        // Если это конечная позиция (лист), оборачиваем в RouterLink для поддержки открытия в новой вкладке
        if (isLeaf && selectedTender) {
          return (
            <RouterLink
              to={`/positions/${record.id}/items?tenderId=${selectedTender.id}&positionId=${record.id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              {record.item_no && (
                <Text strong style={{ color: sectionColor, marginRight: 8 }}>
                  {record.item_no}
                </Text>
              )}
              <Text>{record.work_name}</Text>
            </RouterLink>
          );
        }

        // Для неконечных позиций просто отображаем текст
        return (
          <div>
            {record.item_no && (
              <Text strong style={{ color: sectionColor, marginRight: 8 }}>
                {record.item_no}
              </Text>
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
        const isLeaf = isLeafPosition(index);

        return (
          <div style={{ fontSize: 12 }}>
            {/* Количество ГП - показываем только для конечных строк */}
            {isLeaf && (
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">Кол-во: </Text>
                <Text>{record.manual_volume?.toFixed(2) || '-'}</Text>
              </div>
            )}

            {/* Ед.изм. - показываем только для конечных строк */}
            {isLeaf && record.unit_code && (
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary">Ед.изм.: </Text>
                <Text>{record.unit_code}</Text>
              </div>
            )}

            {/* Примечание ГП - показываем всегда */}
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
      width: 180,
      align: 'center',
      render: (_, record, index) => {
        const total = (record.total_material || 0) + (record.total_works || 0);
        const counts = positionCounts[record.id] || { works: 0, materials: 0 };
        const isLeaf = isLeafPosition(index);

        // Показываем итоги только для конечных (листовых) позиций
        if (!isLeaf) {
          return '-';
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <Text style={{ margin: 0, fontWeight: 600, fontSize: 15, color: currentTheme === 'dark' ? '#52c41a' : '#389e0d' }}>
              {Math.round(total).toLocaleString('ru-RU')}
            </Text>
            {(counts.works > 0 || counts.materials > 0) && (
              <div style={{ display: 'flex', gap: 8, fontSize: 15, fontWeight: 600 }}>
                <span style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>Р:</span>
                <span style={{ color: '#ff9800' }}>{counts.works}</span>
                <span style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>М:</span>
                <span style={{ color: '#1890ff' }}>{counts.materials}</span>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  // Если тендер не выбран, показываем экран выбора тендера
  if (!selectedTender) {
    return (
      <Card bordered={false} style={{ height: '100%' }}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Title level={3} style={{ marginBottom: 24 }}>
              Позиции заказчика
            </Title>
            <Text type="secondary" style={{ fontSize: 16, marginBottom: 24, display: 'block' }}>
              Выберите тендер для просмотра позиций
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
                          setSelectedTender(tender);
                          setSelectedTenderId(tender.id);
                          fetchClientPositions(tender.id);
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
    <div style={{ padding: 0 }}>
      {/* Блок с названием тендера, кнопками, фильтрами и информацией */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
        borderRadius: '8px',
        margin: '16px 0 0 0',
      }}>
        {/* Верхняя шапка с названием тендера и кнопками */}
        {selectedTender && (
          <div style={{
            padding: '12px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <FileTextOutlined style={{ fontSize: 32, color: 'white' }} />
              <div>
                <Title level={3} style={{ margin: 0, color: 'white' }}>
                  {selectedTender.title}
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
                  Заказчик: {selectedTender.client_name}
                </Text>
              </div>
            </div>
            <Space>
              <Button
                type="primary"
                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  setSelectedTender(null);
                  setSelectedTenderId(null);
                  setSelectedTenderTitle(null);
                  setSelectedVersion(null);
                  setClientPositions([]);
                }}
              >
                Назад к выбору
              </Button>
              <Button
                icon={<DashboardOutlined />}
                onClick={() => navigate('/dashboard')}
              >
                К дашборду
              </Button>
            </Space>
          </div>
        )}

        {/* Блок с фильтрами и информацией о тендере */}
        <div style={{
          padding: '16px',
        }}>
        <Row gutter={16}>
          {/* Левая карточка: Фильтры */}
          <Col span={7}>
            <Card
              bordered={false}
              bodyStyle={{ padding: '16px' }}
              style={{ borderRadius: '8px' }}
            >
              <Row gutter={8}>
                <Col span={16}>
                  <Text strong style={{ color: currentTheme === 'dark' ? '#fff' : '#000', fontSize: 14 }}>Тендер:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 6 }}
                    placeholder="Выберите тендер..."
                    value={selectedTenderTitle}
                    onChange={handleTenderTitleChange}
                    options={getTenderTitles()}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Col>
                <Col span={8}>
                  <Text strong style={{ color: currentTheme === 'dark' ? '#fff' : '#000', fontSize: 14 }}>Версия:</Text>
                  <Select
                    style={{ width: '100%', marginTop: 6 }}
                    placeholder="Выберите..."
                    disabled={!selectedTenderTitle}
                    value={selectedVersion}
                    onChange={handleVersionChange}
                    options={selectedTenderTitle ? getVersionsForTitle(selectedTenderTitle) : []}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Правая карточка: Информация о тендере */}
          <Col span={10} offset={7}>
            <Card
              bordered={false}
              bodyStyle={{ padding: '16px' }}
              style={{ borderRadius: '8px' }}
            >
              {selectedTender ? (
                <div style={{ textAlign: 'right' }}>
                  {/* Строка 1: Название и заказчик */}
                  <div style={{ marginBottom: 4, fontSize: 14 }}>
                    <Text strong style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>Название: </Text>
                    <Text style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>{selectedTender.title}</Text>
                    <Divider type="vertical" style={{ borderColor: currentTheme === 'dark' ? '#444' : '#d9d9d9' }} />
                    <Text strong style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>Заказчик: </Text>
                    <Text style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>{selectedTender.client_name}</Text>
                  </div>

                  {/* Строка 2: Площади */}
                  <div style={{ marginBottom: 4, fontSize: 14 }}>
                    <Text style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>Площадь по СП: </Text>
                    <Text strong style={{ color: '#10b981' }}>105 000 м²</Text>
                    <Divider type="vertical" style={{ borderColor: currentTheme === 'dark' ? '#444' : '#d9d9d9' }} />
                    <Text style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>Площадь Заказчика: </Text>
                    <Text strong style={{ color: '#10b981' }}>116 000 м²</Text>
                  </div>

                  {/* Строка 3: Курсы валют */}
                  <div style={{ marginBottom: 4, fontSize: 14 }}>
                    <Text strong style={{ color: '#10b981' }}>Курс USD: </Text>
                    <Text style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>{selectedTender.usd_rate?.toFixed(2) || '0.00'} Р/$</Text>
                    <Divider type="vertical" style={{ borderColor: currentTheme === 'dark' ? '#444' : '#d9d9d9' }} />
                    <Text strong style={{ color: '#10b981' }}>Курс EUR: </Text>
                    <Text style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>{selectedTender.eur_rate?.toFixed(2) || '0.00'} Р/€</Text>
                    <Divider type="vertical" style={{ borderColor: currentTheme === 'dark' ? '#444' : '#d9d9d9' }} />
                    <Text strong style={{ color: '#10b981' }}>Курс CNY: </Text>
                    <Text style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>{selectedTender.cny_rate?.toFixed(2) || '0.00'} Р/¥</Text>
                  </div>

                  {/* Строка 4: Кнопки */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Space wrap size="small">
                      {selectedTender.upload_folder && (
                        <Button
                          icon={<LinkOutlined />}
                          href={selectedTender.upload_folder}
                          target="_blank"
                          size="small"
                        >
                          Папка КП
                        </Button>
                      )}
                      {selectedTender.bsm_link && (
                        <Button
                          icon={<FileTextOutlined />}
                          href={selectedTender.bsm_link}
                          target="_blank"
                          size="small"
                        >
                          БСМ
                        </Button>
                      )}
                      {selectedTender.tz_link && (
                        <Button
                          icon={<FileTextOutlined />}
                          href={selectedTender.tz_link}
                          target="_blank"
                          size="small"
                        >
                          Уточнение ТЗ
                        </Button>
                      )}
                      {selectedTender.qa_form_link && (
                        <Button
                          icon={<QuestionCircleOutlined />}
                          href={selectedTender.qa_form_link}
                          target="_blank"
                          size="small"
                        >
                          Вопросы
                        </Button>
                      )}
                    </Space>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: currentTheme === 'dark' ? '#666' : '#999'
                }}>
                  <Text style={{ fontSize: 14, color: currentTheme === 'dark' ? '#666' : '#999' }}>
                    Выберите тендер для отображения данных
                  </Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>

        {/* Строка с дедлайном - шкала состояния */}
        {selectedTender && selectedTender.submission_deadline && (() => {
          const deadline = dayjs(selectedTender.submission_deadline);
          const now = dayjs();
          const isExpired = deadline.isBefore(now);

          // Вычисляем прогресс времени (предполагаем стандартный период в 30 дней)
          const totalDays = 30; // Можно настроить или использовать дату создания тендера
          const daysRemaining = deadline.diff(now, 'day', true);
          const progress = isExpired ? 100 : Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100));

          // Интерполяция цвета для шкалы от бирюзового к красному
          const getProgressColor = (progress: number): string => {
            if (isExpired) return '#c62828'; // Насыщенный красный если истек

            // Плавный переход от бирюзового (#14b8a6) к насыщенному красному (#c62828)
            const normalizedProgress = progress / 100;
            const r = Math.round(20 + (198 - 20) * normalizedProgress);
            const g = Math.round(184 + (40 - 184) * normalizedProgress);
            const b = Math.round(166 + (40 - 166) * normalizedProgress);
            return `rgb(${r}, ${g}, ${b})`;
          };

          const percentage = Math.round(100 - progress);

          return (
            <div style={{
              position: 'relative',
              marginTop: 0,
              height: 40,
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
              background: currentTheme === 'dark' ? '#0a5348' : '#ccfbf1',
            }}>
              {/* Шкала прогресса */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${progress}%`,
                background: getProgressColor(progress),
                transition: 'all 0.5s ease',
              }} />

              {/* Текст поверх шкалы */}
              <div style={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 24,
                padding: '0 32px',
                zIndex: 1,
              }}>
                <Text style={{
                  color: 'white',
                  fontWeight: 600,
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}>
                  {isExpired
                    ? `Дедлайн истек ${now.diff(deadline, 'day')} дней назад`
                    : `До дедлайна осталось ${Math.ceil(daysRemaining)} дней`
                  }
                </Text>
                <Text style={{
                  color: 'white',
                  fontWeight: 600,
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}>
                  Дедлайн: {deadline.format('DD MMMM YYYY, HH:mm')}
                </Text>
                <Text style={{
                  color: 'white',
                  fontWeight: 600,
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}>
                  {isExpired ? '0%' : `${percentage}%`}
                </Text>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Таблица позиций заказчика */}
      {selectedTender && (
        <Card bordered={false} title="Позиции заказчика" style={{ marginTop: 24 }}>
          <Table
            columns={columns}
            dataSource={clientPositions}
            rowKey="id"
            loading={loading}
            rowClassName={(record) =>
              scrollToPositionId === record.id ? 'highlight-row' : ''
            }
            onRow={(record, index) => {
              const isLeaf = isLeafPosition(index!);
              return {
                onClick: () => {
                  if (isLeaf && selectedTender) {
                    navigate(`/positions/${record.id}/items?tenderId=${selectedTender.id}&positionId=${record.id}`);
                  }
                },
                style: {
                  cursor: isLeaf ? 'pointer' : 'default',
                },
              };
            }}
            pagination={false}
            scroll={{ x: 1200, y: 'calc(100vh - 400px)' }}
            size="small"
            summary={() => {
              const totalSum = clientPositions.reduce(
                (sum, pos) => sum + (pos.total_material || 0) + (pos.total_works || 0),
                0
              );

              // Подсчет общего количества работ и материалов
              let totalWorks = 0;
              let totalMaterials = 0;
              Object.values(positionCounts).forEach(count => {
                totalWorks += count.works;
                totalMaterials += count.materials;
              });

              return (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                    <Table.Summary.Cell index={0} colSpan={4} align="right">
                      Итого:
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="center">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        <Text style={{ margin: 0, fontWeight: 600, fontSize: 15, color: currentTheme === 'dark' ? '#52c41a' : '#389e0d' }}>
                          {Math.round(totalSum).toLocaleString('ru-RU')}
                        </Text>
                        {(totalWorks > 0 || totalMaterials > 0) && (
                          <div style={{ display: 'flex', gap: 8, fontSize: 15, fontWeight: 600 }}>
                            <span style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>Р:</span>
                            <span style={{ color: '#ff9800' }}>{totalWorks}</span>
                            <span style={{ color: currentTheme === 'dark' ? '#fff' : '#000' }}>М:</span>
                            <span style={{ color: '#1890ff' }}>{totalMaterials}</span>
                          </div>
                        )}
                      </div>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Card>
      )}

    </div>
  );
};

export default ClientPositions;
