import React from 'react';
import { Form, DatePicker, Input, Button, Space, List, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FormInstance } from 'antd';
import type { ChronologyItem } from '../../../../lib/supabase';

const { Text } = Typography;

interface ChronologyListProps {
  editable: boolean;
  items?: ChronologyItem[];
  form?: FormInstance;
  fieldName?: string;
}

export const ChronologyList: React.FC<ChronologyListProps> = ({
  editable,
  items = [],
  form,
  fieldName = 'chronology_items',
}) => {
  if (!editable) {
    // РЕЖИМ ПРОСМОТРА
    if (items.length === 0) {
      return <Text type="secondary">Нет записей</Text>;
    }

    return (
      <List
        size="small"
        dataSource={items}
        style={{ padding: 0 }}
        renderItem={(item, index) => (
          <List.Item style={{ padding: '4px 0', border: 'none' }}>
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Text strong>
                {index + 1}) {item.date ? dayjs(item.date).format('DD.MM.YYYY') : 'Без даты'}
              </Text>
              <Text>{item.text}</Text>
            </Space>
          </List.Item>
        )}
      />
    );
  }

  // РЕЖИМ РЕДАКТИРОВАНИЯ
  return (
    <Form.List name={fieldName}>
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...restField }) => (
            <div
              key={key}
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 8,
                alignItems: 'flex-start',
              }}
            >
              <Form.Item
                {...restField}
                name={[name, 'date']}
                style={{ marginBottom: 0, width: 150, flexShrink: 0 }}
              >
                <DatePicker format="DD.MM.YYYY" placeholder="Дата" />
              </Form.Item>

              <Form.Item
                {...restField}
                name={[name, 'text']}
                rules={[{ required: true, message: 'Введите текст события' }]}
                style={{ marginBottom: 0, flex: 1 }}
              >
                <Input.TextArea
                  placeholder="Описание события"
                  autoSize={{ minRows: 1, maxRows: 6 }}
                />
              </Form.Item>

              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(name)}
                title="Удалить"
                style={{ flexShrink: 0 }}
              />
            </div>
          ))}

          <Button
            type="dashed"
            onClick={() => add({ date: null, text: '' })}
            icon={<PlusOutlined />}
            block
            style={{ marginTop: 8 }}
          >
            Добавить событие
          </Button>
        </>
      )}
    </Form.List>
  );
};
