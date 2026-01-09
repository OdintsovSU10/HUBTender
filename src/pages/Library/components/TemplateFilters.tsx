import React from 'react';
import { Space, Row, Col, AutoComplete } from 'antd';
import type { TemplateWithDetails } from '../hooks/useTemplates';

interface TemplateFiltersProps {
  templates: TemplateWithDetails[];
  templateSearchText: string;
  setTemplateSearchText: (text: string) => void;
  filterCostCategory: string | null;
  setFilterCostCategory: (category: string | null) => void;
  filterDetailCategory: string | null;
  setFilterDetailCategory: (detail: string | null) => void;
  currentTheme: string;
}

export const TemplateFilters: React.FC<TemplateFiltersProps> = ({
  templates,
  templateSearchText,
  setTemplateSearchText,
  filterCostCategory,
  setFilterCostCategory,
  filterDetailCategory,
  setFilterDetailCategory,
  currentTheme,
}) => {
  const uniqueCostCategories = Array.from(new Set(templates.map(t => t.cost_category_name).filter(Boolean)));
  const uniqueDetailCategories = Array.from(new Set(templates.map(t => t.detail_category_name).filter(Boolean)));

  // Уникальные имена шаблонов для поиска (без дублей)
  const uniqueTemplateNames = Array.from(new Set(
    templates
      .filter((t) =>
        !templateSearchText ||
        templateSearchText.length < 2 ||
        t.name.toLowerCase().includes(templateSearchText.toLowerCase())
      )
      .map((t) => t.name)
  ));

  return (
    <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
      <Row gutter={16}>
        <Col span={8}>
          <AutoComplete
            placeholder="Поиск по названию (мин. 2 символа)..."
            value={templateSearchText}
            onChange={(value) => setTemplateSearchText(value)}
            options={uniqueTemplateNames.map((name) => ({
              value: name,
              label: name,
            }))}
            allowClear
            style={{ width: '100%' }}
            filterOption={false}
            popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : undefined}
          />
        </Col>
        <Col span={8}>
          <AutoComplete
            placeholder="Категория затрат (начните вводить...)"
            value={filterCostCategory || undefined}
            onChange={(value) => {
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
            popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : undefined}
          />
        </Col>
        <Col span={8}>
          <AutoComplete
            placeholder="Детализация затрат (начните вводить...)"
            value={filterDetailCategory || undefined}
            onChange={(value) => {
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
            popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : undefined}
          />
        </Col>
      </Row>
    </Space>
  );
};
