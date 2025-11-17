import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Tag,
  Tooltip,
  Typography,
  Avatar,
  Dropdown,
  DatePicker,
  message,
  Form,
  Modal
} from 'antd';
import {
  FileTextOutlined,
  LinkOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  MoreOutlined,
  SearchOutlined,
  ExportOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileZipOutlined,
  DownloadOutlined,
  PlusOutlined,
  FolderOutlined,
  QuestionCircleOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import TenderModal from './TenderModal';
import UploadBOQModal from './UploadBOQModal';
import { supabase, type Tender, type TenderInsert, type MarkupParameter, type TenderMarkupPercentageInsert } from '../../../lib/supabase';
import dayjs from 'dayjs';
import './Tenders.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface TenderRecord {
  key: string;
  id: string;
  tender: string;
  tenderNumber: string;
  deadline: string;
  daysUntilDeadline: number;
  client: string;
  estimatedCost: number;
  areaClient: number;
  areaSp: number;
  areaZakazchik: number;
  usdRate: number;
  eurRate: number;
  cnyRate: number;
  hasLinks: boolean;
  uploadFolder?: string;
  bsmLink?: string;
  tzLink?: string;
  qaFormLink?: string;
  createdAt: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
  version: string;
}

const Tenders: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [tendersData, setTendersData] = useState<TenderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTender, setEditingTender] = useState<Tender | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Состояние для модального окна загрузки ВОР
  const [uploadBOQVisible, setUploadBOQVisible] = useState(false);
  const [selectedTenderForUpload, setSelectedTenderForUpload] = useState<TenderRecord | null>(null);

  // Загрузка тендеров из БД
  const fetchTenders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Ошибка загрузки тендеров:', error);
        message.error('Ошибка загрузки тендеров');
      } else if (data) {
        // Преобразование данных из БД в формат для таблицы
        const formattedData: TenderRecord[] = data.map((tender: Tender) => ({
          key: tender.id,
          id: tender.id,
          tender: tender.title,
          tenderNumber: tender.tender_number,
          deadline: tender.submission_deadline ? dayjs(tender.submission_deadline).format('DD.MM.YYYY') : '',
          daysUntilDeadline: tender.submission_deadline ?
            dayjs(tender.submission_deadline).diff(dayjs(), 'day') : 0,
          client: tender.client_name,
          estimatedCost: 0, // Это поле не хранится в БД
          areaClient: tender.area_client || 0,
          areaSp: tender.area_sp || 0,
          areaZakazchik: tender.area_client || 0,
          usdRate: tender.usd_rate || 0,
          eurRate: tender.eur_rate || 0,
          cnyRate: tender.cny_rate || 0,
          hasLinks: !!(tender.upload_folder || tender.bsm_link || tender.tz_link || tender.qa_form_link),
          uploadFolder: tender.upload_folder || undefined,
          bsmLink: tender.bsm_link || undefined,
          tzLink: tender.tz_link || undefined,
          qaFormLink: tender.qa_form_link || undefined,
          createdAt: dayjs(tender.created_at).format('DD.MM.YYYY'),
          description: tender.description || '',
          status: 'in_progress' as const,
          version: tender.version?.toString() || '1'
        }));
        setTendersData(formattedData);
      }
    } catch (err) {
      console.error('Неожиданная ошибка:', err);
      message.error('Произошла неожиданная ошибка');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    fetchTenders();
  }, []);

  const handleMenuClick = async (action: string, record: TenderRecord) => {
    switch (action) {
      case 'edit':
        // Загружаем полные данные тендера из БД
        const { data, error } = await supabase
          .from('tenders')
          .select('*')
          .eq('id', record.id)
          .single();

        if (error) {
          message.error('Ошибка загрузки данных тендера');
          console.error(error);
          return;
        }

        if (data) {
          setEditingTender(data);
          setIsEditMode(true);

          // Заполняем форму данными для редактирования
          form.setFieldsValue({
            title: data.title,
            tender_number: data.tender_number,
            description: data.description,
            client_name: data.client_name,
            submission_deadline: data.submission_deadline ? dayjs(data.submission_deadline) : null,
            version: data.version,
            area_client: data.area_client,
            area_sp: data.area_sp,
            usd_rate: data.usd_rate,
            eur_rate: data.eur_rate,
            cny_rate: data.cny_rate,
            upload_folder: data.upload_folder,
            bsm_link: data.bsm_link,
            tz_link: data.tz_link,
            qa_form_link: data.qa_form_link
          });

          setIsModalVisible(true);
        }
        break;
      case 'copy':
        message.success(`Тендер скопирован: ${record.tender}`);
        break;
      case 'delete':
        Modal.confirm({
          title: 'Удаление тендера',
          content: `Вы уверены, что хотите удалить тендер "${record.tender}"? Это действие нельзя будет отменить.`,
          okText: 'Удалить',
          okType: 'danger',
          cancelText: 'Отмена',
          onOk: async () => {
            try {
              const { error } = await supabase
                .from('tenders')
                .delete()
                .eq('id', record.id);

              if (error) {
                console.error('Ошибка удаления тендера:', error);
                message.error('Не удалось удалить тендер');
              } else {
                message.success(`Тендер "${record.tender}" успешно удален`);
                await fetchTenders();
              }
            } catch (error) {
              console.error('Ошибка при удалении тендера:', error);
              message.error('Произошла ошибка при удалении тендера');
            }
          },
        });
        break;
      case 'archive':
        message.info(`Тендер отправлен в архив: ${record.tender}`);
        break;
      case 'export':
        message.success(`Экспорт тендера: ${record.tender}`);
        break;
      default:
        break;
    }
  };

  const getActionMenu = (record: TenderRecord): MenuProps['items'] => [
    {
      key: 'edit',
      label: 'Редактировать',
      icon: <EditOutlined />,
      onClick: () => handleMenuClick('edit', record),
    },
    {
      key: 'copy',
      label: 'Дублировать',
      icon: <CopyOutlined />,
      onClick: () => handleMenuClick('copy', record),
    },
    {
      type: 'divider',
    },
    {
      key: 'archive',
      label: 'В архив',
      icon: <FileZipOutlined />,
      onClick: () => handleMenuClick('archive', record),
    },
    {
      key: 'export',
      label: 'Экспортировать',
      icon: <DownloadOutlined />,
      onClick: () => handleMenuClick('export', record),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: 'Удалить',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleMenuClick('delete', record),
    },
  ];

  const columns: ColumnsType<TenderRecord> = [
    {
      title: 'Тендер',
      dataIndex: 'tender',
      key: 'tender',
      width: 180,
      ellipsis: true,
      render: (text: string, record: TenderRecord) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.tenderNumber}
          </Text>
        </div>
      ),
    },
    {
      title: 'Время до дедлайна',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 110,
      render: (deadline: string, record: TenderRecord) => (
        <div>
          <Text>{record.status === 'completed' ? 'Завершён' : 'В работе'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {deadline}
          </Text>
        </div>
      ),
    },
    {
      title: 'Дедлайн',
      dataIndex: 'daysUntilDeadline',
      key: 'daysUntilDeadline',
      width: 70,
      align: 'center',
      render: (days: number) => (
        <Tag
          color={days > 30 ? 'green' : days > 7 ? 'orange' : 'red'}
          style={{ margin: 0 }}
        >
          {days} дн.
        </Tag>
      ),
    },
    {
      title: 'Итоговая стоимость КП',
      dataIndex: 'estimatedCost',
      key: 'estimatedCost',
      width: 110,
      align: 'right',
      render: (cost: number) => (
        <Text strong style={{ fontSize: 12 }}>{cost.toLocaleString('ru-RU')}</Text>
      ),
    },
    {
      title: 'Площадь по СП',
      dataIndex: 'areaSp',
      key: 'areaSp',
      width: 90,
      align: 'right',
      render: (area: number) => (
        <Text style={{ fontSize: 12 }}>{area.toLocaleString('ru-RU')} м²</Text>
      ),
    },
    {
      title: 'Площадь от Заказчика',
      dataIndex: 'areaClient',
      key: 'areaClient',
      width: 110,
      align: 'right',
      render: (area: number) => (
        <Text style={{ fontSize: 12 }}>{area > 0 ? `${area.toLocaleString('ru-RU')} м²` : '—'}</Text>
      ),
    },
    {
      title: 'Курс USD',
      dataIndex: 'usdRate',
      key: 'usdRate',
      width: 70,
      align: 'center',
      render: (rate: number) => (
        <Text style={{ fontSize: 12 }}>$ {rate.toFixed(1)}</Text>
      ),
    },
    {
      title: 'Курс EUR',
      dataIndex: 'eurRate',
      key: 'eurRate',
      width: 70,
      align: 'center',
      render: (rate: number) => (
        <Text style={{ fontSize: 12 }}>€ {rate.toFixed(1)}</Text>
      ),
    },
    {
      title: 'Курс CNY',
      dataIndex: 'cnyRate',
      key: 'cnyRate',
      width: 70,
      align: 'center',
      render: (rate: number) => (
        <Text style={{ fontSize: 12 }}>¥ {rate.toFixed(2)}</Text>
      ),
    },
    {
      title: 'Ссылки',
      dataIndex: 'hasLinks',
      key: 'hasLinks',
      width: 60,
      align: 'center',
      render: (hasLinks: boolean, record: TenderRecord) => {
        const linkItems: MenuProps['items'] = [];

        if (record.uploadFolder) {
          linkItems.push({
            key: 'upload_folder',
            label: 'Папка для загрузки КП',
            icon: <FolderOutlined />,
            onClick: () => window.open(record.uploadFolder, '_blank')
          });
        }

        if (record.bsmLink) {
          linkItems.push({
            key: 'bsm_link',
            label: 'БСМ',
            icon: <FileTextOutlined />,
            onClick: () => window.open(record.bsmLink, '_blank')
          });
        }

        if (record.tzLink) {
          linkItems.push({
            key: 'tz_link',
            label: 'Уточнения по ТЗ',
            icon: <FileSearchOutlined />,
            onClick: () => window.open(record.tzLink, '_blank')
          });
        }

        if (record.qaFormLink) {
          linkItems.push({
            key: 'qa_form_link',
            label: 'Форма Вопрос-Ответ',
            icon: <QuestionCircleOutlined />,
            onClick: () => window.open(record.qaFormLink, '_blank')
          });
        }

        if (linkItems.length === 0) {
          return (
            <Tooltip title="Нет доступных ссылок">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                disabled={true}
                style={{ padding: '2px 4px', cursor: 'not-allowed' }}
              />
            </Tooltip>
          );
        }

        return (
          <Dropdown
            menu={{ items: linkItems }}
            placement="bottomLeft"
            trigger={['hover']}
          >
            <Button
              type="text"
              size="small"
              icon={<LinkOutlined />}
              style={{
                padding: '2px 4px',
                color: '#10b981',
                cursor: 'pointer'
              }}
            />
          </Dropdown>
        );
      },
    },
    {
      title: 'Создан',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 80,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{date}</Text>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{text || '—'}</Text>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_: any, record: TenderRecord) => (
        <Space size={2}>
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleOpenUploadBOQ(record)}
            style={{ fontSize: 11 }}
          >
            Загрузить
          </Button>
          <Dropdown
            menu={{ items: getActionMenu(record) }}
            placement="bottomRight"
          >
            <Button type="text" icon={<MoreOutlined />} size="small" />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  const handleExportAll = () => {
    message.success('Экспорт всех тендеров начат');
  };

  const handleCreateNewTender = () => {
    setIsEditMode(false);
    setEditingTender(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      console.log(isEditMode ? 'Обновление тендера:' : 'Данные нового тендера:', values);

      // Преобразование данных для сохранения в БД
      const tenderData: TenderInsert = {
        title: values.title,
        description: values.description || null,
        client_name: values.client_name,
        tender_number: values.tender_number,
        submission_deadline: values.submission_deadline ? values.submission_deadline.toISOString() : null,
        version: values.version || 1,
        area_client: values.area_client || null,
        area_sp: values.area_sp || null,
        usd_rate: values.usd_rate || null,
        eur_rate: values.eur_rate || null,
        cny_rate: values.cny_rate || null,
        upload_folder: values.upload_folder || null,
        bsm_link: values.bsm_link || null,
        tz_link: values.tz_link || null,
        qa_form_link: values.qa_form_link || null
      };

      if (isEditMode && editingTender) {
        // Обновление существующего тендера
        const { data, error } = await supabase
          .from('tenders')
          .update(tenderData)
          .eq('id', editingTender.id)
          .select()
          .single();

        if (error) {
          console.error('Ошибка обновления тендера:', error);
          message.error(`Ошибка при обновлении тендера: ${error.message}`);
        } else if (data) {
          message.success(`Тендер "${values.title}" успешно обновлен`);
          form.resetFields();
          setIsModalVisible(false);
          setIsEditMode(false);
          setEditingTender(null);
          // Обновляем список тендеров
          await fetchTenders();
        }
      } else {
        // Создание нового тендера
        const { data, error } = await supabase
          .from('tenders')
          .insert([tenderData])
          .select()
          .single();

        if (error) {
          console.error('Ошибка сохранения тендера:', error);
          message.error(`Ошибка при создании тендера: ${error.message}`);
        } else if (data) {
          // Автоматически копируем базовые проценты наценок для нового тендера
          try {
            const { data: markupParams, error: paramsError } = await supabase
              .from('markup_parameters')
              .select('*')
              .eq('is_active', true);

            if (!paramsError && markupParams && markupParams.length > 0) {
              const markupRecords: TenderMarkupPercentageInsert[] = markupParams.map((param: MarkupParameter) => ({
                tender_id: data.id,
                markup_parameter_id: param.id,
                value: param.default_value || 0,
              }));

              const { error: insertError } = await supabase
                .from('tender_markup_percentage')
                .insert(markupRecords);

              if (insertError) {
                console.error('Ошибка копирования базовых процентов:', insertError);
                // Не показываем ошибку пользователю, т.к. тендер уже создан
              }
            }

            // Устанавливаем базовую схему наценок для нового тендера
            const { data: baseTactic, error: tacticError } = await supabase
              .from('markup_tactics')
              .select('id')
              .eq('name', 'Базовая схема')
              .eq('is_global', true)
              .single();

            if (!tacticError && baseTactic) {
              const { error: updateError } = await supabase
                .from('tenders')
                .update({ markup_tactic_id: baseTactic.id })
                .eq('id', data.id);

              if (updateError) {
                console.error('Ошибка установки базовой схемы наценок:', updateError);
              }
            }
          } catch (markupError) {
            console.error('Ошибка при копировании базовых процентов:', markupError);
          }

          message.success(`Тендер "${values.title}" успешно создан`);
          form.resetFields();
          setIsModalVisible(false);
          // Обновляем список тендеров
          await fetchTenders();
        }
      }
    } catch (error) {
      console.error('Ошибка валидации:', error);
    }
  };

  const handleModalCancel = () => {
    form.resetFields();
    setIsModalVisible(false);
    setIsEditMode(false);
    setEditingTender(null);
  };

  // Обработчики для модального окна загрузки ВОР
  const handleOpenUploadBOQ = (record: TenderRecord) => {
    setSelectedTenderForUpload(record);
    setUploadBOQVisible(true);
  };

  const handleCloseUploadBOQ = () => {
    setUploadBOQVisible(false);
    setSelectedTenderForUpload(null);
  };

  const handleUploadSuccess = () => {
    message.success('Позиции заказчика успешно загружены');
    // Можно добавить дополнительные действия при успешной загрузке
  };

  return (
    <div style={{ padding: '0' }}>
      {/* Поисковая строка */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16
      }}>
        <Input
          placeholder="Поиск по названию, номеру, клиенту или версии..."
          prefix={<SearchOutlined />}
          style={{ flex: 1, maxWidth: 600 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <Space>
          <RangePicker
            placeholder={['Дата от', 'Дата до']}
            style={{ width: 260 }}
          />

          <Button
            icon={<ExportOutlined />}
            onClick={handleExportAll}
          >
            Экспорт всех тендеров
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateNewTender}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderColor: '#059669',
            }}
          >
            Новый тендер
          </Button>
        </Space>
      </div>

      {/* Таблица */}
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={tendersData.filter(item =>
          searchText === '' ||
          item.tender.toLowerCase().includes(searchText.toLowerCase()) ||
          item.tenderNumber.toLowerCase().includes(searchText.toLowerCase()) ||
          item.description.toLowerCase().includes(searchText.toLowerCase())
        )}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total} тендеров`,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
        locale={{
          emptyText: 'Нет тендеров для отображения. Создайте первый тендер или импортируйте данные.'
        }}
        className="tenders-table"
        style={{
          borderRadius: 8,
        }}
      />

      {/* Модальное окно для создания/редактирования тендера */}
      <TenderModal
        visible={isModalVisible}
        form={form}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        isEditMode={isEditMode}
      />

      {/* Модальное окно для загрузки ВОРа заказчика */}
      {selectedTenderForUpload && (
        <UploadBOQModal
          visible={uploadBOQVisible}
          tenderId={selectedTenderForUpload.id}
          tenderName={selectedTenderForUpload.tender}
          onCancel={handleCloseUploadBOQ}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
};

export default Tenders;