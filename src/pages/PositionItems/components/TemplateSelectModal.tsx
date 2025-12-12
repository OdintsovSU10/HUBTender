import React, { useState, useMemo } from 'react';
import { Modal, AutoComplete, Button, Empty } from 'antd';
import { useTheme } from '../../../contexts/ThemeContext';

interface Template {
  id: string;
  name: string;
  detail_cost_category_id: string | null;
  detail_cost_category_full?: string | null;
}

interface TemplateSelectModalProps {
  visible: boolean;
  templates: Template[];
  onCancel: () => void;
  onSelect: (templateId: string) => void;
}

const TemplateSelectModal: React.FC<TemplateSelectModalProps> = ({
  visible,
  templates,
  onCancel,
  onSelect,
}) => {
  const { theme } = useTheme();
  const [templateNameSearch, setTemplateNameSearch] = useState<string>('');
  const [costCategorySearch, setCostCategorySearch] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Цвета для темной/светлой темы
  const isDark = theme === 'dark';
  const listBg = isDark ? '#1f1f1f' : '#fff';
  const itemBg = isDark ? '#2a2a2a' : 'white';
  const itemBorder = isDark ? '#444' : '#e8e8e8';
  const selectedBg = isDark ? '#0d4a3a' : '#f0fdf4';
  const textColor = isDark ? '#fff' : '#000';
  const subTextColor = isDark ? '#aaa' : '#888';

  // Получить уникальные затраты на строительство
  const uniqueCostCategories = useMemo(() => {
    const categories = new Map<string, string>();
    templates.forEach((t) => {
      if (t.detail_cost_category_id && t.detail_cost_category_full) {
        categories.set(t.detail_cost_category_id, t.detail_cost_category_full);
      }
    });
    return Array.from(categories.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [templates]);

  // Фильтрация шаблонов (независимые фильтры)
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Фильтрация по затрате на строительство (приоритетнее)
    if (costCategorySearch.length > 0) {
      // Ищем точное совпадение категории
      const exactMatch = uniqueCostCategories.find((cat) =>
        cat.name.toLowerCase() === costCategorySearch.toLowerCase()
      );

      if (exactMatch) {
        // Если есть точное совпадение - показываем только шаблоны этой категории
        result = result.filter((t) => t.detail_cost_category_id === exactMatch.id);
      } else {
        // Иначе ищем частичные совпадения
        const matchingCategories = uniqueCostCategories.filter((cat) =>
          cat.name.toLowerCase().includes(costCategorySearch.toLowerCase())
        );

        if (matchingCategories.length > 0) {
          const categoryIds = new Set(matchingCategories.map(cat => cat.id));
          result = result.filter((t) => t.detail_cost_category_id && categoryIds.has(t.detail_cost_category_id));
        } else {
          result = [];
        }
      }
    }
    // Если выбрана затрата - фильтр по наименованию не применяется
    else if (templateNameSearch.length > 0) {
      // Фильтрация только по наименованию шаблона
      result = result.filter((t) =>
        t.name.toLowerCase().includes(templateNameSearch.toLowerCase())
      );
    }

    // Сортировка по наименованию
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, templateNameSearch, costCategorySearch, uniqueCostCategories]);

  // Опции для автопоиска затрат
  const costCategoryOptions = useMemo(() => {
    if (costCategorySearch.length < 2) return [];
    return uniqueCostCategories
      .filter((cat) => cat.name.toLowerCase().includes(costCategorySearch.toLowerCase()))
      .map((cat) => ({
        value: cat.name,
        label: cat.name,
      }));
  }, [uniqueCostCategories, costCategorySearch]);

  // Опции для автопоиска шаблонов
  const templateOptions = useMemo(() => {
    if (templateNameSearch.length < 2) return [];

    // Дедуплицируем имена шаблонов через Set
    const uniqueNames = Array.from(
      new Set(filteredTemplates.slice(0, 50).map((t) => t.name))
    );

    return uniqueNames.map((name) => ({
      value: name,
      label: name,
    }));
  }, [filteredTemplates, templateNameSearch]);

  const handleInsert = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate.id);
      handleClose();
    }
  };

  const handleClose = () => {
    setTemplateNameSearch('');
    setCostCategorySearch('');
    setSelectedTemplate(null);
    onCancel();
  };

  return (
    <Modal
      title="Выбор шаблона"
      open={visible}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          Отмена
        </Button>,
        <Button
          key="insert"
          type="primary"
          disabled={!selectedTemplate}
          onClick={handleInsert}
          style={{ background: '#10b981' }}
        >
          Вставить шаблон в строку Заказчика
        </Button>,
      ]}
      width={1050}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Затрата на строительство
          </div>
          <AutoComplete
            style={{ width: '100%' }}
            placeholder="Введите затрату на строительство для фильтрации..."
            options={costCategoryOptions}
            value={costCategorySearch}
            onChange={setCostCategorySearch}
            onSelect={(value) => {
              setCostCategorySearch(value);
              // Сбрасываем выбранный шаблон при смене категории
              setSelectedTemplate(null);
            }}
            onClear={() => {
              setCostCategorySearch('');
              setSelectedTemplate(null);
            }}
            allowClear
            filterOption={false}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Наименование шаблона
          </div>
          <AutoComplete
            style={{ width: '100%' }}
            placeholder="Введите наименование шаблона для поиска..."
            options={templateOptions}
            value={templateNameSearch}
            onChange={setTemplateNameSearch}
            onSelect={(value) => {
              const template = filteredTemplates.find((t) => t.name === value);
              if (template) {
                setSelectedTemplate(template);
                setTemplateNameSearch(value);
                // Автоматически подставляем затрату
                if (template.detail_cost_category_full) {
                  setCostCategorySearch(template.detail_cost_category_full);
                }
              }
            }}
            onClear={() => {
              setTemplateNameSearch('');
              setSelectedTemplate(null);
            }}
            allowClear
            filterOption={false}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: subTextColor, marginBottom: 8 }}>
          Доступные шаблоны ({filteredTemplates.length})
        </div>
        <div
          style={{
            maxHeight: 300,
            overflowY: 'auto',
            border: `1px solid ${itemBorder}`,
            borderRadius: 4,
            padding: 8,
            background: listBg,
          }}
        >
          {filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setTemplateNameSearch(template.name);
                }}
                style={{
                  padding: 8,
                  marginBottom: 4,
                  cursor: 'pointer',
                  borderRadius: 4,
                  border: selectedTemplate?.id === template.id ? '2px solid #10b981' : `1px solid ${itemBorder}`,
                  background: selectedTemplate?.id === template.id ? selectedBg : itemBg,
                }}
              >
                <div style={{ fontWeight: 500, color: textColor }}>{template.name}</div>
                {template.detail_cost_category_full && (
                  <div style={{ fontSize: 12, color: subTextColor, marginTop: 4 }}>
                    {template.detail_cost_category_full}
                  </div>
                )}
              </div>
            ))
          ) : (
            <Empty description="Нет шаблонов, соответствующих критериям поиска" />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TemplateSelectModal;
