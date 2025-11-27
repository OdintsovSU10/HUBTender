import { useState, useEffect } from 'react';
import { Typography, Spin, Card, Tabs, Select, Button, Row, Col, Tag } from 'antd';
import { BarChartOutlined, TableOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import dayjs from 'dayjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useFinancialData } from './hooks/useFinancialData';
import { IndicatorsCharts } from './components/IndicatorsCharts';
import { IndicatorsTable } from './components/IndicatorsTable';
import { IndicatorsFilters } from './components/IndicatorsFilters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ChartTitle,
  ChartTooltip,
  Legend,
  ArcElement,
  ChartDataLabels
);

const { Title, Text } = Typography;

const FinancialIndicators: React.FC = () => {
  const { theme: currentTheme } = useTheme();
  const {
    tenders,
    loading,
    data,
    spTotal,
    customerTotal,
    loadTenders,
    fetchFinancialIndicators,
  } = useFinancialData();

  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'table' | 'charts'>('charts');

  useEffect(() => {
    loadTenders();
  }, [loadTenders]);

  useEffect(() => {
    if (selectedTenderId) {
      fetchFinancialIndicators(selectedTenderId);
    }
  }, [selectedTenderId, fetchFinancialIndicators]);

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return '';
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getTenderTitles = () => {
    const uniqueTitles = new Map<string, { value: string; label: string }>();
    tenders.forEach(tender => {
      if (!uniqueTitles.has(tender.title)) {
        uniqueTitles.set(tender.title, {
          value: tender.title,
          label: tender.title,
        });
      }
    });
    return Array.from(uniqueTitles.values());
  };

  const getVersionsForTitle = (title: string) => {
    return tenders
      .filter(t => t.title === title)
      .map(t => ({
        value: t.version || 1,
        label: `Версия ${t.version || 1}`,
      }));
  };

  const handleTenderTitleChange = (title: string) => {
    setSelectedTenderTitle(title);
    setSelectedVersion(null);
    setSelectedTenderId(null);
  };

  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const tender = tenders.find(t => t.title === selectedTenderTitle && t.version === version);
    if (tender) {
      setSelectedTenderId(tender.id);
    }
  };

  if (!selectedTenderId) {
    return (
      <div>
        <Card bordered={false} style={{ height: '100%' }}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Title level={4} style={{ marginBottom: 24 }}>
              Финансовые показатели
            </Title>
            <Text type="secondary" style={{ fontSize: 16, marginBottom: 24, display: 'block' }}>
              Выберите тендер для просмотра показателей
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
                        style={{ width: 200, textAlign: 'center', cursor: 'pointer' }}
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
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
          onClick={() => {
            setSelectedTenderId(null);
            setSelectedTenderTitle('');
            setSelectedVersion(null);
          }}
        >
          ← Назад к выбору тендера
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Финансовые показатели
        </Title>
      </div>

      <IndicatorsFilters
        tenders={tenders}
        selectedTenderTitle={selectedTenderTitle}
        selectedVersion={selectedVersion}
        loading={loading}
        onTenderTitleChange={handleTenderTitleChange}
        onVersionChange={handleVersionChange}
        onRefresh={() => fetchFinancialIndicators(selectedTenderId)}
      />

      <Card bordered={false}>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, textAlign: 'center', color: '#ff4d4f' }}>
            Полный объём строительства
          </Title>
          {selectedTenderTitle && (
            <Title level={4} style={{ margin: '8px 0 0 0', textAlign: 'center', color: '#ff4d4f' }}>
              {selectedTenderTitle}
            </Title>
          )}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Text type="secondary">
              {dayjs().format('DD.MM.YYYY')}
            </Text>
          </div>
        </div>

        <Spin spinning={loading}>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'table' | 'charts')}
            items={[
              {
                key: 'charts',
                label: (
                  <span>
                    <BarChartOutlined style={{ marginRight: 8 }} />
                    Графики
                  </span>
                ),
                children: (
                  <IndicatorsCharts
                    data={data}
                    spTotal={spTotal}
                    formatNumber={formatNumber}
                    selectedTenderId={selectedTenderId}
                  />
                ),
              },
              {
                key: 'table',
                label: (
                  <span>
                    <TableOutlined style={{ marginRight: 8 }} />
                    Таблица
                  </span>
                ),
                children: (
                  <IndicatorsTable
                    data={data}
                    spTotal={spTotal}
                    customerTotal={customerTotal}
                    formatNumber={formatNumber}
                    currentTheme={currentTheme}
                  />
                ),
              },
            ]}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default FinancialIndicators;
