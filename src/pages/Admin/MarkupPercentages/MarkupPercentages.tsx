import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Form,
  Select,
  InputNumber,
  Button,
  message,
  Spin,
  Row,
  Col,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { supabase, Tender, TenderMarkupPercentageInsert, MarkupParameter, MarkupTactic } from '../../../lib/supabase';
import { parseNumberInput, formatNumberInput } from '../../../utils/numberFormat';

const { Title, Text } = Typography;

const MarkupPercentages: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [tactics, setTactics] = useState<MarkupTactic[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedTacticId, setSelectedTacticId] = useState<string | null>(null);
  const [currentMarkupId, setCurrentMarkupId] = useState<string | null>(null);
  const [markupParameters, setMarkupParameters] = useState<MarkupParameter[]>([]);
  const [loadingParameters, setLoadingParameters] = useState(false);

  // Загрузка тактики из Supabase
  const fetchTacticFromSupabase = async (tenderId?: string) => {
    try {
      let tacticId: string | null = null;

      if (tenderId) {
        const { data: tenderData, error: tenderError } = await supabase
          .from('tenders')
          .select('markup_tactic_id')
          .eq('id', tenderId)
          .single();

        if (tenderError) {
          console.error('Ошибка загрузки тендера:', tenderError);
        } else if (tenderData?.markup_tactic_id) {
          tacticId = tenderData.markup_tactic_id;
        }
      }

      if (!tacticId) {
        const { data: globalTactic, error: globalError } = await supabase
          .from('markup_tactics')
          .select('id')
          .eq('name', 'Базовая схема')
          .eq('is_global', true)
          .single();

        if (globalError) {
          console.error('Ошибка загрузки глобальной тактики:', globalError);
          return null;
        }

        tacticId = globalTactic?.id || null;
      }

      return tacticId;
    } catch (error) {
      console.error('Ошибка при загрузке тактики:', error);
      return null;
    }
  };

  // Загрузка параметров наценок
  const fetchMarkupParameters = async () => {
    setLoadingParameters(true);
    try {
      const { data, error } = await supabase
        .from('markup_parameters')
        .select('*')
        .eq('is_active', true)
        .order('order_num', { ascending: true });

      if (error) throw error;

      if (data) {
        setMarkupParameters(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки параметров наценок:', error);
      message.error('Не удалось загрузить параметры наценок');
    } finally {
      setLoadingParameters(false);
    }
  };

  // Загрузка списка тендеров
  const fetchTenders = async () => {
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);
    } catch (error) {
      console.error('Ошибка загрузки тендеров:', error);
      message.error('Не удалось загрузить список тендеров');
    }
  };

  // Загрузка списка тактик
  const fetchTactics = async () => {
    try {
      const { data, error } = await supabase
        .from('markup_tactics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTactics(data || []);
    } catch (error) {
      console.error('Ошибка загрузки тактик:', error);
      message.error('Не удалось загрузить список тактик');
    }
  };

  // Загрузка данных наценок для выбранного тендера
  const fetchMarkupData = async (tenderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tender_markup_percentage')
        .select('*, markup_parameter:markup_parameters(*)')
        .eq('tender_id', tenderId);

      if (error) throw error;

      const markupValues: Record<string, number> = {};
      markupParameters.forEach((param) => {
        markupValues[param.key] = param.default_value || 0;
      });

      if (data && data.length > 0) {
        data.forEach((record: any) => {
          if (record.markup_parameter) {
            markupValues[record.markup_parameter.key] = record.value || 0;
          }
        });
        setCurrentMarkupId(tenderId);
      } else {
        setCurrentMarkupId(null);
      }

      form.setFieldsValue({
        tender_id: tenderId,
        ...markupValues,
      });
    } catch (error) {
      console.error('Ошибка загрузки данных наценок:', error);
      message.error('Не удалось загрузить данные наценок');
    } finally {
      setLoading(false);
    }
  };

  // Обработка выбора тендера
  const handleTenderChange = async (tenderId: string) => {
    setSelectedTenderId(tenderId);

    const tacticId = await fetchTacticFromSupabase(tenderId);
    if (tacticId) {
      setSelectedTacticId(tacticId);
    }

    fetchMarkupData(tenderId);
  };

  // Обработка выбора тактики
  const handleTacticChange = async (tacticId: string) => {
    setSelectedTacticId(tacticId);
  };

  // Сохранение данных
  const handleSave = async () => {
    if (!selectedTenderId) {
      message.warning('Выберите тендер');
      return;
    }

    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      setSaving(true);

      if (currentMarkupId) {
        const { error: deleteError } = await supabase
          .from('tender_markup_percentage')
          .delete()
          .eq('tender_id', selectedTenderId);

        if (deleteError) throw deleteError;
      }

      const markupRecords: TenderMarkupPercentageInsert[] = markupParameters.map((param) => ({
        tender_id: selectedTenderId,
        markup_parameter_id: param.id,
        value: values[param.key] || 0,
      }));

      const { error: insertError } = await supabase
        .from('tender_markup_percentage')
        .insert(markupRecords);

      if (insertError) throw insertError;

      if (selectedTacticId) {
        const { error: updateTenderError } = await supabase
          .from('tenders')
          .update({ markup_tactic_id: selectedTacticId })
          .eq('id', selectedTenderId);

        if (updateTenderError) throw updateTenderError;
      }

      setCurrentMarkupId(selectedTenderId);
      message.success('Данные успешно обновлены');
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      message.error('Не удалось сохранить данные');
    } finally {
      setSaving(false);
    }
  };

  // Сброс формы
  const handleReset = () => {
    if (selectedTenderId) {
      fetchMarkupData(selectedTenderId);
    } else {
      form.resetFields();
    }
  };

  useEffect(() => {
    fetchTenders();
    fetchTactics();
    fetchMarkupParameters();
  }, []);

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ margin: 0 }}>
            Проценты наценок
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            Задайте значения процентов
          </Text>
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            disabled={!selectedTenderId}
          >
            Сбросить
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!selectedTenderId}
          >
            Сохранить
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading || loadingParameters}>
        {loadingParameters ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Text>Загрузка параметров наценок...</Text>
          </div>
        ) : markupParameters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Text type="danger">Параметры наценок не найдены. Проверьте базу данных.</Text>
          </div>
        ) : (
          <Form
            form={form}
            layout="horizontal"
            labelCol={{ style: { width: '250px', textAlign: 'left' } }}
            wrapperCol={{ style: { flex: 1 } }}
            initialValues={{
              ...markupParameters.reduce((acc, param) => ({
                ...acc,
                [param.key]: param.default_value || 0
              }), {}),
              tender_id: undefined
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <Form.Item
                label="Тендер"
                name="tender_id"
                rules={[{ required: true, message: 'Выберите тендер' }]}
                style={{ marginBottom: '12px' }}
              >
                <Select
                  placeholder="Выберите тендер"
                  onChange={handleTenderChange}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={tenders.map(tender => ({
                    label: tender.title,
                    value: tender.id,
                  }))}
                  style={{ width: '250px' }}
                />
              </Form.Item>
              <Form.Item
                label="Порядок расчета"
                style={{ marginBottom: 0 }}
              >
                <Select
                  placeholder="Выберите порядок расчета"
                  value={selectedTacticId}
                  onChange={handleTacticChange}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={tactics.map(tactic => ({
                    label: tactic.name || 'Без названия',
                    value: tactic.id,
                  }))}
                  style={{ width: '250px' }}
                />
              </Form.Item>
            </div>

            <Row gutter={[16, 0]}>
              {markupParameters.map((param, index) => (
                <Col span={24} key={param.id}>
                  <Form.Item
                    label={`${index + 1}. ${param.label}`}
                    name={param.key}
                    style={{ marginBottom: '4px' }}
                  >
                    <InputNumber
                      min={0}
                      max={999.99}
                      step={0.01}
                      addonAfter="%"
                      style={{ width: '120px' }}
                      precision={2}
                      parser={parseNumberInput}
                      formatter={formatNumberInput}
                    />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        )}
      </Spin>
    </Card>
  );
};

export default MarkupPercentages;
