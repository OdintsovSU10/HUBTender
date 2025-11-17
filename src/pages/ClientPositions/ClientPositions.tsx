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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useSearchParams } from 'react-router-dom';
import { supabase, type Tender, type ClientPosition } from '../../lib/supabase';
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
  const [searchParams] = useSearchParams();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [clientPositions, setClientPositions] = useState<ClientPosition[]>([]);
  const [loading, setLoading] = useState(false);

  // Загрузка тендеров
  useEffect(() => {
    fetchTenders();
  }, []);

  // Обработка параметра tenderId из URL
  useEffect(() => {
    const tenderId = searchParams.get('tenderId');
    if (tenderId && tenders.length > 0) {
      const tender = tenders.find(t => t.id === tenderId);
      if (tender) {
        // Автоматически устанавливаем заказчика, тендер и версию
        setSelectedClientName(tender.client_name);
        setSelectedTender(tender);
        setSelectedTenderId(tender.id);
        setSelectedVersion(tender.version || 1);
        fetchClientPositions(tender.id);
      }
    }
  }, [searchParams, tenders]);

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
    } catch (error: any) {
      message.error('Ошибка загрузки позиций: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Получение уникальных названий заказчиков
  const getClientNames = (): TenderOption[] => {
    const uniqueClients = new Map<string, TenderOption>();

    tenders.forEach(tender => {
      if (!uniqueClients.has(tender.client_name)) {
        uniqueClients.set(tender.client_name, {
          value: tender.client_name,
          label: tender.client_name,
          clientName: tender.client_name,
        });
      }
    });

    return Array.from(uniqueClients.values());
  };

  // Получение версий для выбранного заказчика
  const getVersionsForClient = (clientName: string): { value: string; label: string; tender: Tender }[] => {
    return tenders
      .filter(tender => tender.client_name === clientName)
      .map(tender => ({
        value: tender.id,
        label: `${tender.title} (версия ${tender.version})`,
        tender,
      }));
  };

  // Обработка выбора заказчика
  const handleClientChange = (clientName: string) => {
    setSelectedClientName(clientName);
    setSelectedTender(null);
    setSelectedTenderId(null);
    setSelectedVersion(null);
    setClientPositions([]);
  };

  // Обработка выбора версии тендера
  const handleVersionChange = (tenderId: string) => {
    const tender = tenders.find(t => t.id === tenderId);
    if (tender) {
      setSelectedTender(tender);
      setSelectedTenderId(tenderId);
      setSelectedVersion(tender.version);
      fetchClientPositions(tenderId);
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
                <InputNumber
                  size="small"
                  value={record.manual_volume || undefined}
                  min={0.00001}
                  precision={5}
                  step={0.1}
                  style={{ width: '120px' }}
                  placeholder="Введите количество"
                  decimalSeparator="."
                  parser={(value) => {
                    if (!value) return 0;
                    // Обработка обоих разделителей
                    return parseFloat(value.replace(',', '.'));
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value.replace(',', '.'));
                    if (!isNaN(value) && value > 0) {
                      handleUpdatePosition(record.id, 'manual_volume', value);
                    }
                  }}
                />
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
              <Input
                size="small"
                value={record.manual_note || ''}
                placeholder="Введите примечание"
                style={{ width: '200px' }}
                onBlur={(e) => {
                  handleUpdatePosition(record.id, 'manual_note', e.target.value || null);
                }}
                onChange={(e) => {
                  // Обновляем локальное состояние для плавного ввода
                  setClientPositions(prev =>
                    prev.map(pos =>
                      pos.id === record.id ? { ...pos, manual_note: e.target.value } : pos
                    )
                  );
                }}
              />
            </div>
          </div>
        );
      },
    },
    {
      title: <div style={{ textAlign: 'center' }}>Итоговая сумма</div>,
      key: 'total',
      width: 150,
      align: 'center',
      render: (_, record) => {
        const total = (record.total_material || 0) + (record.total_works || 0);
        return (
          <Text strong style={{ fontSize: 14 }}>
            {total.toFixed(2)} {currencySymbols.RUB}
          </Text>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '0 8px' }}>
      {/* Шапка с выбором тендера */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col span={8}>
            <Text strong>Выберите заказчика:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Выберите заказчика..."
              options={getClientNames()}
              value={selectedClientName}
              onChange={handleClientChange}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Col>

          <Col span={8}>
            <Text strong>Выберите тендер и версию:</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Сначала выберите заказчика..."
              disabled={!selectedClientName}
              options={selectedClientName ? getVersionsForClient(selectedClientName) : []}
              value={selectedTenderId}
              onChange={handleVersionChange}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Col>

          {selectedTender && (
            <Col span={8}>
              <Statistic
                title="Срок до сдачи"
                value={getTimeUntilDeadline()}
                prefix={<CalendarOutlined />}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
          )}
        </Row>
      </Card>

      {/* Информация о тендере */}
      {selectedTender && (
        <Card style={{ marginBottom: 16 }}>
          <Title level={4}>{selectedTender.title} (Версия {selectedTender.version})</Title>
          <Divider style={{ margin: '12px 0' }} />

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Итоговая стоимость"
                value={getTotalCost()}
                precision={2}
                prefix={<DollarOutlined />}
                suffix={currencySymbols.RUB}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Курс USD"
                value={selectedTender.usd_rate || 0}
                precision={4}
                suffix={currencySymbols.USD}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Курс EUR"
                value={selectedTender.eur_rate || 0}
                precision={4}
                suffix={currencySymbols.EUR}
              />
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="Курс CNY"
                value={selectedTender.cny_rate || 0}
                precision={4}
                suffix={currencySymbols.CNY}
              />
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          <Row gutter={[16, 8]}>
            <Col span={24}>
              <Space wrap>
                {selectedTender.upload_folder && (
                  <Button
                    icon={<LinkOutlined />}
                    href={selectedTender.upload_folder}
                    target="_blank"
                  >
                    Папка загрузки
                  </Button>
                )}

                {selectedTender.bsm_link && (
                  <Button
                    icon={<FileTextOutlined />}
                    href={selectedTender.bsm_link}
                    target="_blank"
                  >
                    BSM
                  </Button>
                )}

                {selectedTender.tz_link && (
                  <Button
                    icon={<FileTextOutlined />}
                    href={selectedTender.tz_link}
                    target="_blank"
                  >
                    ТЗ
                  </Button>
                )}

                {selectedTender.qa_form_link && (
                  <Button
                    icon={<QuestionCircleOutlined />}
                    href={selectedTender.qa_form_link}
                    target="_blank"
                  >
                    Форма QA
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Таблица позиций заказчика */}
      {selectedTender && (
        <Card title="Позиции заказчика">
          <Table
            columns={columns}
            dataSource={clientPositions}
            rowKey="id"
            loading={loading}
            pagination={{
              defaultPageSize: 100,
              showSizeChanger: true,
              pageSizeOptions: ['100', '250', '500', '1000'],
              showTotal: (total) => `Всего позиций: ${total}`,
            }}
            scroll={{ x: 1200 }}
            size="small"
          />
        </Card>
      )}

      {!selectedTender && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">Выберите тендер для отображения позиций заказчика</Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ClientPositions;
