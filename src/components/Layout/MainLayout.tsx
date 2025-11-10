import React, { useState } from 'react';
import { Layout, Menu, Avatar, Badge, Input, Switch, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  DashboardOutlined,
  ShoppingCartOutlined,
  CalculatorOutlined,
  BookOutlined,
  DollarOutlined,
  SettingOutlined,
  UserOutlined,
  SearchOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  ProfileOutlined,
  FileTextOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { LogoIcon } from '../Icons';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: currentTheme, toggleTheme } = useTheme();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Главная',
    },
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
      key: '/library',
      icon: <BookOutlined />,
      label: 'Библиотеки',
    },
    {
      key: '/costs',
      icon: <DollarOutlined />,
      label: 'Затраты на строительство',
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
          label: 'Затраты строительства',
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
    navigate(e.key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        >
          {collapsed ? (
            <div className="logo-collapsed">
              <LogoIcon size={48} color={currentTheme === 'dark' ? '#10b981' : '#ffffff'} />
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
          defaultOpenKeys={location.pathname.startsWith('/admin') ? ['admin'] : []}
          items={menuItems}
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
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SunOutlined style={{ fontSize: '16px', color: currentTheme === 'light' ? '#faad14' : '#888' }} />
              <Switch
                checked={currentTheme === 'dark'}
                onChange={toggleTheme}
                style={{ backgroundColor: currentTheme === 'dark' ? '#10b981' : '#ccc' }}
              />
              <MoonOutlined style={{ fontSize: '16px', color: currentTheme === 'dark' ? '#10b981' : '#888' }} />
            </div>

            <Badge count={3}>
              <BellOutlined style={{ fontSize: '18px', cursor: 'pointer' }} />
            </Badge>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Пользователь</span>
              <Avatar style={{ backgroundColor: '#10b981' }} icon={<UserOutlined />} />
            </div>
            <LogoutOutlined style={{ fontSize: '18px', cursor: 'pointer' }} />
          </div>
        </Header>
        <Content
          style={{
            margin: '24px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: '8px',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;