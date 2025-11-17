import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Table,
  AutoComplete,
  Select,
  message,
  Collapse,
  Popconfirm,
  InputNumber,
  Typography,
  Tag,
  Divider,
  Tooltip,
  Row,
  Col,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  LinkOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import type {
  Template,
  TemplateItem,
  WorkLibraryFull,
  MaterialLibraryFull,
} from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';

const { Panel } = Collapse;
const { Text } = Typography;

const currencySymbols: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  CNY: '¥',
};

interface TemplateItemWithDetails extends TemplateItem {
  work_name?: string;
  work_unit?: string;
  work_item_type?: string;
  work_unit_rate?: number;
  work_currency_type?: string;
  material_name?: string;
  material_unit?: string;
  material_item_type?: string;
  material_type?: string;
  material_consumption_coefficient?: number;
  material_unit_rate?: number;
  material_currency_type?: string;
  material_delivery_price_type?: string;
  material_delivery_amount?: number;
  parent_work_name?: string;
  detail_cost_category_name?: string;
  detail_cost_category_full?: string; // Format: "Category / Detail / Location"
  manual_cost_override?: boolean; // Флаг ручного изменения затраты
}

interface CostCategoryOption {
  value: string;
  label: string;
  cost_category_name: string;
  location: string;
}

interface TemplateWithDetails extends Template {
  cost_category_name?: string;
  detail_category_name?: string;
  location?: string;
  cost_category_full?: string; // Format: "Category / Detail / Location"
}

