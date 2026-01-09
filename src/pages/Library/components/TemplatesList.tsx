import React from 'react';
import {
  Collapse,
  Button,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  Typography,
  Table,
  Row,
  Col,
  AutoComplete,
  Form,
  Input,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  AppstoreAddOutlined,
  SaveOutlined,
  CloseOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { TemplateWithDetails } from '../hooks/useTemplates';
import type { TemplateItemWithDetails } from '../hooks/useTemplateItems';

const { Text } = Typography;

interface TemplatesListProps {
  templates: TemplateWithDetails[];
  loadedTemplateItems: Record<string, TemplateItemWithDetails[]>;
  openedTemplate: string | null;
  setOpenedTemplate: (id: string | null) => void;
  editingTemplate: string | null;
  editingTemplateForm: any;
  editingTemplateCostCategorySearchText: string;
  setEditingTemplateCostCategorySearchText: (text: string) => void;
  editingItems: TemplateItemWithDetails[];
  costCategories: any[];
  currentTheme: string;
  onEditTemplate: (template: TemplateWithDetails) => void;
  onCancelEditTemplate: () => void;
  onSaveEditTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onOpenInsertModal: (templateId: string) => void;
  editingTemplateItems: string | null;
  setEditingTemplateItems: (id: string | null) => void;
  editingWorkSearchText: string;
  setEditingWorkSearchText: (text: string) => void;
  editingMaterialSearchText: string;
  setEditingMaterialSearchText: (text: string) => void;
  editingSelectedWork: string | null;
  setEditingSelectedWork: (id: string | null) => void;
  editingSelectedMaterial: string | null;
  setEditingSelectedMaterial: (id: string | null) => void;
  works: any[];
  materials: any[];
  onAddWorkToTemplate: (templateId: string) => void;
  onAddMaterialToTemplate: (templateId: string) => void;
  getColumns: any;
  getRowClassName: any;
}

export const TemplatesList: React.FC<TemplatesListProps> = ({
  templates,
  loadedTemplateItems,
  openedTemplate,
  setOpenedTemplate,
  editingTemplate,
  editingTemplateForm,
  editingTemplateCostCategorySearchText,
  setEditingTemplateCostCategorySearchText,
  editingItems,
  costCategories,
  currentTheme,
  onEditTemplate,
  onCancelEditTemplate,
  onSaveEditTemplate,
  onDeleteTemplate,
  onOpenInsertModal,
  editingTemplateItems,
  setEditingTemplateItems,
  editingWorkSearchText,
  setEditingWorkSearchText,
  editingMaterialSearchText,
  setEditingMaterialSearchText,
  setEditingSelectedWork,
  setEditingSelectedMaterial,
  works,
  materials,
  onAddWorkToTemplate,
  onAddMaterialToTemplate,
  getColumns,
  getRowClassName,
}) => {
  return (
    <Collapse
      accordion
      activeKey={openedTemplate || undefined}
      onChange={(key) => {
        const templateId = typeof key === 'string' ? key : (Array.isArray(key) && key.length > 0 ? key[0] : null);
        setOpenedTemplate(templateId);
      }}
      items={templates.map((template) => {
        const items = loadedTemplateItems[template.id] || [];
        const worksCount = items.filter(i => i.kind === 'work').length;
        const materialsCount = items.filter(i => i.kind === 'material').length;

        return {
          key: template.id,
          label:
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
                      }}
                      onClear={() => {
                        setEditingTemplateCostCategorySearchText('');
                        editingTemplateForm.setFieldValue('detail_cost_category_id', null);
                      }}
                      filterOption={false}
                      showSearch
                      allowClear
                      style={{ width: '100%' }}
                      popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : undefined}
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
                      onClick={() => onSaveEditTemplate(template.id)}
                    />
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={onCancelEditTemplate}
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
                    <Tooltip title="Вставить шаблон в строку Заказчика">
                      <Tag
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                        color="processing"
                        icon={<ExportOutlined />}
                        onClick={() => onOpenInsertModal(template.id)}
                      >
                        Вставить в позицию
                      </Tag>
                    </Tooltip>
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
                        onClick={() => onEditTemplate(template)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Удалить шаблон?"
                      onConfirm={() => onDeleteTemplate(template.id)}
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
              ),
          children: items.length > 0 ? (
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
                          popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : undefined}
                        />
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => onAddWorkToTemplate(template.id)}
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
                          popupClassName={currentTheme === 'dark' ? 'autocomplete-dark' : undefined}
                        />
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => onAddMaterialToTemplate(template.id)}
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
            )
        };
      })}
    />
  );
};
