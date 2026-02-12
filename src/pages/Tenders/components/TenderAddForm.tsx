import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, AutoComplete, Select, DatePicker, Row, Col, Button, message, theme } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../../../lib/supabase';
import type { TenderStatus, ConstructionScope, TenderRegistryInsert } from '../../../lib/supabase';
import { ChronologyList, TenderPackageList } from './DynamicList';

const { useToken } = theme;

interface TenderAddFormProps {
  statuses: TenderStatus[];
  constructionScopes: ConstructionScope[];
  tenderNumbers: string[];
  onSuccess: () => void;
  onCancel: () => void;
}

export const TenderAddForm: React.FC<TenderAddFormProps> = ({
  statuses,
  constructionScopes,
  tenderNumbers,
  onSuccess,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const { token } = useToken();
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);

  useEffect(() => {
    const fetchAutocompleteData = async () => {
      const { data } = await supabase
        .from('tender_registry')
        .select('title, client_name')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        const uniqueTitles = Array.from(new Set(data.map(t => t.title).filter(Boolean)));
        const uniqueClients = Array.from(new Set(data.map(t => t.client_name).filter(Boolean)));
        setTitles(uniqueTitles);
        setClientNames(uniqueClients);
      }
    };

    fetchAutocompleteData();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Получить максимальный sort_order
      const { data: maxData } = await supabase
        .from('tender_registry')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = maxData?.[0]?.sort_order ? maxData[0].sort_order + 1 : 1;

      // Конвертировать dayjs объекты в ISO строки для chronology_items
      const chronologyItems = (values.chronology_items || []).map((item: any) => ({
        date: item.date?.toISOString() || null,
        text: item.text,
      }));

      // Конвертировать dayjs объекты в ISO строки для tender_package_items
      const tenderPackageItems = (values.tender_package_items || []).map((item: any) => ({
        date: item.date?.toISOString() || null,
        text: item.text,
      }));

      const payload: TenderRegistryInsert = {
        ...values,
        tender_number: values.tender_number || null,
        object_address: values.object_address || null,
        chronology_items: chronologyItems,
        tender_package_items: tenderPackageItems,
        sort_order: nextSortOrder,
        is_archived: false,
        submission_date: values.submission_date?.toISOString() || null,
        construction_start_date: values.construction_start_date?.toISOString() || null,
        site_visit_date: values.site_visit_date?.toISOString() || null,
        invitation_date: values.invitation_date?.toISOString() || null,
      };

      const { error } = await supabase.from('tender_registry').insert(payload);

      if (!error) {
        message.success('Тендер добавлен');
        form.resetFields();
        onSuccess();
      } else {
        message.error('Ошибка добавления тендера');
      }
    } catch (error) {
      // Валидация не прошла
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '16px',
        border: `2px solid #10b981`,
        borderRadius: '6px',
        backgroundColor: token.colorBgContainer,
      }}
    >
      <Form form={form} layout="vertical">
        {/* Строка 1: Основная информация */}
        <Row gutter={8}>
          <Col span={3}>
            <Form.Item name="tender_number" label="Номер тендера">
              <AutoComplete
                options={tenderNumbers.map(tn => ({ value: tn }))}
                placeholder="Номер"
                filterOption={(input, option) =>
                  option!.value.toLowerCase().includes(input.toLowerCase())
                }
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="title"
              label="Наименование"
              rules={[{ required: true, message: 'Обязательное поле' }]}
            >
              <AutoComplete
                options={titles.map(t => ({ value: t }))}
                placeholder="Наименование ЖК"
                filterOption={(input, option) =>
                  option!.value.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item
              name="client_name"
              label="Заказчик"
              rules={[{ required: true, message: 'Обязательное поле' }]}
            >
              <AutoComplete
                options={clientNames.map(c => ({ value: c }))}
                placeholder="Заказчик"
                filterOption={(input, option) =>
                  option!.value.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="object_address" label="Адрес объекта">
              <Input placeholder="Адрес" />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="construction_scope_id" label="Объем строительства">
              <Select allowClear placeholder="Выберите">
                {constructionScopes.map(cs => (
                  <Select.Option key={cs.id} value={cs.id}>
                    {cs.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Строка 2: Площадь, статус, даты */}
        <Row gutter={8}>
          <Col span={3}>
            <Form.Item name="area" label="Площадь, м²">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="status_id" label="Статус">
              <Select allowClear placeholder="Выберите">
                {statuses.map(s => (
                  <Select.Option key={s.id} value={s.id}>
                    {s.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="submission_date" label="Дата подачи КП">
              <DatePicker
                style={{ width: '100%' }}
                format="DD.MM.YYYY"
                placeholder="Дата"
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="construction_start_date" label="Дата выхода">
              <DatePicker
                style={{ width: '100%' }}
                format="DD.MM.YYYY"
                placeholder="Дата"
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="site_visit_date" label="Дата посещения">
              <DatePicker
                style={{ width: '100%' }}
                format="DD.MM.YYYY"
                placeholder="Дата"
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="invitation_date" label="Дата приглашения">
              <DatePicker
                style={{ width: '100%' }}
                format="DD.MM.YYYY"
                placeholder="Дата"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Строка 3: Фото посещения */}
        <Row gutter={8}>
          <Col span={24}>
            <Form.Item name="site_visit_photo_url" label="Ссылка на фото посещения">
              <Input placeholder="https://..." />
            </Form.Item>
          </Col>
        </Row>

        {/* Строка 4: Хронология */}
        <Row gutter={8}>
          <Col span={24}>
            <Form.Item label="Хронология">
              <ChronologyList editable={true} form={form} fieldName="chronology_items" />
            </Form.Item>
          </Col>
        </Row>

        {/* Строка 5: Тендерный пакет */}
        <Row gutter={8}>
          <Col span={24}>
            <Form.Item label="Тендерный пакет">
              <TenderPackageList editable={true} form={form} fieldName="tender_package_items" />
            </Form.Item>
          </Col>
        </Row>

        {/* Строка 6: Действия */}
        <Row gutter={8}>
          <Col span={24} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleSubmit}
              style={{ marginRight: 8 }}
            >
              Добавить
            </Button>
            <Button icon={<CloseOutlined />} onClick={handleCancel}>
              Отмена
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};
