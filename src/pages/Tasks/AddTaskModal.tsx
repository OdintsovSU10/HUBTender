import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, message } from 'antd';
import { supabase } from '../../lib/supabase';

interface AddTaskModalProps {
  open: boolean;
  userId: string;
  currentTheme: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
  open,
  userId,
  currentTheme,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [tenders, setTenders] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTenders();
    }
  }, [open]);

  const fetchTenders = async () => {
    const { data, error } = await supabase
      .from('tenders')
      .select('id, title')
      .order('title');

    if (error) {
      message.error('Ошибка загрузки проектов: ' + error.message);
      return;
    }

    // Группировка по title, выбор первого по каждому наименованию
    const uniqueTitles = data?.reduce((acc, tender) => {
      if (!acc.find(t => t.title === tender.title)) {
        acc.push(tender);
      }
      return acc;
    }, [] as typeof data);

    setTenders(uniqueTitles || []);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      setLoading(true);
      const { error } = await supabase
        .from('user_tasks')
        .insert({
          user_id: userId,
          tender_id: values.tender_id,
          description: values.description,
          task_status: 'running',
        });

      setLoading(false);

      if (error) {
        message.error('Ошибка создания задачи: ' + error.message);
      } else {
        message.success('Задача добавлена');
        form.resetFields();
        onSuccess();
      }
    } catch (error) {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="Добавить задачу"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Добавить"
      cancelText="Отмена"
      width={600}
      rootClassName={currentTheme === 'dark' ? 'dark-modal' : ''}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="tender_id"
          label="Наименование проекта"
          rules={[{ required: true, message: 'Выберите проект' }]}
        >
          <Select
            showSearch
            placeholder="Начните вводить название проекта..."
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={tenders.map(t => ({ label: t.title, value: t.id }))}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label="Описание задачи"
          rules={[
            { required: true, message: 'Введите описание задачи' },
            { min: 10, message: 'Минимум 10 символов' },
          ]}
        >
          <Input.TextArea
            rows={4}
            placeholder="Опишите задачу..."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddTaskModal;
