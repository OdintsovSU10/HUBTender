import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Avatar, Badge, Switch, theme, Dropdown, List, Typography, Space, Empty, Button, Popover, Input } from 'antd';
import type { MenuProps } from 'antd';
const { Text } = Typography;
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  CalculatorOutlined,
  BookOutlined,
  DollarOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  ProfileOutlined,
  FileTextOutlined,
  BankOutlined,
  PercentageOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  LineChartOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { LogoIcon } from '../Icons';
import { supabase, type Notification } from '../../lib/supabase';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import './MainLayout.css';

// Настройка dayjs для форматирования относительного времени на русском
dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [calcValue, setCalcValue] = useState('0');
  const [calcOpen, setCalcOpen] = useState(false);
  const calcInputRef = useRef<any>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: currentTheme, toggleTheme } = useTheme();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // Загрузка уведомлений при монтировании компонента и подписка на изменения
  useEffect(() => {
    fetchNotifications();

    // Подписываемся на real-time обновления таблицы notifications
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: '*', // Слушаем все события (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          console.log('Получено изменение в уведомлениях:', payload);
          // Перезагружаем уведомления при любом изменении
          fetchNotifications();
        }
      )
      .subscribe();

    // Очистка подписки при размонтировании
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Функция для загрузки уведомлений из базы данных
  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Загружаем последние 50 уведомлений

      if (error) throw error;

      setNotifications(data || []);
      // Подсчитываем непрочитанные уведомления
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    }
  };

  // Функция для получения иконки по типу уведомления
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'info':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  // Функция для очистки всех уведомлений
  const clearAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все записи

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Ошибка очистки уведомлений:', error);
    }
  };

  // Функция форматирования чисел с разрядами
  const formatCalcDisplay = (value: string): string => {
    // Разбиваем выражение на части (числа и операторы, включая ^ и sqrt)
    const parts = value.split(/([+\-*/()^]|sqrt)/);

    return parts.map(part => {
      // Пропускаем операторы и пустые строки
      if (/^[+\-*/()^]\s*$/.test(part) || part === '' || part === 'sqrt') return part;

      // Убираем существующие пробелы
      const clean = part.replace(/\s/g, '');

      // Проверяем, является ли это числом
      if (/^-?\d+,?\d*$/.test(clean)) {
        const [integer, decimal] = clean.split(',');
        // Форматируем целую часть с пробелами
        const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return decimal !== undefined ? `${formattedInteger},${decimal}` : formattedInteger;
      }

      return part;
    }).join('');
  };

  // Функции калькулятора
  const handleCalcClick = (value: string) => {
    if (value === '=') {
      try {
        // Убираем пробелы и заменяем запятые на точки для вычислений
        let evalValue = calcValue.replace(/\s/g, '').replace(/,/g, '.');
        // Заменяем ^ на ** для возведения в степень
        evalValue = evalValue.replace(/\^/g, '**');
        // Обрабатываем sqrt как функцию
        evalValue = evalValue.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)');
        const result = eval(evalValue);
        const resultStr = String(result).replace('.', ',');
        setCalcValue(resultStr);
      } catch {
        setCalcValue('Ошибка');
      }
    }
  };

  const handleCalcInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Разрешаем цифры, операторы, запятую, ^, и буквы для sqrt
    if (/^[0-9+\-*/.(),^sqrtа-яА-ЯёЁ\s]*$/.test(newValue) || newValue === '') {
      // Если текущее значение "0" и пользователь вводит цифру, заменяем 0
      if (calcValue === '0' && newValue.length > 1 && /^[0-9]/.test(newValue.charAt(newValue.length - 1))) {
        setCalcValue(newValue.replace(/^0/, ''));
      } else {
        setCalcValue(newValue || '0');
      }
    }
  };

  // Обработка клавиатурных событий для калькулятора
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!calcOpen) return;

      const key = e.key;
      if (key === 'Enter') {
        e.preventDefault();
        handleCalcClick('=');
      } else if (key === 'Escape') {
        e.preventDefault();
        setCalcValue('0');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calcOpen, calcValue]);

  const menuItems: MenuProps['items'] = [
    // {
    //   key: '/',
    //   icon: <HomeOutlined />,
    //   label: 'Главная',
    // },
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Дашборд',
    },
    {
      key: '/positions',
      icon: <ShoppingCartOutlined />,
      label: 'Позиции заказчика',
    },
    {
      key: '/commerce',
      icon: <CalculatorOutlined />,
      label: 'Коммерция',
    },
    {
      key: 'library',
      icon: <BookOutlined />,
      label: 'Библиотеки',
      children: [
        {
          key: '/library',
          icon: <BookOutlined />,
          label: 'Материалы и работы',
        },
        {
          key: '/library/templates',
          icon: <ProfileOutlined />,
          label: 'Шаблоны',
        },
      ],
    },
    {
      key: '/bsm',
      icon: <FileTextOutlined />,
      label: 'Базовая стоимость',
    },
    {
      key: '/costs',
      icon: <DollarOutlined />,
      label: 'Затраты на строительство',
    },
    {
      key: '/financial-indicators',
      icon: <BarChartOutlined />,
      label: 'Финансовые показатели',
    },
    {
      key: 'analytics',
      icon: <BarChartOutlined />,
      label: 'Аналитика',
      children: [
        {
          key: '/analytics/comparison',
          icon: <LineChartOutlined />,
          label: 'Сравнение объектов',
        },
      ],
    },
    {
      key: 'admin',
      icon: <SettingOutlined />,
      label: 'Администрирование',
      children: [
        {
          key: '/admin/nomenclatures',
          icon: <ProfileOutlined />,
          label: 'Номенклатуры',
        },
        {
          key: '/admin/tenders',
          icon: <FileTextOutlined />,
          label: 'Тендеры',
        },
        {
          key: '/admin/construction_cost',
          icon: <BankOutlined />,
          label: 'Справочник затрат',
        },
        {
          key: '/admin/markup',
          icon: <PercentageOutlined />,
          label: 'Проценты наценок',
        },
        {
          type: 'divider',
        },
        {
          key: '/admin/markup_constructor',
          icon: <PercentageOutlined />,
          label: 'Конструктор наценок',
        },
      ],
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: 'Пользователи',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    // Предотвращаем навигацию только если это не клик по ссылке
    // (клик колесом обрабатывается браузером нативно через Link)
    if (e.domEvent && 'button' in e.domEvent && !e.domEvent.button) {
      e.domEvent.preventDefault();
      navigate(e.key);
    }
  };

  // Функция для преобразования пунктов меню в ссылки
  const renderMenuItem = (item: any) => {
    // Если это группа (есть children), не рендерим как ссылку
    if (item.children) {
      return item.label;
    }
    // Если есть key, рендерим как Link для поддержки открытия в новой вкладке
    if (item.key && item.key.startsWith('/')) {
      return <Link to={item.key}>{item.label}</Link>;
    }
    return item.label;
  };

  // Преобразуем menuItems, добавляя label как функцию рендеринга
  const processedMenuItems = menuItems.map((item: any) => {
    if (item.children) {
      return {
        ...item,
        children: item.children.map((child: any) => ({
          ...child,
          label: child.type === 'divider' ? undefined : renderMenuItem(child),
        })),
      };
    }
    return {
      ...item,
      label: renderMenuItem(item),
    };
  });

  return (
    <Layout style={{ minHeight: '100vh', height: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className={`sidebar-${currentTheme}`}
        style={{
          background: currentTheme === 'dark' ? '#0a0a0a' : '#fff',
          borderRight: currentTheme === 'light' ? '1px solid #f0f0f0' : 'none',
        }}
        width={250}
      >
        <div
          className={`logo logo-${currentTheme}`}
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer' }}
        >
          {collapsed ? (
            <div className="logo-collapsed">
              <LogoIcon size={80} color={currentTheme === 'dark' ? '#10b981' : '#ffffff'} />
            </div>
          ) : (
            <div className="logo-expanded">
              <div className="logo-icon-wrapper">
                <LogoIcon size={52} color={currentTheme === 'dark' ? '#10b981' : '#ffffff'} />
              </div>
              <div className="logo-text-wrapper">
                <div className="logo-title">TenderHUB</div>
                <div className="logo-subtitle">by SU_10</div>
              </div>
            </div>
          )}
        </div>
        <Menu
          theme={currentTheme}
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={
            location.pathname.startsWith('/admin') ? ['admin'] :
            location.pathname.startsWith('/library') ? ['library'] :
            location.pathname.startsWith('/analytics') ? ['analytics'] :
            []
          }
          items={processedMenuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            borderRight: 0,
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: currentTheme === 'dark' ? '#0a0a0a' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: currentTheme === 'light' ? '1px solid #e8e8e8' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: {
                fontSize: '18px',
                cursor: 'pointer',
              },
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Popover
              content={
                <div style={{ width: '300px' }}>
                  <Input
                    ref={calcInputRef}
                    value={formatCalcDisplay(calcValue)}
                    onChange={handleCalcInputChange}
                    placeholder="Введите выражение..."
                    style={{
                      marginBottom: '8px',
                      fontSize: '18px',
                      textAlign: 'right',
                      fontWeight: 'bold',
                    }}
                    onPressEnter={() => handleCalcClick('=')}
                  />
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                    Операции: +, -, *, /, ^(степень), sqrt(x)
                  </div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    Enter — вычислить, Esc — очистить
                  </div>
                </div>
              }
              title="Калькулятор"
              trigger="click"
              open={calcOpen}
              onOpenChange={setCalcOpen}
              placement="bottomRight"
            >
              <CalculatorOutlined style={{ fontSize: '24px', cursor: 'pointer', color: '#1890ff', fontWeight: 'bold' }} />
            </Popover>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SunOutlined style={{ fontSize: '16px', color: currentTheme === 'light' ? '#faad14' : '#888' }} />
              <Switch
                checked={currentTheme === 'dark'}
                onChange={toggleTheme}
                style={{ backgroundColor: currentTheme === 'dark' ? '#10b981' : '#ccc' }}
              />
              <MoonOutlined style={{ fontSize: '16px', color: currentTheme === 'dark' ? '#10b981' : '#888' }} />
            </div>

            <Dropdown
              dropdownRender={() => (
                <div
                  style={{
                    backgroundColor: currentTheme === 'dark' ? '#1f1f1f' : '#fff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    width: '400px',
                    maxHeight: '500px',
                    overflow: 'auto',
                  }}
                >
                  <div
                    style={{
                      padding: '16px',
                      borderBottom: currentTheme === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text strong style={{ fontSize: '16px' }}>Уведомления</Text>
                    {notifications.length > 0 && (
                      <Button
                        size="small"
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={clearAllNotifications}
                        danger
                      >
                        Очистить
                      </Button>
                    )}
                  </div>
                  {notifications.length > 0 ? (
                    <List
                      dataSource={notifications}
                      renderItem={(item) => (
                        <List.Item
                          style={{
                            padding: '12px 16px',
                            borderBottom: currentTheme === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = currentTheme === 'dark' ? '#262626' : '#f5f5f5';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <List.Item.Meta
                            avatar={getNotificationIcon(item.type)}
                            title={
                              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                <Text strong>{item.title}</Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  {dayjs(item.created_at).fromNow()}
                                </Text>
                              </Space>
                            }
                            description={
                              <Text style={{ fontSize: '13px', color: currentTheme === 'dark' ? '#d9d9d9' : '#595959' }}>
                                {item.message}
                              </Text>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Нет уведомлений"
                      style={{ padding: '40px 0' }}
                    />
                  )}
                </div>
              )}
              trigger={['click']}
              placement="bottomRight"
            >
              <Badge count={unreadCount}>
                <BellOutlined style={{ fontSize: '18px', cursor: 'pointer' }} />
              </Badge>
            </Dropdown>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Пользователь</span>
              <Avatar style={{ backgroundColor: '#10b981' }} icon={<UserOutlined />} />
            </div>
            <LogoutOutlined style={{ fontSize: '18px', cursor: 'pointer' }} />
          </div>
        </Header>
        <Content
          style={{
            padding: 16,
            minHeight: 280,
            background: colorBgContainer,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;