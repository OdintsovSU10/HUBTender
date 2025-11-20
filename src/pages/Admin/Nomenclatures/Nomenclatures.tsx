import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Space, Input, Tag, Tooltip, message, Modal, Form, InputNumber, Switch, Select, AutoComplete, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { TabsProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { supabase } from '../../../lib/supabase';

const { Title } = Typography;

const { confirm } = Modal;

interface MaterialRecord {
  key: string;
  id: string;
  name: string;
  unit: string;
  created_at: string;
}

interface WorkRecord {
  key: string;
  id: string;
  name: string;
  unit: string;
  created_at: string;
}

interface UnitRecord {
  key: string;
  code: string;
  name: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const Nomenclatures: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [materialsData, setMaterialsData] = useState<MaterialRecord[]>([]);
  const [worksData, setWorksData] = useState<WorkRecord[]>([]);
  const [unitsData, setUnitsData] = useState<UnitRecord[]>([]);
  const [activeTab, setActiveTab] = useState('materials');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Модальные окна для материалов
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialRecord | null>(null);
  const [materialForm] = Form.useForm();

  // Модальные окна для работ
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<WorkRecord | null>(null);
  const [workForm] = Form.useForm();

  // Модальные окна для единиц измерения
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRecord | null>(null);
  const [unitForm] = Form.useForm();

  // Список единиц измерения для Select
  const [unitsList, setUnitsList] = useState<{code: string, name: string}[]>([]);

  const unitColors: Record<string, string> = {
    'шт': 'blue',
    'м': 'green',
    'м2': 'cyan',
    'м3': 'purple',
    'кг': 'orange',
    'т': 'red',
    'л': 'magenta',
    'компл': 'volcano',
    'м.п.': 'geekblue',
  };

  // Загрузка материалов
  const loadMaterials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_names')
        .select('*')
        .order('name');

      if (error) throw error;

      const formattedData: MaterialRecord[] = data?.map((item: any) => ({
        key: item.id,
        id: item.id,
        name: item.name,
        unit: item.unit,
        created_at: new Date(item.created_at).toLocaleDateString('ru-RU'),
      })) || [];

      setMaterialsData(formattedData);
    } catch (error) {
      console.error('Ошибка загрузки материалов:', error);
      message.error('Ошибка загрузки материалов');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка работ
  const loadWorks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_names')
        .select('*')
        .order('name');

      if (error) throw error;

      const formattedData: WorkRecord[] = data?.map((item: any) => ({
        key: item.id,
        id: item.id,
        name: item.name,
        unit: item.unit,
        created_at: new Date(item.created_at).toLocaleDateString('ru-RU'),
      })) || [];

      setWorksData(formattedData);
    } catch (error) {
      console.error('Ошибка загрузки работ:', error);
      message.error('Ошибка загрузки работ');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка единиц измерения
  const loadUnits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('sort_order');

      if (error) throw error;

      const formattedData: UnitRecord[] = data?.map((item: any) => ({
        key: item.code,
        code: item.code,
        name: item.name,
        category: item.category || 'общая',
        sort_order: item.sort_order || 0,
        is_active: item.is_active !== false,
        created_at: new Date(item.created_at).toLocaleDateString('ru-RU'),
      })) || [];

      setUnitsData(formattedData);
    } catch (error) {
      console.error('Ошибка загрузки единиц измерения:', error);
      message.error('Ошибка загрузки единиц измерения');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка списка единиц измерения для Select
  const loadUnitsList = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('code, name')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      const unitOptions = data?.map((item: any) => ({
        code: item.code,
        name: item.name,
      })) || [];

      setUnitsList(unitOptions);
    } catch (error) {
      console.error('Ошибка загрузки списка единиц:', error);
    }
  };

  // Открытие модального окна для добавления единицы
  const handleAddUnit = () => {
    setEditingUnit(null);
    unitForm.resetFields();
    unitForm.setFieldsValue({
      is_active: true,
      sort_order: 0,
    });
    setUnitModalOpen(true);
  };

  // Открытие модального окна для редактирования единицы
  const handleEditUnit = (record: UnitRecord) => {
    setEditingUnit(record);
    unitForm.setFieldsValue({
      code: record.code,
      name: record.name,
      category: record.category,
      sort_order: record.sort_order,
      is_active: record.is_active,
    });
    setUnitModalOpen(true);
  };

  // Сохранение единицы измерения
  const handleSaveUnit = async () => {
    try {
      const values = await unitForm.validateFields();

      if (editingUnit) {
        // Редактирование существующей единицы
        const { error } = await supabase
          .from('units')
          .update({
            name: values.name,
            category: values.category,
            sort_order: values.sort_order,
            is_active: values.is_active,
          })
          .eq('code', editingUnit.code);

        if (error) throw error;
        message.success('Единица измерения обновлена');
      } else {
        // Добавление новой единицы
        const { error } = await supabase
          .from('units')
          .insert({
            code: values.code,
            name: values.name,
            category: values.category,
            sort_order: values.sort_order,
            is_active: values.is_active,
          });

        if (error) throw error;
        message.success('Единица измерения добавлена');
      }

      setUnitModalOpen(false);
      unitForm.resetFields();
      await loadUnits();
    } catch (error: any) {
      console.error('Ошибка сохранения единицы измерения:', error);
      message.error(error.message || 'Ошибка сохранения единицы измерения');
    }
  };

  // Удаление единицы измерения
  const handleDeleteUnit = (record: UnitRecord) => {
    confirm({
      title: 'Подтверждение удаления',
      icon: <ExclamationCircleOutlined />,
      content: `Вы уверены, что хотите удалить единицу измерения "${record.name}" (${record.code})?`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('units')
            .delete()
            .eq('code', record.code);

          if (error) throw error;

          message.success('Единица измерения удалена');
          await loadUnits();
        } catch (error: any) {
          console.error('Ошибка удаления единицы измерения:', error);
          message.error(error.message || 'Ошибка удаления единицы измерения');
        }
      },
    });
  };

  // ========== Функции для материалов ==========

  const handleAddMaterial = () => {
    setEditingMaterial(null);
    materialForm.resetFields();
    setMaterialModalOpen(true);
  };

  const handleEditMaterial = (record: MaterialRecord) => {
    setEditingMaterial(record);
    materialForm.setFieldsValue({
      name: record.name,
      unit: record.unit,
    });
    setMaterialModalOpen(true);
  };

  const handleSaveMaterial = async () => {
    try {
      const values = await materialForm.validateFields();

      if (editingMaterial) {
        // Обновление существующего материала
        const { error } = await supabase
          .from('material_names')
          .update({
            name: values.name,
            unit: values.unit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingMaterial.id);

        if (error) throw error;
        message.success('Материал обновлен');
      } else {
        // Добавление нового материала
        const { error } = await supabase
          .from('material_names')
          .insert([{
            name: values.name,
            unit: values.unit,
          }]);

        if (error) throw error;
        message.success('Материал добавлен');
      }

      setMaterialModalOpen(false);
      materialForm.resetFields();
      await loadMaterials();
    } catch (error: any) {
      console.error('Ошибка сохранения материала:', error);
      message.error(error.message || 'Ошибка сохранения материала');
    }
  };

  const handleDeleteMaterial = (record: MaterialRecord) => {
    confirm({
      title: 'Подтверждение удаления',
      icon: <ExclamationCircleOutlined />,
      content: `Вы уверены, что хотите удалить материал "${record.name}"?`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('material_names')
            .delete()
            .eq('id', record.id);

          if (error) throw error;

          message.success('Материал удален');
          await loadMaterials();
        } catch (error: any) {
          console.error('Ошибка удаления материала:', error);
          message.error(error.message || 'Ошибка удаления материала');
        }
      },
    });
  };

  // ========== Функции для работ ==========

  const handleAddWork = () => {
    setEditingWork(null);
    workForm.resetFields();
    setWorkModalOpen(true);
  };

  const handleEditWork = (record: WorkRecord) => {
    setEditingWork(record);
    workForm.setFieldsValue({
      name: record.name,
      unit: record.unit,
    });
    setWorkModalOpen(true);
  };

  const handleSaveWork = async () => {
    try {
      const values = await workForm.validateFields();

      if (editingWork) {
        // Обновление существующей работы
        const { error } = await supabase
          .from('work_names')
          .update({
            name: values.name,
            unit: values.unit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingWork.id);

        if (error) throw error;
        message.success('Работа обновлена');
      } else {
        // Добавление новой работы
        const { error } = await supabase
          .from('work_names')
          .insert([{
            name: values.name,
            unit: values.unit,
          }]);

        if (error) throw error;
        message.success('Работа добавлена');
      }

      setWorkModalOpen(false);
      workForm.resetFields();
      await loadWorks();
    } catch (error: any) {
      console.error('Ошибка сохранения работы:', error);
      message.error(error.message || 'Ошибка сохранения работы');
    }
  };

  const handleDeleteWork = (record: WorkRecord) => {
    confirm({
      title: 'Подтверждение удаления',
      icon: <ExclamationCircleOutlined />,
      content: `Вы уверены, что хотите удалить работу "${record.name}"?`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('work_names')
            .delete()
            .eq('id', record.id);

          if (error) throw error;

          message.success('Работа удалена');
          await loadWorks();
        } catch (error: any) {
          console.error('Ошибка удаления работы:', error);
          message.error(error.message || 'Ошибка удаления работы');
        }
      },
    });
  };

  useEffect(() => {
    loadMaterials();
    loadWorks();
    loadUnits();
    loadUnitsList();
  }, []);

  const materialColumns: ColumnsType<MaterialRecord> = [
    {
      title: '№',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Единица измерения',
      dataIndex: 'unit',
      key: 'unit',
      width: 150,
      align: 'center',
      render: (unit: string) => (
        <Tag color={unitColors[unit] || 'default'}>{unit}</Tag>
      ),
    },
    {
      title: 'Дата создания',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      align: 'center',
    },
    {
      title: 'Действия',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_: any, record: MaterialRecord) => (
        <Space size="small">
          <Tooltip title="Редактировать">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditMaterial(record)}
            />
          </Tooltip>
          <Tooltip title="Удалить">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteMaterial(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const workColumns: ColumnsType<WorkRecord> = [
    {
      title: '№',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Единица измерения',
      dataIndex: 'unit',
      key: 'unit',
      width: 150,
      align: 'center',
      render: (unit: string) => (
        <Tag color={unitColors[unit] || 'default'}>{unit}</Tag>
      ),
    },
    {
      title: 'Дата создания',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      align: 'center',
    },
    {
      title: 'Действия',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_: any, record: WorkRecord) => (
        <Space size="small">
          <Tooltip title="Редактировать">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditWork(record)}
            />
          </Tooltip>
          <Tooltip title="Удалить">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteWork(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const unitColumns: ColumnsType<UnitRecord> = [
    {
      title: '№',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Код',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      align: 'center',
      render: (code: string) => (
        <Tag color={unitColors[code] || 'default'}>{code}</Tag>
      ),
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      align: 'center',
      render: (category: string) => (
        <Tag>{category}</Tag>
      ),
    },
    {
      title: 'Порядок',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
      align: 'center',
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      align: 'center',
      render: (is_active: boolean) => (
        <Tag color={is_active ? 'green' : 'red'}>
          {is_active ? 'Активна' : 'Неактивна'}
        </Tag>
      ),
    },
    {
      title: 'Дата создания',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      align: 'center',
    },
    {
      title: 'Действия',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_: any, record: UnitRecord) => (
        <Space size="small">
          <Tooltip title="Редактировать">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditUnit(record)}
            />
          </Tooltip>
          <Tooltip title="Удалить">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteUnit(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Фильтрация данных для поиска
  const filteredMaterialsData = materialsData.filter(item =>
    searchText === '' ||
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredWorksData = worksData.filter(item =>
    searchText === '' ||
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredUnitsData = unitsData.filter(item =>
    searchText === '' ||
    item.name.toLowerCase().includes(searchText.toLowerCase()) ||
    item.code.toLowerCase().includes(searchText.toLowerCase())
  );

  const paginationConfig = {
    current: currentPage,
    pageSize: pageSize,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} из ${total} записей`,
    onChange: (page: number, newPageSize: number) => {
      setCurrentPage(page);
      if (newPageSize !== pageSize) {
        setPageSize(newPageSize);
        setCurrentPage(1); // Сбрасываем на первую страницу при изменении размера
      }
    },
  };

  const tabItems: TabsProps['items'] = [
    {
      key: 'materials',
      label: 'Материалы',
      children: (
        <Table
          columns={materialColumns}
          dataSource={filteredMaterialsData}
          loading={loading}
          pagination={paginationConfig}
          size="middle"
          scroll={{ y: 600 }}
        />
      ),
    },
    {
      key: 'works',
      label: 'Работы',
      children: (
        <Table
          columns={workColumns}
          dataSource={filteredWorksData}
          loading={loading}
          pagination={paginationConfig}
          size="middle"
          scroll={{ y: 600 }}
        />
      ),
    },
    {
      key: 'units',
      label: 'Единицы измерения',
      children: (
        <Table
          columns={unitColumns}
          dataSource={filteredUnitsData}
          loading={loading}
          pagination={paginationConfig}
          size="middle"
          scroll={{ y: 600 }}
        />
      ),
    },
  ];

  return (
    <div style={{ margin: '-16px', padding: '24px' }}>
      <Title level={4} style={{ margin: '0 0 16px 0' }}>
        Номенклатуры
      </Title>
        <Tabs
          defaultActiveKey="materials"
          items={tabItems}
          size="large"
          onChange={(key) => setActiveTab(key)}
          tabBarExtraContent={
            <Space>
              <Input
                placeholder="Поиск..."
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (activeTab === 'materials') {
                    handleAddMaterial();
                  } else if (activeTab === 'works') {
                    handleAddWork();
                  } else if (activeTab === 'units') {
                    handleAddUnit();
                  }
                }}
              >
                Добавить
              </Button>
            </Space>
          }
        />
      </div>

      {/* Модальное окно для добавления/редактирования единицы измерения */}
      <Modal
        title={editingUnit ? 'Редактировать единицу измерения' : 'Добавить единицу измерения'}
        open={unitModalOpen}
        onOk={handleSaveUnit}
        onCancel={() => {
          setUnitModalOpen(false);
          unitForm.resetFields();
        }}
        okText="Сохранить"
        cancelText="Отмена"
        width={600}
      >
        <Form
          form={unitForm}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="Полное наименование"
            rules={[{ required: true, message: 'Введите наименование' }]}
          >
            <Input placeholder="Например: квадратный метр" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Код единицы измерения"
            rules={[
              { required: true, message: 'Введите код единицы измерения' },
              { max: 10, message: 'Максимум 10 символов' },
            ]}
          >
            <Input
              placeholder="Например: м2, шт, т"
              disabled={!!editingUnit}
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="Категория"
            rules={[{ required: true, message: 'Введите категорию' }]}
          >
            <Input placeholder="Например: площадь, масса, объем" />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="Порядок сортировки"
            rules={[{ required: true, message: 'Введите порядок сортировки' }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              placeholder="Число для сортировки (0-999)"
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Статус"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Активна"
              unCheckedChildren="Неактивна"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно для добавления/редактирования материала */}
      <Modal
        title={editingMaterial ? 'Редактировать материал' : 'Добавить материал'}
        open={materialModalOpen}
        onOk={handleSaveMaterial}
        onCancel={() => {
          setMaterialModalOpen(false);
          materialForm.resetFields();
        }}
        okText="Сохранить"
        cancelText="Отмена"
        width={600}
      >
        <Form
          form={materialForm}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="Наименование материала"
            rules={[
              { required: true, message: 'Введите наименование материала' },
              {
                validator: async (_, value) => {
                  if (!value) return;
                  const isDuplicate = materialsData.some(
                    item => item.name.toLowerCase() === value.toLowerCase() &&
                            (!editingMaterial || item.id !== editingMaterial.id)
                  );
                  if (isDuplicate) {
                    throw new Error('Материал с таким наименованием уже существует');
                  }
                },
              },
            ]}
          >
            <AutoComplete
              placeholder="Например: Кирпич керамический"
              options={materialsData.map(item => ({ value: item.name }))}
              filterOption={(inputValue, option) =>
                option?.value.toLowerCase().includes(inputValue.toLowerCase()) || false
              }
            />
          </Form.Item>

          <Form.Item
            name="unit"
            label="Единица измерения"
            rules={[{ required: true, message: 'Выберите единицу измерения' }]}
          >
            <Select
              showSearch
              placeholder="Выберите или введите единицу измерения"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={unitsList.map(unit => ({
                value: unit.code,
                label: `${unit.name} (${unit.code})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно для добавления/редактирования работы */}
      <Modal
        title={editingWork ? 'Редактировать работу' : 'Добавить работу'}
        open={workModalOpen}
        onOk={handleSaveWork}
        onCancel={() => {
          setWorkModalOpen(false);
          workForm.resetFields();
        }}
        okText="Сохранить"
        cancelText="Отмена"
        width={600}
      >
        <Form
          form={workForm}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="Наименование работы"
            rules={[
              { required: true, message: 'Введите наименование работы' },
              {
                validator: async (_, value) => {
                  if (!value) return;
                  const isDuplicate = worksData.some(
                    item => item.name.toLowerCase() === value.toLowerCase() &&
                            (!editingWork || item.id !== editingWork.id)
                  );
                  if (isDuplicate) {
                    throw new Error('Работа с таким наименованием уже существует');
                  }
                },
              },
            ]}
          >
            <AutoComplete
              placeholder="Например: Монтаж кирпичной кладки"
              options={worksData.map(item => ({ value: item.name }))}
              filterOption={(inputValue, option) =>
                option?.value.toLowerCase().includes(inputValue.toLowerCase()) || false
              }
            />
          </Form.Item>

          <Form.Item
            name="unit"
            label="Единица измерения"
            rules={[{ required: true, message: 'Выберите единицу измерения' }]}
          >
            <Select
              showSearch
              placeholder="Выберите или введите единицу измерения"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={unitsList.map(unit => ({
                value: unit.code,
                label: `${unit.name} (${unit.code})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Nomenclatures;