const Templates: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('list');
  const { theme: currentTheme } = useTheme();
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [tempIdCounter, setTempIdCounter] = useState(0);
  const [templateItems, setTemplateItems] = useState<TemplateItemWithDetails[]>([]);
  const [loadedTemplateItems, setLoadedTemplateItems] = useState<Record<string, TemplateItemWithDetails[]>>({});
  const [works, setWorks] = useState<WorkLibraryFull[]>([]);
  const [materials, setMaterials] = useState<MaterialLibraryFull[]>([]);
  const [costCategories, setCostCategories] = useState<CostCategoryOption[]>([]);

  // Состояния для формы добавления
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [workSearchText, setWorkSearchText] = useState('');
  const [materialSearchText, setMaterialSearchText] = useState('');
  const [costCategorySearchText, setCostCategorySearchText] = useState('');

  // Состояния для редактирования шаблонов
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingTemplateForm] = Form.useForm();
  const [editingTemplateCostCategorySearchText, setEditingTemplateCostCategorySearchText] = useState('');
  const [editingItems, setEditingItems] = useState<TemplateItemWithDetails[]>([]);

  // Состояния для редактирования элементов шаблона
  const [editingTemplateItems, setEditingTemplateItems] = useState<string | null>(null);
  const [editingWorkSearchText, setEditingWorkSearchText] = useState('');
  const [editingMaterialSearchText, setEditingMaterialSearchText] = useState('');
  const [editingSelectedWork, setEditingSelectedWork] = useState<string | null>(null);
  const [editingSelectedMaterial, setEditingSelectedMaterial] = useState<string | null>(null);

  // Состояния для поиска и фильтрации шаблонов
  const [templateSearchText, setTemplateSearchText] = useState('');
  const [filterCostCategory, setFilterCostCategory] = useState<string | null>(null);
  const [filterDetailCategory, setFilterDetailCategory] = useState<string | null>(null);
  const [openedTemplate, setOpenedTemplate] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchWorks();
    fetchMaterials();
    fetchCostCategories();
    fetchAllTemplateItems();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*, detail_cost_categories(name, location, cost_categories(name))')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Форматируем данные для добавления полной строки затрат
      const formattedTemplates: TemplateWithDetails[] = (data || []).map((item: any) => {
        const costCategoryName = item.detail_cost_categories?.cost_categories?.name || '';
        const detailCategoryName = item.detail_cost_categories?.name || '';
        const location = item.detail_cost_categories?.location || '';
        const costCategoryFull = costCategoryName && detailCategoryName && location
          ? `${costCategoryName} / ${detailCategoryName} / ${location}`
          : '';

        return {
          ...item,
          cost_category_name: costCategoryName,
          detail_category_name: detailCategoryName,
          location: location,
          cost_category_full: costCategoryFull,
        };
      });

      setTemplates(formattedTemplates);
    } catch (error: any) {
      message.error('Ошибка загрузки шаблонов: ' + error.message);
    }
  };

  const fetchWorks = async () => {
    try {
      const { data, error } = await supabase
        .from('works_library')
        .select('*, work_names(name, unit)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        ...item,
        work_name: item.work_names?.name || '',
        unit: item.work_names?.unit || '',
      }));

      setWorks(formatted);
    } catch (error: any) {
      message.error('Ошибка загрузки работ: ' + error.message);
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials_library')
        .select('*, material_names(name, unit)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        ...item,
        material_name: item.material_names?.name || '',
        unit: item.material_names?.unit || '',
      }));

      setMaterials(formatted);
    } catch (error: any) {
      message.error('Ошибка загрузки материалов: ' + error.message);
    }
  };

  const fetchCostCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('detail_cost_categories')
        .select('*, cost_categories(name)')
        .order('order_num', { ascending: true });

      if (error) throw error;

      const options: CostCategoryOption[] = (data || []).map((item: any) => ({
        value: item.id,
        label: `${item.cost_categories?.name} / ${item.name} / ${item.location}`,
        cost_category_name: item.cost_categories?.name || '',
        location: item.location,
      }));

      setCostCategories(options);
    } catch (error: any) {
      message.error('Ошибка загрузки категорий затрат: ' + error.message);
    }
  };

  const handleAddWork = () => {
    if (!selectedWork) {
      message.warning('Выберите работу');
      return;
    }

    const work = works.find((w) => w.id === selectedWork);
    if (!work) return;

    // Получаем затрату шаблона
    const templateCostCategoryId = form.getFieldValue('detail_cost_category_id');
    const selectedCategory = costCategories.find(c => c.value === templateCostCategoryId);
    const categoryLabel = selectedCategory?.label || '';

    // Генерируем уникальный ID
    const newId = `temp-${Date.now()}-${tempIdCounter}`;
    setTempIdCounter(prev => prev + 1);

    const newItem: TemplateItemWithDetails = {
      id: newId,
      template_id: '',
      kind: 'work',
      work_library_id: work.id,
      material_library_id: null,
      parent_work_item_id: null,
      conversation_coeff: null,
      position: templateItems.length,
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      work_name: work.work_name,
      work_unit: work.unit,
      work_item_type: work.item_type,
      work_unit_rate: work.unit_rate,
      work_currency_type: work.currency_type,
      // Автоматически применяем затрату шаблона
      detail_cost_category_id: templateCostCategoryId || null,
      detail_cost_category_full: categoryLabel || undefined,
      manual_cost_override: false,
    };

    setTemplateItems([...templateItems, newItem]);
    setSelectedWork(null);
    setWorkSearchText('');
  };

  const handleAddMaterial = () => {
    if (!selectedMaterial) {
      message.warning('Выберите материал');
      return;
    }

    const material = materials.find((m) => m.id === selectedMaterial);
    if (!material) return;

    // Получаем затрату шаблона
    const templateCostCategoryId = form.getFieldValue('detail_cost_category_id');
    const selectedCategory = costCategories.find(c => c.value === templateCostCategoryId);
    const categoryLabel = selectedCategory?.label || '';

    // Генерируем уникальный ID
    const newId = `temp-${Date.now()}-${tempIdCounter}`;
    setTempIdCounter(prev => prev + 1);

    const newItem: TemplateItemWithDetails = {
      id: newId,
      template_id: '',
      kind: 'material',
      work_library_id: null,
      material_library_id: material.id,
      parent_work_item_id: null,
      conversation_coeff: null,
      position: templateItems.length,
      note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      material_name: material.material_name,
      material_unit: material.unit,
      material_item_type: material.item_type,
      material_type: material.material_type,
      material_consumption_coefficient: material.consumption_coefficient,
      material_unit_rate: material.unit_rate,
      material_currency_type: material.currency_type,
      material_delivery_price_type: material.delivery_price_type,
      material_delivery_amount: material.delivery_amount,
      // Автоматически применяем затрату шаблона
      detail_cost_category_id: templateCostCategoryId || null,
      detail_cost_category_full: categoryLabel || undefined,
      manual_cost_override: false,
    };

    setTemplateItems([...templateItems, newItem]);
    setSelectedMaterial(null);
    setMaterialSearchText('');
  };

  const handleDeleteItem = (id: string) => {
    const itemToDelete = templateItems.find(item => item.id === id);

    // Если удаляется работа, очистить привязку у всех материалов
    if (itemToDelete?.kind === 'work') {
      const updatedItems = templateItems
        .filter((item) => item.id !== id)
        .map((item) => {
          if (item.kind === 'material' && item.parent_work_item_id === id) {
            // Очистить привязку к удаляемой работе
            return {
              ...item,
              parent_work_item_id: null,
              conversation_coeff: null,
            };
          }
          return item;
        });
      setTemplateItems(updatedItems);
    } else {
      setTemplateItems(templateItems.filter((item) => item.id !== id));
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await form.validateFields();

      if (templateItems.length === 0) {
        message.warning('Добавьте хотя бы один элемент в шаблон');
        return;
      }

      // Проверка: материалы привязанные к работе должны иметь коэффициент перевода
      const invalidMaterials = templateItems.filter(
        item => item.kind === 'material' &&
        item.parent_work_item_id &&
        !item.conversation_coeff
      );

      if (invalidMaterials.length > 0) {
        message.error('Введите коэффициент перевода');
        return;
      }

      setLoading(true);

      // Создаем шаблон
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .insert({
          name: values.name,
          detail_cost_category_id: values.detail_cost_category_id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Сначала создаем работы и получаем их реальные UUID
      const workItems = templateItems.filter(item => item.kind === 'work');
      const materialItems = templateItems.filter(item => item.kind === 'material');

      // Маппинг временных ID на реальные UUID работ
      const tempIdToRealId: Record<string, string> = {};

      if (workItems.length > 0) {
        const worksToInsert = workItems.map((item, index) => ({
          template_id: templateData.id,
          kind: item.kind,
          work_library_id: item.work_library_id,
          material_library_id: null,
          parent_work_item_id: null,
          conversation_coeff: null,
          detail_cost_category_id: item.detail_cost_category_id || null,
          position: index,
          note: item.note,
        }));

        const { data: insertedWorks, error: worksError } = await supabase
          .from('template_items')
          .insert(worksToInsert)
          .select();

        if (worksError) throw worksError;

        // Создаем маппинг временных ID на реальные
        workItems.forEach((item, index) => {
          if (insertedWorks && insertedWorks[index]) {
            tempIdToRealId[item.id] = insertedWorks[index].id;
          }
        });
      }

      // Затем создаем материалы, заменяя временные ID на реальные
      if (materialItems.length > 0) {
        const materialsToInsert = materialItems.map((item, index) => ({
          template_id: templateData.id,
          kind: item.kind,
          work_library_id: null,
          material_library_id: item.material_library_id,
          parent_work_item_id: item.parent_work_item_id
            ? tempIdToRealId[item.parent_work_item_id] || null
            : null,
          conversation_coeff: item.conversation_coeff,
          detail_cost_category_id: item.detail_cost_category_id || null,
          position: workItems.length + index,
          note: item.note,
        }));

        const { error: materialsError } = await supabase
          .from('template_items')
          .insert(materialsToInsert);

        if (materialsError) throw materialsError;
      }

      message.success('Шаблон успешно создан');
      form.resetFields();
      setTemplateItems([]);
      setWorkSearchText('');
      setMaterialSearchText('');
      setCostCategorySearchText('');
      setSelectedWork(null);
      setSelectedMaterial(null);
      setTempIdCounter(0);
      fetchTemplates();
      fetchAllTemplateItems();
    } catch (error: any) {
      message.error('Ошибка создания шаблона: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setTemplateItems([]);
    setWorkSearchText('');
    setMaterialSearchText('');
    setCostCategorySearchText('');
    setSelectedWork(null);
    setSelectedMaterial(null);
    setTempIdCounter(0);
  };

  const fetchAllTemplateItems = async () => {
    try {
      const { data, error } = await supabase
        .from('template_items')
        .select(`
          *,
          works_library:work_library_id(*, work_names(name, unit)),
          materials_library:material_library_id(*, material_names(name, unit)),
          detail_cost_categories:detail_cost_category_id(name, location, cost_categories(name))
        `)
        .order('position');

      if (error) throw error;

      // Группируем элементы по template_id
      const itemsByTemplate: Record<string, TemplateItemWithDetails[]> = {};

      (data || []).forEach((item: any) => {
        if (!itemsByTemplate[item.template_id]) {
          itemsByTemplate[item.template_id] = [];
        }

        // Найти название родительской работы
        let parentWorkName = undefined;
        if (item.parent_work_item_id) {
          const parentWork = (data || []).find((i: any) => i.id === item.parent_work_item_id);
          parentWorkName = parentWork?.works_library?.work_names?.name;
        }

        // Сформировать полное название затраты на строительство
        let detailCostCategoryFull = undefined;
        if (item.detail_cost_categories) {
          const categoryName = item.detail_cost_categories.cost_categories?.name || '';
          const detailName = item.detail_cost_categories.name || '';
          const location = item.detail_cost_categories.location || '';
          detailCostCategoryFull = `${categoryName} / ${detailName} / ${location}`;
        }

        const formatted: TemplateItemWithDetails = {
          ...item,
          work_name: item.works_library?.work_names?.name,
          work_unit: item.works_library?.work_names?.unit,
          work_item_type: item.works_library?.item_type,
          work_unit_rate: item.works_library?.unit_rate,
          work_currency_type: item.works_library?.currency_type,
          material_name: item.materials_library?.material_names?.name,
          material_unit: item.materials_library?.material_names?.unit,
          material_item_type: item.materials_library?.item_type,
          material_type: item.materials_library?.material_type,
          material_consumption_coefficient: item.materials_library?.consumption_coefficient,
          material_unit_rate: item.materials_library?.unit_rate,
          material_currency_type: item.materials_library?.currency_type,
          material_delivery_price_type: item.materials_library?.delivery_price_type,
          material_delivery_amount: item.materials_library?.delivery_amount,
          parent_work_name: parentWorkName,
          detail_cost_category_name: item.detail_cost_categories?.name,
          detail_cost_category_full: detailCostCategoryFull,
        };

        itemsByTemplate[item.template_id].push(formatted);
      });

      setLoadedTemplateItems(itemsByTemplate);
    } catch (error: any) {
      message.error('Ошибка загрузки элементов шаблонов: ' + error.message);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      message.success('Шаблон удален');
      fetchTemplates();
      fetchAllTemplateItems();
    } catch (error: any) {
      message.error('Ошибка удаления шаблона: ' + error.message);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template.id);
    editingTemplateForm.setFieldsValue({
      name: template.name,
      detail_cost_category_id: template.detail_cost_category_id,
    });
    // Найти текст категории затрат
    const category = costCategories.find(c => c.value === template.detail_cost_category_id);
    if (category) {
      setEditingTemplateCostCategorySearchText(category.label);
    }
    // Копировать элементы шаблона для редактирования
    const items = loadedTemplateItems[template.id] || [];
    setEditingItems([...items]);
  };

  const handleCancelEditTemplate = () => {
    setEditingTemplate(null);
    editingTemplateForm.resetFields();
    setEditingTemplateCostCategorySearchText('');
    setEditingItems([]);
  };

  const handleSaveEditTemplate = async (templateId: string) => {
    try {
      const values = await editingTemplateForm.validateFields();

      // Обновить заголовок шаблона
      const { error: templateError } = await supabase
        .from('templates')
        .update({
          name: values.name,
          detail_cost_category_id: values.detail_cost_category_id,
        })
        .eq('id', templateId);

      if (templateError) throw templateError;

      // Обновить все элементы шаблона
      for (const item of editingItems) {
        const { error: itemError } = await supabase
          .from('template_items')
          .update({
            parent_work_item_id: item.parent_work_item_id,
            conversation_coeff: item.conversation_coeff,
            detail_cost_category_id: item.detail_cost_category_id,
          })
          .eq('id', item.id);

        if (itemError) throw itemError;
      }

      message.success('Шаблон обновлен');
      setEditingTemplate(null);
      editingTemplateForm.resetFields();
      setEditingTemplateCostCategorySearchText('');
      setEditingItems([]);
      // Сохраняем открытый шаблон
      setOpenedTemplate(templateId);
      fetchTemplates();
      // Перезагрузить все элементы шаблонов
      fetchAllTemplateItems();
    } catch (error: any) {
      message.error('Ошибка обновления шаблона: ' + error.message);
    }
  };

  const handleUpdateItemCoeff = (id: string, value: number | null, templateId?: string) => {
    if (editingTemplate) {
      // Режим редактирования сохраненного шаблона
      setEditingItems(
        editingItems.map((item) =>
          item.id === id ? { ...item, conversation_coeff: value } : item
        )
      );
    } else if (templateId) {
      // Режим добавления элементов в существующий шаблон (когда есть templateId)
      setLoadedTemplateItems(prev => ({
        ...prev,
        [templateId]: (prev[templateId] || []).map((item) =>
          item.id === id ? { ...item, conversation_coeff: value } : item
        ),
      }));
    } else {
      // Режим создания нового шаблона (когда templateId = undefined)
      setTemplateItems(
        templateItems.map((item) =>
          item.id === id ? { ...item, conversation_coeff: value } : item
        )
      );
    }
  };

  const handleUpdateItemParent = (id: string, parentId: string | null, templateId?: string) => {
    if (editingTemplate) {
      // Режим редактирования сохраненного шаблона
      setEditingItems(
        editingItems.map((item) =>
          item.id === id ? { ...item, parent_work_item_id: parentId } : item
        )
      );
    } else if (templateId) {
      // Режим добавления элементов в существующий шаблон (когда есть templateId)
      setLoadedTemplateItems(prev => ({
        ...prev,
        [templateId]: (prev[templateId] || []).map((item) =>
          item.id === id ? { ...item, parent_work_item_id: parentId } : item
        ),
      }));
    } else {
      // Режим создания нового шаблона (когда templateId = undefined)
      setTemplateItems(
        templateItems.map((item) =>
          item.id === id ? { ...item, parent_work_item_id: parentId } : item
        )
      );
    }
  };

  const handleAddWorkToTemplate = async (templateId: string) => {
    if (!editingSelectedWork) {
      message.warning('Выберите работу');
      return;
    }

    try {
      const work = works.find((w) => w.id === editingSelectedWork);
      if (!work) return;

      const currentItems = loadedTemplateItems[templateId] || [];
      const newPosition = currentItems.length;

      const { data, error } = await supabase
        .from('template_items')
        .insert({
          template_id: templateId,
          kind: 'work',
          work_library_id: work.id,
          material_library_id: null,
          parent_work_item_id: null,
          conversation_coeff: null,
          position: newPosition,
          note: null,
        })
        .select(`
          *,
          works_library:work_library_id(*, work_names(name, unit)),
          detail_cost_categories:detail_cost_category_id(name, location, cost_categories(name))
        `)
        .single();

      if (error) throw error;

      // Добавить новый элемент в кеш вместо полной перезагрузки
      if (data) {
        const newItem: TemplateItemWithDetails = {
          ...data,
          work_name: data.works_library?.work_names?.name,
          work_unit: data.works_library?.work_names?.unit,
          work_item_type: data.works_library?.item_type,
          work_unit_rate: data.works_library?.unit_rate,
          work_currency_type: data.works_library?.currency_type,
        };

        setLoadedTemplateItems(prev => ({
          ...prev,
          [templateId]: [...currentItems, newItem],
        }));
      }

      message.success('Работа добавлена');
      setEditingSelectedWork(null);
      setEditingWorkSearchText('');
    } catch (error: any) {
      message.error('Ошибка добавления работы: ' + error.message);
    }
  };

  const handleAddMaterialToTemplate = async (templateId: string) => {
    if (!editingSelectedMaterial) {
      message.warning('Выберите материал');
      return;
    }

    try {
      const material = materials.find((m) => m.id === editingSelectedMaterial);
      if (!material) return;

      const currentItems = loadedTemplateItems[templateId] || [];
      const newPosition = currentItems.length;

      const { data, error } = await supabase
        .from('template_items')
        .insert({
          template_id: templateId,
          kind: 'material',
          work_library_id: null,
          material_library_id: material.id,
          parent_work_item_id: null,
          conversation_coeff: null,
          position: newPosition,
          note: null,
        })
        .select(`
          *,
          materials_library:material_library_id(*, material_names(name, unit)),
          detail_cost_categories:detail_cost_category_id(name, location, cost_categories(name))
        `)
        .single();

      if (error) throw error;

      // Добавить новый элемент в кеш вместо полной перезагрузки
      if (data) {
        const newItem: TemplateItemWithDetails = {
          ...data,
          material_name: data.materials_library?.material_names?.name,
          material_unit: data.materials_library?.material_names?.unit,
          material_item_type: data.materials_library?.item_type,
          material_type: data.materials_library?.material_type,
          material_consumption_coefficient: data.materials_library?.consumption_coefficient,
          material_unit_rate: data.materials_library?.unit_rate,
          material_currency_type: data.materials_library?.currency_type,
          material_delivery_price_type: data.materials_library?.delivery_price_type,
          material_delivery_amount: data.materials_library?.delivery_amount,
        };

        setLoadedTemplateItems(prev => ({
          ...prev,
          [templateId]: [...currentItems, newItem],
        }));
      }

      message.success('Материал добавлен');
      setEditingSelectedMaterial(null);
      setEditingMaterialSearchText('');
    } catch (error: any) {
      message.error('Ошибка добавления материала: ' + error.message);
    }
  };

  const handleDeleteTemplateItem = async (templateId: string, itemId: string) => {
    try {
      const currentItems = loadedTemplateItems[templateId] || [];
      const itemToDelete = currentItems.find(item => item.id === itemId);

      // Если удаляется работа, сначала очистить привязку у всех материалов
      if (itemToDelete?.kind === 'work') {
        const linkedMaterials = currentItems.filter(
          item => item.kind === 'material' && item.parent_work_item_id === itemId
        );

        // Обновить привязанные материалы в базе данных
        for (const material of linkedMaterials) {
          const { error: updateError } = await supabase
            .from('template_items')
            .update({
              parent_work_item_id: null,
              conversation_coeff: null,
            })
            .eq('id', material.id);

          if (updateError) throw updateError;
        }
      }

      // Удалить саму работу/материал
      const { error } = await supabase
        .from('template_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      message.success('Элемент удален');

      // Обновить кеш: удалить элемент и очистить привязки у материалов
      setLoadedTemplateItems(prev => {
        const items = prev[templateId] || [];
        const updatedItems = items
          .filter(item => item.id !== itemId)
          .map(item => {
            if (item.kind === 'material' && item.parent_work_item_id === itemId) {
              return {
                ...item,
                parent_work_item_id: null,
                conversation_coeff: null,
              };
            }
            return item;
          });

        return {
          ...prev,
          [templateId]: updatedItems,
        };
      });
    } catch (error: any) {
      message.error('Ошибка удаления элемента: ' + error.message);
    }
  };

  const costCategoryOptions = costCategories
    .filter((c) => c.label.toLowerCase().includes(costCategorySearchText.toLowerCase()))
    .map((c) => ({
      value: c.label,
      id: c.value,
      label: c.label,
    }));

  // Функция для получения опций затрат с фильтрацией по тексту
  const getCostCategoryOptions = (searchText: string) => {
    return costCategories
      .filter((c) => c.label.toLowerCase().includes(searchText.toLowerCase()))
      .map((c) => ({
        value: c.label,
        id: c.value,
        label: c.label,
      }));
  };

  const workOptions = works
    .filter((w) => w.work_name.toLowerCase().includes(workSearchText.toLowerCase()))
    .map((w) => ({
      value: `${w.work_name} (${w.unit})`,
      id: w.id,
      label: `${w.work_name} (${w.unit})`,
    }));

  const materialOptions = materials
    .filter((m) => m.material_name.toLowerCase().includes(materialSearchText.toLowerCase()))
    .map((m) => ({
      value: `${m.material_name} (${m.unit})`,
      id: m.id,
      label: `${m.material_name} (${m.unit})`,
    }));

  // Row color coding by item_type
  const getRowClassName = (record: TemplateItemWithDetails) => {
    const itemType = record.kind === 'work' ? record.work_item_type : record.material_item_type;

    if (record.kind === 'work') {
      switch (itemType) {
        case 'раб':
          return 'template-row-rab';
        case 'суб-раб':
          return 'template-row-sub-rab';
        case 'раб-комп.':
          return 'template-row-rab-comp';
        default:
          return '';
      }
    } else {
      switch (itemType) {
        case 'мат':
          return 'template-row-mat';
        case 'суб-мат':
          return 'template-row-sub-mat';
        case 'мат-комп.':
          return 'template-row-mat-comp';
        default:
          return '';
      }
    }
  };

  const getColumns = (
    isCreating: boolean = false,
    currentItems: TemplateItemWithDetails[] = [],
    templateId?: string,
    isEditing: boolean = false,
    isAddingItems: boolean = false
  ) => {
    const workItemsForSelect = currentItems.filter((item) => item.kind === 'work');

    return [
      {
        title: 'Вид',
        key: 'item_type',
        width: 100,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) => {
          const itemType = record.kind === 'work' ? record.work_item_type : record.material_item_type;
          if (!itemType) return '-';

          let bgColor = '';
          let textColor = '';
          if (record.kind === 'work') {
            switch (itemType) {
              case 'раб':
                bgColor = 'rgba(239, 108, 0, 0.12)';
                textColor = '#f57c00';
                break;
              case 'суб-раб':
                bgColor = 'rgba(106, 27, 154, 0.12)';
                textColor = '#7b1fa2';
                break;
              case 'раб-комп.':
                bgColor = 'rgba(198, 40, 40, 0.12)';
                textColor = '#d32f2f';
                break;
            }
          } else {
            switch (itemType) {
              case 'мат':
                bgColor = 'rgba(21, 101, 192, 0.12)';
                textColor = '#1976d2';
                break;
              case 'суб-мат':
                bgColor = 'rgba(104, 159, 56, 0.12)';
                textColor = '#7cb342';
                break;
              case 'мат-комп.':
                bgColor = 'rgba(0, 105, 92, 0.12)';
                textColor = '#00897b';
                break;
            }
          }

          // Для материалов показываем тип материала под видом
          const materialType = record.kind === 'material' ? record.material_type : null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Tag style={{ backgroundColor: bgColor, color: textColor, border: 'none', margin: 0 }}>{itemType}</Tag>
              {materialType && (
                <Tag
                  style={{
                    backgroundColor: materialType === 'основн.' ? 'rgba(255, 152, 0, 0.12)' : 'rgba(21, 101, 192, 0.12)',
                    color: materialType === 'основн.' ? '#fb8c00' : '#1976d2',
                    border: 'none',
                    margin: 0,
                    fontSize: 11,
                  }}
                >
                  {materialType}
                </Tag>
              )}
            </div>
          );
        },
      },
      {
        title: 'Наименование',
        key: 'name',
        width: 220,
        align: 'center' as const,
        editable: true,
        render: (record: TemplateItemWithDetails) => {
          if (isCreating || isEditing || isAddingItems) {
            // Режим создания/редактирования шаблона или добавления элементов
            return (
              <div style={{ textAlign: 'left' }}>
                <div>{record.kind === 'work' ? record.work_name : record.material_name}</div>
                {record.kind === 'material' && (
                  <Select
                    value={record.parent_work_item_id}
                    onChange={(value) => handleUpdateItemParent(record.id, value, templateId)}
                    placeholder="Привязка к работе"
                    allowClear
                    style={{ width: '100%', marginTop: 4 }}
                    size="small"
                  >
                    {workItemsForSelect.map((work) => (
                      <Select.Option key={work.id} value={work.id}>
                        <LinkOutlined style={{ marginRight: 4 }} />
                        {work.work_name}
                      </Select.Option>
                    ))}
                  </Select>
                )}
              </div>
            );
          } else {
            // Режим просмотра
            return (
              <div style={{ textAlign: 'left' }}>
                <div>{record.kind === 'work' ? record.work_name : record.material_name}</div>
                {record.kind === 'material' && record.parent_work_name && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    <LinkOutlined style={{ marginRight: 4 }} />
                    {record.parent_work_name}
                  </div>
                )}
              </div>
            );
          }
        },
      },
      {
        title: 'Ед.изм',
        key: 'unit',
        width: 70,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) =>
          record.kind === 'work' ? record.work_unit : record.material_unit,
      },
      // Коэф. перевода - ПЕРЕМЕЩЕН ПЕРЕД коэфф. расхода
      {
        title: 'Коэф.перев.',
        key: 'conversation_coeff',
        width: 100,
        align: 'center' as const,
        editable: true,
        render: (record: TemplateItemWithDetails) => {
          if (record.kind === 'work') return '-';

          if (isCreating || isEditing || isAddingItems) {
            return (
              <InputNumber
                value={record.conversation_coeff}
                onChange={(value) => handleUpdateItemCoeff(record.id, value, templateId)}
                placeholder="0.0000"
                precision={4}
                style={{ width: '100%' }}
                disabled={!record.parent_work_item_id}
              />
            );
          } else {
            return record.conversation_coeff ? record.conversation_coeff.toFixed(4) : '-';
          }
        },
      },
      // Для материалов - коэфф. расхода из библиотеки
      {
        title: 'Коэф.расх.',
        key: 'consumption_coefficient',
        width: 90,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) => {
          if (record.kind === 'work') return '-';
          return record.material_consumption_coefficient
            ? record.material_consumption_coefficient.toFixed(4)
            : '-';
        },
      },
      {
        title: 'Цена',
        key: 'unit_rate',
        width: 80,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) => {
          const rate = record.kind === 'work' ? record.work_unit_rate : record.material_unit_rate;
          return rate ? rate.toFixed(2) : '-';
        },
      },
      {
        title: 'Вал.',
        key: 'currency_type',
        width: 60,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) => {
          const currency = record.kind === 'work' ? record.work_currency_type : record.material_currency_type;
          return currency ? currencySymbols[currency] || currency : '-';
        },
      },
      // Для материалов - тип доставки
      {
        title: 'Тип дост.',
        key: 'delivery_price_type',
        width: 90,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) => {
          if (record.kind === 'work') return '-';
          return record.material_delivery_price_type || '-';
        },
      },
      // Для материалов - сумма доставки
      {
        title: 'Сумма дост.',
        key: 'delivery_amount',
        width: 90,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) => {
          if (record.kind === 'work') return '-';
          if (record.material_delivery_price_type === 'суммой') {
            return record.material_delivery_amount ? record.material_delivery_amount.toFixed(2) : '0.00';
          }
          return '-';
        },
      },
      // Затрата на строительство
      {
        title: 'Затрата на стр-во',
        key: 'detail_cost_category',
        width: 200,
        align: 'center' as const,
        editable: true,
        render: (record: TemplateItemWithDetails) => {
          if (isCreating || isEditing || isAddingItems) {
            // Получаем опции динамически на основе текущего значения поля
            const currentSearchText = record.detail_cost_category_full || '';
            const dynamicOptions = getCostCategoryOptions(currentSearchText);

            return (
              <AutoComplete
                value={record.detail_cost_category_full || ''}
                onChange={(value) => {
                  // Update search text
                  const updatedItems = currentItems.map((item) => {
                    if (item.id === record.id) {
                      return { ...item, detail_cost_category_full: value };
                    }
                    return item;
                  });
                  if (isEditing) {
                    setEditingItems(updatedItems);
                  } else if (templateId) {
                    // Добавление элементов в существующий шаблон
                    setLoadedTemplateItems(prev => ({
                      ...prev,
                      [templateId]: updatedItems,
                    }));
                  } else {
                    // Создание нового шаблона
                    setTemplateItems(updatedItems);
                  }
                }}
                onSelect={(_value, option: any) => {
                  const updatedItems = currentItems.map((item) => {
                    if (item.id === record.id) {
                      return {
                        ...item,
                        detail_cost_category_id: option.id,
                        detail_cost_category_full: option.label,
                        manual_cost_override: true, // Помечаем что затрата изменена вручную
                      };
                    }
                    return item;
                  });
                  if (isEditing) {
                    setEditingItems(updatedItems);
                  } else if (templateId) {
                    // Добавление элементов в существующий шаблон
                    setLoadedTemplateItems(prev => ({
                      ...prev,
                      [templateId]: updatedItems,
                    }));
                  } else {
                    // Создание нового шаблона
                    setTemplateItems(updatedItems);
                  }
                }}
                onClear={() => {
                  // Очистить затрату элемента
                  const updatedItems = currentItems.map((item) => {
                    if (item.id === record.id) {
                      return {
                        ...item,
                        detail_cost_category_id: null,
                        detail_cost_category_full: undefined,
                        manual_cost_override: true, // Помечаем что затрата изменена вручную
                      };
                    }
                    return item;
                  });
                  if (isEditing) {
                    setEditingItems(updatedItems);
                  } else if (templateId) {
                    // Добавление элементов в существующий шаблон
                    setLoadedTemplateItems(prev => ({
                      ...prev,
                      [templateId]: updatedItems,
                    }));
                  } else {
                    // Создание нового шаблона
                    setTemplateItems(updatedItems);
                  }
                }}
                options={dynamicOptions}
                placeholder="Выберите затрату"
                style={{ width: '100%' }}
                size="small"
                filterOption={false}
                allowClear
                popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
              />
            );
          } else {
            return record.detail_cost_category_full || '-';
          }
        },
      },
      {
        title: 'Действия',
        key: 'actions',
        width: 100,
        align: 'center' as const,
        render: (record: TemplateItemWithDetails) => {
          if (isCreating || isEditing || isAddingItems) {
            // Режим создания/редактирования шаблона или добавления элементов
            return (
              <Popconfirm
                title="Удалить элемент?"
                onConfirm={() => isCreating ? handleDeleteItem(record.id) : handleDeleteTemplateItem(templateId!, record.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            );
          }

          if (templateId) {
            // Режим просмотра сохраненного шаблона - только кнопка удаления
            return (
              <Popconfirm
                title="Удалить элемент?"
                onConfirm={() => handleDeleteTemplateItem(templateId, record.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            );
          }

          return null;
        },
      },
    ];
  };

  // Фильтрация шаблонов
  const filteredTemplates = templates.filter((template) => {
    // Фильтр по наименованию (от 2 символов)
    if (templateSearchText.length >= 2) {
      if (!template.name.toLowerCase().includes(templateSearchText.toLowerCase())) {
        return false;
      }
    }

    // Фильтр по категории затрат
    if (filterCostCategory) {
      if (template.cost_category_name !== filterCostCategory) {
        return false;
      }
    }

    // Фильтр по детализации затрат
    if (filterDetailCategory) {
      if (template.detail_category_name !== filterDetailCategory) {
        return false;
      }
    }

    return true;
  });

  // Получаем уникальные категории и детализации для фильтров
  const uniqueCostCategories = Array.from(new Set(templates.map(t => t.cost_category_name).filter(Boolean)));
  const uniqueDetailCategories = Array.from(new Set(templates.map(t => t.detail_category_name).filter(Boolean)));

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Список шаблонов',
            children: (
              <Card>
                <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <AutoComplete
                        placeholder="Поиск по названию (мин. 2 символа)..."
                        value={templateSearchText}
                        onChange={(value) => setTemplateSearchText(value)}
                        options={templates
                          .filter((t) =>
                            !templateSearchText ||
                            templateSearchText.length < 2 ||
                            t.name.toLowerCase().includes(templateSearchText.toLowerCase())
                          )
                          .map((t) => ({
                            value: t.name,
                            label: t.name,
                          }))}
                        allowClear
                        style={{ width: '100%' }}
                        filterOption={false}
                        popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                      />
                    </Col>
                    <Col span={8}>
                      <AutoComplete
                        placeholder="Категория затрат (начните вводить...)"
                        value={filterCostCategory || undefined}
                        onChange={(value) => {
                          // Если значение пустое, сбрасываем фильтр
                          if (!value) {
                            setFilterCostCategory(null);
                          }
                        }}
                        onSelect={(value) => {
                          setFilterCostCategory(value);
                        }}
                        options={uniqueCostCategories
                          .filter((category) =>
                            category && (!filterCostCategory || category.toLowerCase().includes(filterCostCategory.toLowerCase()))
                          )
                          .map((category) => ({
                            value: category!,
                            label: category!,
                          }))}
                        allowClear
                        style={{ width: '100%' }}
                        filterOption={false}
                        popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                      />
                    </Col>
                    <Col span={8}>
                      <AutoComplete
                        placeholder="Детализация затрат (начните вводить...)"
                        value={filterDetailCategory || undefined}
                        onChange={(value) => {
                          // Если значение пустое, сбрасываем фильтр
                          if (!value) {
                            setFilterDetailCategory(null);
                          }
                        }}
                        onSelect={(value) => {
                          setFilterDetailCategory(value);
                        }}
                        options={uniqueDetailCategories
                          .filter((detail) =>
                            detail && (!filterDetailCategory || detail.toLowerCase().includes(filterDetailCategory.toLowerCase()))
                          )
                          .map((detail) => ({
                            value: detail!,
                            label: detail!,
                          }))}
                        allowClear
                        style={{ width: '100%' }}
                        filterOption={false}
                        popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                      />
                    </Col>
                  </Row>
                </Space>

                <Collapse
                  accordion
                  activeKey={openedTemplate || undefined}
                  onChange={(key) => {
                    const templateId = typeof key === 'string' ? key : (Array.isArray(key) && key.length > 0 ? key[0] : null);
                    setOpenedTemplate(templateId);
                  }}
                >
                  {filteredTemplates.map((template) => {
                    const items = loadedTemplateItems[template.id] || [];
                    const worksCount = items.filter(i => i.kind === 'work').length;
                    const materialsCount = items.filter(i => i.kind === 'material').length;

                    return (
                      <Panel
                        header={
                          editingTemplate === template.id ? (
                            <Form
                              form={editingTemplateForm}
                              layout="inline"
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: '100%' }}
                            >
                              <Form.Item
                                name="name"
                                rules={[{ required: true, message: 'Введите название' }]}
                                style={{ flex: 1, marginRight: 8 }}
                              >
                                <Input placeholder="Название шаблона" />
                              </Form.Item>
                              <Form.Item style={{ flex: 1, marginRight: 8 }}>
                                <AutoComplete
                                  options={costCategories
                                    .filter((c) => c.label.toLowerCase().includes(editingTemplateCostCategorySearchText.toLowerCase()))
                                    .map((c) => ({
                                      value: c.label,
                                      id: c.value,
                                      label: c.label,
                                    }))}
                                  placeholder="Затрата на строительство..."
                                  value={editingTemplateCostCategorySearchText}
                                  onChange={setEditingTemplateCostCategorySearchText}
                                  onSelect={(value, option: any) => {
                                    setEditingTemplateCostCategorySearchText(value);
                                    editingTemplateForm.setFieldValue('detail_cost_category_id', option.id);

                                    // Автоматически применяем затрату ко всем элементам (кроме тех, где manual_cost_override = true)
                                    const updatedItems = editingItems.map((item) => {
                                      if (!item.manual_cost_override) {
                                        return {
                                          ...item,
                                          detail_cost_category_id: option.id,
                                          detail_cost_category_full: option.label,
                                        };
                                      }
                                      return item;
                                    });
                                    setEditingItems(updatedItems);
                                  }}
                                  onClear={() => {
                                    setEditingTemplateCostCategorySearchText('');
                                    editingTemplateForm.setFieldValue('detail_cost_category_id', null);

                                    // Очистить затрату у всех элементов (кроме тех, где manual_cost_override = true)
                                    const updatedItems = editingItems.map((item) => {
                                      if (!item.manual_cost_override) {
                                        return {
                                          ...item,
                                          detail_cost_category_id: null,
                                          detail_cost_category_full: undefined,
                                        };
                                      }
                                      return item;
                                    });
                                    setEditingItems(updatedItems);
                                  }}
                                  filterOption={false}
                                  showSearch
                                  allowClear
                                  style={{ width: '100%' }}
                                  popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                                />
                                <Form.Item
                                  name="detail_cost_category_id"
                                  noStyle
                                  rules={[{ required: true, message: 'Выберите затрату' }]}
                                >
                                  <Input type="hidden" />
                                </Form.Item>
                              </Form.Item>
                              <Space>
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<SaveOutlined />}
                                  onClick={() => handleSaveEditTemplate(template.id)}
                                />
                                <Button
                                  size="small"
                                  icon={<CloseOutlined />}
                                  onClick={handleCancelEditTemplate}
                                />
                              </Space>
                            </Form>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Space direction="vertical" size={0}>
                                <div>
                                  <Text strong>{template.name}</Text>
                                  {template.cost_category_full && (
                                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                      ({template.cost_category_full})
                                    </Text>
                                  )}
                                </div>
                                {items.length > 0 && (
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    Работ: {worksCount} | Материалов: {materialsCount}
                                  </Text>
                                )}
                              </Space>
                              <Space onClick={(e) => e.stopPropagation()}>
                                <Tooltip title="Добавить работы/материалы в шаблон">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<AppstoreAddOutlined />}
                                    onClick={() => {
                                      if (editingTemplateItems === template.id) {
                                        setEditingTemplateItems(null);
                                        setEditingWorkSearchText('');
                                        setEditingMaterialSearchText('');
                                        setEditingSelectedWork(null);
                                        setEditingSelectedMaterial(null);
                                      } else {
                                        setEditingTemplateItems(template.id);
                                      }
                                    }}
                                    style={{
                                      color: editingTemplateItems === template.id ? '#1890ff' : undefined
                                    }}
                                  />
                                </Tooltip>
                                <Tooltip title="Редактировать шаблон">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEditTemplate(template)}
                                  />
                                </Tooltip>
                                <Popconfirm
                                  title="Удалить шаблон?"
                                  onConfirm={() => handleDeleteTemplate(template.id)}
                                  okText="Да"
                                  cancelText="Нет"
                                >
                                  <Tooltip title="Удалить шаблон">
                                    <Button
                                      type="text"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                    />
                                  </Tooltip>
                                </Popconfirm>
                              </Space>
                            </div>
                          )
                        }
                        key={template.id}
                      >
                        {items.length > 0 ? (
                          <>
                            {editingTemplateItems === template.id && (
                              <Row gutter={16} style={{ marginBottom: 16 }}>
                                <Col span={12}>
                                  <Space.Compact style={{ width: '100%' }}>
                                    <AutoComplete
                                      style={{ width: '100%' }}
                                      options={works
                                        .filter((w) => w.work_name.toLowerCase().includes(editingWorkSearchText.toLowerCase()))
                                        .map((w) => ({
                                          value: `${w.work_name} (${w.unit})`,
                                          id: w.id,
                                          label: `${w.work_name} (${w.unit})`,
                                        }))}
                                      value={editingWorkSearchText}
                                      onChange={setEditingWorkSearchText}
                                      onSelect={(value, option: any) => {
                                        setEditingWorkSearchText(value);
                                        setEditingSelectedWork(option.id);
                                      }}
                                      placeholder="Введите работу (2+ символа)..."
                                      filterOption={false}
                                      popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                                    />
                                    <Button
                                      type="primary"
                                      icon={<PlusOutlined />}
                                      onClick={() => handleAddWorkToTemplate(template.id)}
                                    />
                                  </Space.Compact>
                                </Col>

                                <Col span={12}>
                                  <Space.Compact style={{ width: '100%' }}>
                                    <AutoComplete
                                      style={{ width: '100%' }}
                                      options={materials
                                        .filter((m) => m.material_name.toLowerCase().includes(editingMaterialSearchText.toLowerCase()))
                                        .map((m) => ({
                                          value: `${m.material_name} (${m.unit})`,
                                          id: m.id,
                                          label: `${m.material_name} (${m.unit})`,
                                        }))}
                                      value={editingMaterialSearchText}
                                      onChange={setEditingMaterialSearchText}
                                      onSelect={(value, option: any) => {
                                        setEditingMaterialSearchText(value);
                                        setEditingSelectedMaterial(option.id);
                                      }}
                                      placeholder="Введите материал (2+ символа)..."
                                      filterOption={false}
                                      popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                                    />
                                    <Button
                                      type="primary"
                                      icon={<PlusOutlined />}
                                      onClick={() => handleAddMaterialToTemplate(template.id)}
                                    />
                                  </Space.Compact>
                                </Col>
                              </Row>
                            )}

                            <Table
                              dataSource={editingTemplate === template.id ? editingItems : items}
                              columns={getColumns(
                                false,
                                editingTemplate === template.id ? editingItems : items,
                                template.id,
                                editingTemplate === template.id,
                                editingTemplateItems === template.id
                              )}
                              rowKey="id"
                              rowClassName={getRowClassName}
                              pagination={false}
                              size="small"
                            />
                          </>
                        ) : (
                          <Text type="secondary">Загрузка...</Text>
                        )}
                      </Panel>
                    );
                  })}
                </Collapse>

                {filteredTemplates.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Text type="secondary">
                      {templates.length === 0 ? 'Нет созданных шаблонов' : 'Нет шаблонов, соответствующих критериям поиска'}
                    </Text>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'create',
            label: 'Создание шаблона',
            children: (
              <Card>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Название шаблона"
                name="name"
                rules={[
                  { required: true, message: 'Введите название шаблона' },
                  { max: 100, message: 'Максимум 100 символов' },
                ]}
              >
                <Input
                  placeholder="Например: Монтаж металлоконструкций"
                  maxLength={100}
                  showCount
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Затрата на строительство"
                required
              >
                <AutoComplete
                  options={costCategoryOptions}
                  placeholder="Начните вводить для поиска..."
                  value={costCategorySearchText}
                  onChange={setCostCategorySearchText}
                  onSelect={(value, option: any) => {
                    setCostCategorySearchText(value);
                    form.setFieldValue('detail_cost_category_id', option.id);

                    // Автоматически применяем затрату ко всем элементам (кроме тех, где manual_cost_override = true)
                    const updatedItems = templateItems.map((item) => {
                      if (!item.manual_cost_override) {
                        return {
                          ...item,
                          detail_cost_category_id: option.id,
                          detail_cost_category_full: option.label,
                        };
                      }
                      return item;
                    });
                    setTemplateItems(updatedItems);
                  }}
                  onClear={() => {
                    setCostCategorySearchText('');
                    form.setFieldValue('detail_cost_category_id', null);

                    // Очистить затрату у всех элементов (кроме тех, где manual_cost_override = true)
                    const updatedItems = templateItems.map((item) => {
                      if (!item.manual_cost_override) {
                        return {
                          ...item,
                          detail_cost_category_id: null,
                          detail_cost_category_full: undefined,
                        };
                      }
                      return item;
                    });
                    setTemplateItems(updatedItems);
                  }}
                  filterOption={false}
                  showSearch
                  allowClear
                  popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                />
                <Form.Item
                  name="detail_cost_category_id"
                  noStyle
                  rules={[{ required: true, message: 'Выберите затрату на строительство' }]}
                >
                  <Input type="hidden" />
                </Form.Item>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="center" style={{ color: '#1890ff' }}>
            Добавление работ и материалов
          </Divider>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Space.Compact style={{ width: '100%' }}>
                <AutoComplete
                  style={{ width: '100%' }}
                  options={workOptions}
                  value={workSearchText}
                  onChange={setWorkSearchText}
                  onSelect={(value, option: any) => {
                    setWorkSearchText(value);
                    setSelectedWork(option.id);
                  }}
                  placeholder="Введите работу (2+ символа)..."
                  filterOption={false}
                  popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddWork}
                />
              </Space.Compact>
            </Col>

            <Col span={12}>
              <Space.Compact style={{ width: '100%' }}>
                <AutoComplete
                  style={{ width: '100%' }}
                  options={materialOptions}
                  value={materialSearchText}
                  onChange={setMaterialSearchText}
                  onSelect={(value, option: any) => {
                    setMaterialSearchText(value);
                    setSelectedMaterial(option.id);
                  }}
                  placeholder="Введите материал (2+ символа)..."
                  filterOption={false}
                  popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : ''}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddMaterial}
                />
              </Space.Compact>
            </Col>
          </Row>

          <Divider orientation="center" style={{ color: '#1890ff' }}>
            Элементы шаблона
          </Divider>

          <Table
            dataSource={templateItems}
            columns={getColumns(true, templateItems)}
            rowKey="id"
            rowClassName={getRowClassName}
            pagination={false}
            locale={{ emptyText: 'Нет данных' }}
            style={{ marginBottom: 16 }}
          />

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveTemplate}
              loading={loading}
            >
              Сохранить шаблон
            </Button>
            <Button icon={<CloseOutlined />} onClick={handleCancel}>
              Отмена
            </Button>
          </Space>
        </Form>
              </Card>
            ),
          },
        ]}
      />

      {/* CSS for row colors */}
      <style>{`
        .template-row-rab {
          background-color: rgba(255, 152, 0, 0.15) !important;
        }
        .template-row-rab:hover > td {
          background-color: rgba(255, 152, 0, 0.25) !important;
        }
        .template-row-sub-rab {
          background-color: rgba(156, 39, 176, 0.15) !important;
        }
        .template-row-sub-rab:hover > td {
          background-color: rgba(156, 39, 176, 0.25) !important;
        }
        .template-row-rab-comp {
          background-color: rgba(244, 67, 54, 0.15) !important;
        }
        .template-row-rab-comp:hover > td {
          background-color: rgba(244, 67, 54, 0.25) !important;
        }
        .template-row-mat {
          background-color: rgba(33, 150, 243, 0.15) !important;
        }
        .template-row-mat:hover > td {
          background-color: rgba(33, 150, 243, 0.25) !important;
        }
        .template-row-sub-mat {
          background-color: rgba(156, 204, 101, 0.15) !important;
        }
        .template-row-sub-mat:hover > td {
          background-color: rgba(156, 204, 101, 0.25) !important;
        }
        .template-row-mat-comp {
          background-color: rgba(0, 137, 123, 0.15) !important;
        }
        .template-row-mat-comp:hover > td {
          background-color: rgba(0, 137, 123, 0.25) !important;
        }

        /* Dark theme for AutoComplete dropdown */
        .autocomplete-dark .rc-virtual-list-holder {
          background-color: #1f1f1f !important;
        }
        .autocomplete-dark .ant-select-item {
          color: rgba(255, 255, 255, 0.85) !important;
          background-color: #1f1f1f !important;
        }
        .autocomplete-dark .ant-select-item-option-selected {
          background-color: #177ddc !important;
          color: #fff !important;
        }
        .autocomplete-dark .ant-select-item-option-active {
          background-color: rgba(255, 255, 255, 0.08) !important;
        }
        .autocomplete-dark .ant-select-dropdown {
          background-color: #1f1f1f !important;
        }
      `}</style>
    </div>
  );
};

export default Templates;
