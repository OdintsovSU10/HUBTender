import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Upload, Tag, Modal, Form, Input, Select, Alert, Typography } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  FolderOutlined,
  FileOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';
import { useTheme } from '../../../contexts/ThemeContext';

const { confirm } = Modal;
const { Text, Paragraph, Title } = Typography;

// Типы данных
interface CostCategory {
  id: string;
  name: string;
  unit: string;
  created_at: string;
  updated_at: string;
}

interface DetailCostCategory {
  id: string;
  cost_category_id: string;
  location: string;
  name: string;
  unit: string;
  order_num: number;
  created_at: string;
  updated_at: string;
  cost_category?: CostCategory;
}

interface TreeNode {
  key: string;
  structure: string;
  type: 'category' | 'detail';
  unit: string;
  description: string;
  children?: TreeNode[];
  categoryId?: string;
  detailId?: string;
  location?: string;
  orderNum?: number;
}

const ConstructionCost: React.FC = () => {
  const { theme } = useTheme();
  const [data, setData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TreeNode | null>(null);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [sqlContent, setSqlContent] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [unitsData, setUnitsData] = useState<any[]>([]);
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [addDetailModalOpen, setAddDetailModalOpen] = useState(false);
  const [addLocationModalOpen, setAddLocationModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TreeNode | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TreeNode | null>(null);
  const [form] = Form.useForm();
  const [addCategoryForm] = Form.useForm();
  const [addDetailForm] = Form.useForm();
  const [addLocationForm] = Form.useForm();

  // Цвета для единиц измерения
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
    'точка': 'gold',
    'км': 'lime',
    'прибор': 'pink',
    'пог.м': 'teal',
    'упак': 'brown',
  };

  // Загрузка единиц измерения из таблицы units
  const loadUnits = async () => {
    try {
      const { data: units, error } = await supabase
        .from('units')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      if (units) {
        setAvailableUnits(units.map(u => u.code));
        setUnitsData(units);
      }
    } catch (error) {
      console.error('Ошибка загрузки единиц измерения:', error);
      // Fallback на базовый набор единиц
      setAvailableUnits(['шт', 'м', 'м2', 'м3', 'кг', 'т', 'л', 'компл', 'м.п.']);
    }
  };

  // Загрузка данных из базы
  const loadData = async () => {
    setLoading(true);
    try {
      // Загружаем категории
      const { data: categories, error: catError } = await supabase
        .from('cost_categories')
        .select('*')
        .order('name');

      if (catError) throw catError;

      // Загружаем детали с сортировкой по order_num
      const { data: details, error: detError } = await supabase
        .from('detail_cost_categories')
        .select('*, cost_categories(*)')
        .order('order_num');

      if (detError) throw detError;

      // Формируем трехуровневую структуру: Категория -> Детализация -> Локация
      const treeData: TreeNode[] = [];
      const categoryMap = new Map<string, TreeNode>();
      const categoryMinOrderNum = new Map<string, number>();

      // Определяем минимальный order_num для каждой категории (для сортировки категорий)
      details?.forEach(detail => {
        const currentMin = categoryMinOrderNum.get(detail.cost_category_id);
        if (currentMin === undefined || detail.order_num < currentMin) {
          categoryMinOrderNum.set(detail.cost_category_id, detail.order_num);
        }
      });

      // Создаем узлы категорий
      categories?.forEach(cat => {
        const node: TreeNode = {
          key: `cat_${cat.id}`,
          structure: cat.name,
          type: 'category',
          unit: cat.unit,
          description: 'Нет описания',
          categoryId: cat.id,
          orderNum: categoryMinOrderNum.get(cat.id) || 999999,
          children: [],
        };
        categoryMap.set(cat.id, node);
        treeData.push(node);
      });

      // Группируем детали по категориям и создаем структуру Детализация -> Локация
      details?.forEach(detail => {
        const categoryNode = categoryMap.get(detail.cost_category_id);
        if (categoryNode && categoryNode.children) {
          // Ищем или создаем узел для детали (группируем по name + unit)
          const detailKey = `${detail.name}_${detail.unit}`;
          let detailNode = categoryNode.children.find(
            child => child.structure === detail.name && child.unit === detail.unit
          );

          if (!detailNode) {
            detailNode = {
              key: `detail_group_${detailKey}_${detail.cost_category_id}`,
              structure: detail.name,
              type: 'detail',
              unit: detail.unit,
              description: 'Нет описания',
              categoryId: detail.cost_category_id,
              orderNum: detail.order_num,
              children: [],
            };
            categoryNode.children.push(detailNode);
          }

          // Добавляем локацию как третий уровень
          if (detailNode.children) {
            detailNode.children.push({
              key: `location_${detail.id}`,
              structure: `📍 ${detail.location}`,
              type: 'detail',
              unit: detail.unit, // Используем единицу измерения из детали
              description: 'Локация',
              detailId: detail.id,
              categoryId: detail.cost_category_id,
              location: detail.location,
              orderNum: detail.order_num,
            });
          }
        }
      });

      // Сортируем категории по минимальному order_num их деталей
      treeData.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));

      // Сортируем детали внутри категорий по order_num
      treeData.forEach(cat => {
        if (cat.children) {
          cat.children.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
          // Сортируем локации внутри деталей
          cat.children.forEach(detail => {
            if (detail.children) {
              detail.children.sort((a, b) => (a.orderNum || 0) - (b.orderNum || 0));
            }
          });
        }
      });

      setData(treeData);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      message.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadUnits(); // Сначала загружаем единицы измерения
      await loadData();  // Затем загружаем основные данные
    };
    init();
  }, []);

  // Обработка импорта Excel
  const handleExcelImport = async (file: UploadFile) => {
    setUploading(true);
    setImportErrors([]);

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Пропускаем заголовок
          const rows = jsonData.slice(1) as any[][];

          // Проверяем наличие данных
          if (rows.length === 0) {
            message.error('Excel файл пуст или имеет неверный формат');
            setUploading(false);
            return;
          }

          // Создаем Map для категорий чтобы избежать дубликатов
          const categoriesMap = new Map<string, { name: string; unit: string }>();
          const detailsList: any[] = [];
          const unknownUnits = new Set<string>();
          const errors: string[] = [];

          // Обрабатываем строки и собираем ошибки
          rows.forEach((row, index) => {
            const rowNum = index + 2; // +2 т.к. индекс с 0 и пропускаем заголовок

            if (!row || row.length < 6) {
              errors.push(`Строка ${rowNum}: неполные данные (требуется 6 столбцов)`);
              return;
            }

            const [orderNum, categoryName, categoryUnit, detailName, detailUnit, location] = row;

            // Проверяем обязательные поля
            if (!categoryName || !categoryUnit || !detailName || !detailUnit || !location) {
              errors.push(`Строка ${rowNum}: пустые обязательные поля`);
              return;
            }

            // Проверяем единицы измерения категории
            const catUnit = String(categoryUnit).trim();
            if (!availableUnits.includes(catUnit)) {
              unknownUnits.add(catUnit);
            }

            // Проверяем единицы измерения детали
            const detUnit = String(detailUnit).trim();
            if (!availableUnits.includes(detUnit)) {
              unknownUnits.add(detUnit);
            }

            // Добавляем категорию если еще нет
            const categoryKey = `${categoryName}_${catUnit}`;
            if (!categoriesMap.has(categoryKey)) {
              categoriesMap.set(categoryKey, {
                name: String(categoryName).trim(),
                unit: catUnit,
              });
            }

            // Добавляем деталь
            detailsList.push({
              categoryKey,
              orderNum: Number(orderNum) || 0,
              name: String(detailName).trim(),
              unit: detUnit,
              location: String(location).trim(),
              rowNum,
            });
          });

          // Если есть неизвестные единицы измерения, предлагаем добавить их автоматически
          if (unknownUnits.size > 0) {
            const newUnits = Array.from(unknownUnits).sort();

            // Показываем диалог с выбором действия
            confirm({
              title: 'Найдены новые единицы измерения',
              icon: <ExclamationCircleOutlined />,
              content: (
                <div>
                  <p>Обнаружены неизвестные единицы измерения:</p>
                  <p><strong>{newUnits.join(', ')}</strong></p>
                  <p>Вы можете:</p>
                  <ul>
                    <li>Автоматически добавить их в базу данных (рекомендуется)</li>
                    <li>Получить SQL запрос для ручного добавления</li>
                  </ul>
                </div>
              ),
              okText: 'Добавить автоматически',
              cancelText: 'Показать SQL',
              onOk: async () => {
                // Автоматически добавляем новые единицы в БД
                try {
                  const unitsToInsert = newUnits.map((unit, index) => ({
                    code: unit,
                    name: unit,
                    name_short: unit,
                    category: 'импортированная',
                    sort_order: 150 + (index * 10),
                    is_active: true
                  }));

                  const { error } = await supabase
                    .from('units')
                    .upsert(unitsToInsert, { onConflict: 'code' });

                  if (error) throw error;

                  message.success(`Добавлено ${newUnits.length} новых единиц измерения`);

                  // Перезагружаем единицы измерения
                  await loadUnits();

                  // Повторяем импорт с обновленным списком единиц
                  message.info('Повторяем импорт с новыми единицами...');
                  handleExcelImport(file);
                } catch (error) {
                  console.error('Ошибка добавления единиц:', error);
                  message.error('Не удалось добавить новые единицы измерения');
                  setUploading(false);
                }
              },
              onCancel: () => {
                // Показываем SQL для ручного добавления
                const sqlInserts = newUnits.map((unit, index) => {
                  const nextSortOrder = 150 + (index * 10);
                  return `('${unit}', '${unit}', '${unit}', 'импортированная', ${nextSortOrder})`;
                }).join(',\n  ');

                const sqlQuery = `-- SQL для добавления новых единиц измерения в таблицу units
-- Выполните этот запрос в Supabase перед повторным импортом

INSERT INTO public.units (code, name, name_short, category, sort_order)
VALUES
  ${sqlInserts}
ON CONFLICT (code) DO UPDATE SET
  is_active = true,
  updated_at = NOW();

-- Проверка добавленных единиц:
SELECT * FROM public.units
WHERE code IN (${newUnits.map(u => `'${u}'`).join(', ')})
ORDER BY sort_order;`;

                setSqlContent(sqlQuery);
                setSqlModalOpen(true);
                setImportErrors([
                  `Найдены неизвестные единицы измерения: ${newUnits.join(', ')}`,
                  'Выполните предложенный SQL запрос в Supabase, затем повторите импорт',
                  ...errors
                ]);
                setUploading(false);
              }
            });
            return;
          }

          // Если есть ошибки валидации, показываем их
          if (errors.length > 0) {
            setImportErrors(errors);
            message.error('Импорт прерван из-за ошибок в данных');
            setUploading(false);
            return;
          }

          // Сохраняем категории в БД
          const categoryIdMap = new Map<string, string>();
          const saveErrors: string[] = [];

          for (const [key, category] of categoriesMap.entries()) {
            const { data: existingCategory } = await supabase
              .from('cost_categories')
              .select('id')
              .eq('name', category.name)
              .eq('unit', category.unit)
              .maybeSingle();

            if (existingCategory) {
              categoryIdMap.set(key, existingCategory.id);
            } else {
              const { data: newCategory, error } = await supabase
                .from('cost_categories')
                .insert({
                  name: category.name,
                  unit: category.unit,
                })
                .select()
                .single();

              if (error) {
                saveErrors.push(`Ошибка создания категории "${category.name}": ${error.message}`);
              } else if (newCategory) {
                categoryIdMap.set(key, newCategory.id);
              }
            }
          }

          // Сохраняем детали в БД
          let successCount = 0;
          for (const detail of detailsList) {
            const categoryId = categoryIdMap.get(detail.categoryKey);
            if (categoryId) {
              const { error } = await supabase
                .from('detail_cost_categories')
                .insert({
                  cost_category_id: categoryId,
                  order_num: detail.orderNum,
                  name: detail.name,
                  unit: detail.unit,
                  location: detail.location,
                });

              if (error) {
                saveErrors.push(`Строка ${detail.rowNum}: ${error.message}`);
              } else {
                successCount++;
              }
            }
          }

          // Показываем результат
          if (saveErrors.length > 0) {
            setImportErrors(saveErrors);
            message.warning(`Импортировано ${successCount} из ${detailsList.length} записей. Есть ошибки.`);
          } else {
            message.success(`Успешно импортировано ${successCount} записей`);
          }

          await loadData();
        } catch (error: any) {
          console.error('Ошибка обработки файла:', error);
          message.error('Ошибка обработки файла Excel: ' + error.message);
          setImportErrors([error.message || 'Неизвестная ошибка']);
        } finally {
          setUploading(false);
        }
      };

      reader.readAsBinaryString(file as any);
    } catch (error: any) {
      console.error('Ошибка импорта:', error);
      message.error('Ошибка импорта файла');
      setImportErrors([error.message || 'Неизвестная ошибка при чтении файла']);
      setUploading(false);
    }

    return false; // Предотвращаем автоматическую загрузку
  };

  // Удаление записи
  const handleDelete = (record: TreeNode) => {
    confirm({
      title: 'Подтверждение удаления',
      icon: <ExclamationCircleOutlined />,
      content: `Вы уверены, что хотите удалить "${record.structure}"?`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          if (record.type === 'category' && record.categoryId) {
            // Удаляем категорию (детали удалятся каскадно)
            const { error } = await supabase
              .from('cost_categories')
              .delete()
              .eq('id', record.categoryId);

            if (error) throw error;
          } else if (record.type === 'detail' && record.detailId) {
            // Удаляем деталь
            const { error } = await supabase
              .from('detail_cost_categories')
              .delete()
              .eq('id', record.detailId);

            if (error) throw error;
          }

          message.success('Запись успешно удалена');
          await loadData();
        } catch (error) {
          console.error('Ошибка удаления:', error);
          message.error('Ошибка удаления записи');
        }
      },
    });
  };

  // Редактирование записи
  const handleEdit = (record: TreeNode) => {
    setEditingItem(record);
    form.setFieldsValue({
      name: record.structure,
      unit: record.unit,
      location: record.location,
    });
    setEditModalOpen(true);
  };

  // Функция добавления новой категории
  const handleAddCategory = async () => {
    try {
      const values = await addCategoryForm.validateFields();

      const { data, error } = await supabase
        .from('cost_categories')
        .insert({
          name: values.name,
          unit: values.unit,
        })
        .select()
        .single();

      if (error) throw error;

      message.success('Категория успешно добавлена');
      setAddCategoryModalOpen(false);
      addCategoryForm.resetFields();
      await loadData();
    } catch (error) {
      console.error('Ошибка добавления категории:', error);
      message.error('Ошибка при добавлении категории');
    }
  };

  // Функция добавления детализации к категории
  const handleAddDetail = (category: TreeNode) => {
    setSelectedCategory(category);
    setAddDetailModalOpen(true);
  };

  const handleSaveDetail = async () => {
    try {
      const values = await addDetailForm.validateFields();

      // Получаем максимальный order_num
      const { data: maxOrderData } = await supabase
        .from('detail_cost_categories')
        .select('order_num')
        .order('order_num', { ascending: false })
        .limit(1);

      const nextOrderNum = maxOrderData && maxOrderData.length > 0
        ? (maxOrderData[0].order_num + 1)
        : 1;

      const { error } = await supabase
        .from('detail_cost_categories')
        .insert({
          cost_category_id: selectedCategory?.categoryId,
          name: values.name,
          unit: values.unit,
          location: values.location,
          order_num: nextOrderNum,
        });

      if (error) throw error;

      message.success('Детализация успешно добавлена');
      setAddDetailModalOpen(false);
      addDetailForm.resetFields();
      await loadData();
    } catch (error) {
      console.error('Ошибка добавления детализации:', error);
      message.error('Ошибка при добавлении детализации');
    }
  };

  // Функция добавления локализации к детализации
  const handleAddLocation = (detail: TreeNode) => {
    setSelectedDetail(detail);
    setAddLocationModalOpen(true);
  };

  const handleSaveLocation = async () => {
    try {
      const values = await addLocationForm.validateFields();

      // Для локализации создаем новую запись detail_cost_category с тем же именем и категорией
      const { error } = await supabase
        .from('detail_cost_categories')
        .insert({
          cost_category_id: selectedDetail?.categoryId,
          name: selectedDetail?.structure,
          unit: selectedDetail?.unit || values.unit,
          location: values.location,
          order_num: selectedDetail?.orderNum || 999,
        });

      if (error) throw error;

      message.success('Локализация успешно добавлена');
      setAddLocationModalOpen(false);
      addLocationForm.resetFields();
      await loadData();
    } catch (error) {
      console.error('Ошибка добавления локализации:', error);
      message.error('Ошибка при добавлении локализации');
    }
  };

  // Сохранение изменений
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingItem?.type === 'category' && editingItem.categoryId) {
        const { error } = await supabase
          .from('cost_categories')
          .update({
            name: values.name,
            unit: values.unit,
          })
          .eq('id', editingItem.categoryId);

        if (error) throw error;
      } else if (editingItem?.type === 'detail' && editingItem.detailId) {
        const { error } = await supabase
          .from('detail_cost_categories')
          .update({
            name: values.name,
            unit: values.unit,
            location: values.location,
          })
          .eq('id', editingItem.detailId);

        if (error) throw error;
      }

      message.success('Изменения сохранены');
      setEditModalOpen(false);
      form.resetFields();
      await loadData();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      message.error('Ошибка сохранения изменений');
    }
  };

  // Колонки таблицы
  const columns: ColumnsType<TreeNode> = [
    {
      title: 'Структура',
      dataIndex: 'structure',
      key: 'structure',
      align: 'left',
      width: '60%',
      render: (text: string, record: TreeNode) => {
        // Определяем иконку и стиль в зависимости от уровня
        let icon;
        let fontWeight = 400;

        if (record.type === 'category') {
          icon = <FolderOutlined style={{ color: '#1890ff' }} />;
          fontWeight = 500;
        } else if (text.startsWith('📍')) {
          // Это локализация (третий уровень)
          icon = null; // Иконка уже в тексте
          fontWeight = 300;
        } else {
          // Это детализация (второй уровень)
          icon = <FileOutlined style={{ color: '#52c41a' }} />;
          fontWeight = 400;
        }

        return (
          <Space>
            {icon}
            <span style={{ fontWeight }}>
              {text}
            </span>
          </Space>
        );
      },
    },
    {
      title: 'Тип элемента',
      key: 'type',
      align: 'center',
      width: '10%',
      render: (record: TreeNode) => {
        if (record.type === 'category') {
          return <Tag color="blue">Категория</Tag>;
        } else if (record.structure?.startsWith('📍')) {
          return <Tag color="cyan">Локализация</Tag>;
        } else {
          return <Tag color="green">Детализация</Tag>;
        }
      },
    },
    {
      title: 'Единица измерения',
      dataIndex: 'unit',
      key: 'unit',
      align: 'center',
      width: '10%',
      render: (unit: string) => (
        <Tag color={unitColors[unit] || 'default'}>{unit}</Tag>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
      width: '10%',
    },
    {
      title: 'Действия',
      key: 'action',
      align: 'center',
      width: '10%',
      render: (_: any, record: TreeNode) => (
        <Space size="small">
          {/* Кнопка добавления для категорий и деталей */}
          {record.type === 'category' && (
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => handleAddDetail(record)}
              title="Добавить детализацию"
            />
          )}
          {record.type === 'detail' && !record.structure?.startsWith('📍') && (
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => handleAddLocation(record)}
              title="Добавить локализацию"
            />
          )}
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            title="Редактировать"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            title="Удалить"
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ margin: '-16px', padding: '24px' }}>
      <style>{`
        .construction-cost-table .ant-table-row-expand-icon {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 18px !important;
          height: 18px !important;
          margin: 0 4px 0 0 !important;
          border: 1px solid ${theme === 'dark' ? '#434343' : '#d9d9d9'} !important;
          border-radius: 4px !important;
          background: ${theme === 'dark' ? '#1f1f1f' : '#fff'} !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        }

        .construction-cost-table .ant-table-row-expand-icon:hover {
          border-color: #1890ff !important;
          background: ${theme === 'dark' ? 'rgba(24, 144, 255, 0.15)' : '#f0f5ff'} !important;
        }

        .construction-cost-table .ant-table-row-expand-icon::before,
        .construction-cost-table .ant-table-row-expand-icon::after {
          content: '' !important;
          position: absolute !important;
          background: ${theme === 'dark' ? '#999' : '#666'} !important;
          transition: all 0.2s !important;
        }

        /* Горизонтальная линия (для плюса и минуса) */
        .construction-cost-table .ant-table-row-expand-icon::before {
          width: 10px !important;
          height: 2px !important;
        }

        /* Вертикальная линия (только для плюса) */
        .construction-cost-table .ant-table-row-expand-icon.ant-table-row-expand-icon-collapsed::after {
          width: 2px !important;
          height: 10px !important;
        }

        /* Скрываем вертикальную линию для минуса */
        .construction-cost-table .ant-table-row-expand-icon.ant-table-row-expand-icon-expanded::after {
          display: none !important;
        }

        /* При наведении меняем цвет линий */
        .construction-cost-table .ant-table-row-expand-icon:hover::before,
        .construction-cost-table .ant-table-row-expand-icon:hover::after {
          background: #1890ff !important;
        }

        /* Убираем стандартные SVG иконки Ant Design */
        .construction-cost-table .ant-table-row-expand-icon svg {
          display: none !important;
        }

        /* Для строк без детей (пустая иконка-заглушка) */
        .construction-cost-table .ant-table-row-expand-icon.ant-table-row-expand-icon-spaced {
          visibility: hidden !important;
        }

        /* Уменьшаем высоту строк для более компактного вида */
        .construction-cost-table .ant-table-tbody > tr > td {
          padding: 6px 8px !important;
        }

        .construction-cost-table .ant-table-thead > tr > th {
          padding: 8px 8px !important;
        }
      `}</style>
      <Title level={4} style={{ margin: '0 0 16px 0' }}>
        Затраты на строительство
      </Title>
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            <Upload
              accept=".xlsx,.xls"
              beforeUpload={handleExcelImport}
              showUploadList={false}
            >
              <Button
                icon={<UploadOutlined />}
                loading={uploading}
              >
                Импорт из Excel
              </Button>
            </Upload>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddCategoryModalOpen(true)}
            >
              Добавить категорию
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                confirm({
                  title: 'Удалить все затраты?',
                  icon: <ExclamationCircleOutlined />,
                  content: 'Это действие удалит все категории и детализации. Отменить операцию будет невозможно.',
                  okText: 'Удалить',
                  okType: 'danger',
                  cancelText: 'Отмена',
                  onOk: async () => {
                    try {
                      // Удаляем все детали
                      const { error: detailError } = await supabase
                        .from('detail_cost_categories')
                        .delete()
                        .not('id', 'is', null);

                      if (detailError) throw detailError;

                      // Удаляем все категории
                      const { error: categoryError } = await supabase
                        .from('cost_categories')
                        .delete()
                        .not('id', 'is', null);

                      if (categoryError) throw categoryError;

                      message.success('Все затраты успешно удалены');
                      await loadData();
                    } catch (error) {
                      console.error('Ошибка удаления:', error);
                      message.error('Ошибка при удалении затрат');
                    }
                  },
                });
              }}
            >
              Удалить затраты
            </Button>
          </Space>
        </div>
        <Table
          className="construction-cost-table"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ y: 'calc(100vh - 300px)' }}
          expandable={{
            defaultExpandAllRows: true,
          }}
          rowKey="key"
        />
      </div>

      {/* Модальное окно редактирования */}
      <Modal
        title={`Редактирование ${editingItem?.type === 'category' ? 'категории' : 'детализации'}`}
        open={editModalOpen}
        onOk={handleSave}
        onCancel={() => {
          setEditModalOpen(false);
          form.resetFields();
        }}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Наименование"
            rules={[{ required: true, message: 'Введите наименование' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="unit"
            label="Единица измерения"
            rules={[{ required: true, message: 'Выберите единицу измерения' }]}
          >
            <Select>
              <Select.Option value="шт">шт</Select.Option>
              <Select.Option value="м">м</Select.Option>
              <Select.Option value="м2">м2</Select.Option>
              <Select.Option value="м3">м3</Select.Option>
              <Select.Option value="кг">кг</Select.Option>
              <Select.Option value="т">т</Select.Option>
              <Select.Option value="л">л</Select.Option>
              <Select.Option value="компл">компл</Select.Option>
              <Select.Option value="м.п.">м.п.</Select.Option>
              <Select.Option value="точка">точка</Select.Option>
              <Select.Option value="км">км</Select.Option>
              <Select.Option value="прибор">прибор</Select.Option>
              <Select.Option value="пог.м">пог.м</Select.Option>
              <Select.Option value="упак">упак</Select.Option>
            </Select>
          </Form.Item>
          {editingItem?.type === 'detail' && (
            <Form.Item
              name="location"
              label="Локация"
              rules={[{ required: true, message: 'Введите локацию' }]}
            >
              <Input />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Модальное окно с SQL для новых единиц измерения */}
      <Modal
        title="Необходимо добавить новые единицы измерения"
        open={sqlModalOpen}
        onCancel={() => {
          setSqlModalOpen(false);
          setSqlContent('');
        }}
        width={800}
        footer={[
          <Button
            key="copy"
            type="primary"
            onClick={() => {
              navigator.clipboard.writeText(sqlContent);
              message.success('SQL скопирован в буфер обмена');
            }}
          >
            Скопировать SQL
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setSqlModalOpen(false);
              setSqlContent('');
            }}
          >
            Закрыть
          </Button>,
        ]}
      >
        <Alert
          message="Обнаружены неизвестные единицы измерения"
          description="Выполните следующий SQL запрос в Supabase SQL Editor, затем повторите импорт файла."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Paragraph>
          <pre style={{
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
            padding: 12,
            borderRadius: 4,
            overflow: 'auto',
            maxHeight: 400,
            fontSize: 12,
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
            fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
          }}>
            {sqlContent}
          </pre>
        </Paragraph>
      </Modal>

      {/* Модальное окно с ошибками импорта */}
      <Modal
        title="Ошибки импорта"
        open={importErrors.length > 0}
        onCancel={() => setImportErrors([])}
        footer={[
          <Button key="close" onClick={() => setImportErrors([])}>
            Закрыть
          </Button>,
        ]}
        width={600}
      >
        <Alert
          message="Импорт завершен с ошибками"
          description="Исправьте указанные ошибки в файле и повторите импорт."
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {importErrors.map((error, index) => (
            <Alert
              key={index}
              message={error}
              type="warning"
              style={{ marginBottom: 8 }}
            />
          ))}
        </div>
      </Modal>

      {/* Модальное окно добавления категории */}
      <Modal
        title="Добавить категорию затрат"
        open={addCategoryModalOpen}
        onOk={handleAddCategory}
        onCancel={() => {
          setAddCategoryModalOpen(false);
          addCategoryForm.resetFields();
        }}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Form form={addCategoryForm} layout="vertical">
          <Form.Item
            name="name"
            label="Наименование категории"
            rules={[{ required: true, message: 'Введите наименование категории' }]}
          >
            <Input placeholder="Например: Земляные работы" />
          </Form.Item>
          <Form.Item
            name="unit"
            label="Единица измерения"
            rules={[{ required: true, message: 'Выберите единицу измерения' }]}
          >
            <Select placeholder="Выберите единицу">
              {unitsData.map(unit => (
                <Select.Option key={unit.code} value={unit.code}>
                  {unit.name} ({unit.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно добавления детализации */}
      <Modal
        title={`Добавить детализацию в "${selectedCategory?.structure}"`}
        open={addDetailModalOpen}
        onOk={handleSaveDetail}
        onCancel={() => {
          setAddDetailModalOpen(false);
          addDetailForm.resetFields();
        }}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Form form={addDetailForm} layout="vertical">
          <Form.Item
            name="name"
            label="Наименование детализации"
            rules={[{ required: true, message: 'Введите наименование детализации' }]}
          >
            <Input placeholder="Например: Разработка грунта" />
          </Form.Item>
          <Form.Item
            name="unit"
            label="Единица измерения"
            rules={[{ required: true, message: 'Выберите единицу измерения' }]}
          >
            <Select placeholder="Выберите единицу">
              {unitsData.map(unit => (
                <Select.Option key={unit.code} value={unit.code}>
                  {unit.name} ({unit.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="location"
            label="Локализация"
            rules={[{ required: true, message: 'Введите локализацию' }]}
          >
            <Input placeholder="Например: Секция А" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно добавления локализации */}
      <Modal
        title={`Добавить локализацию для "${selectedDetail?.structure}"`}
        open={addLocationModalOpen}
        onOk={handleSaveLocation}
        onCancel={() => {
          setAddLocationModalOpen(false);
          addLocationForm.resetFields();
        }}
        okText="Добавить"
        cancelText="Отмена"
      >
        <Form form={addLocationForm} layout="vertical">
          <Form.Item
            name="location"
            label="Локализация"
            rules={[{ required: true, message: 'Введите локализацию' }]}
          >
            <Input placeholder="Например: Секция Б" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ConstructionCost;