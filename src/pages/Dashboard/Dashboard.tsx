import React from 'react';
import { Card, Col, Row, Typography, theme } from 'antd';
import {
  DashboardFilled,
  TableOutlined,
  CalculatorFilled,
  BookFilled,
  DollarCircleFilled,
  SettingFilled,
  UserOutlined,
  ToolFilled,
} from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import { HeaderIcon } from '../../components/Icons';
import './Dashboard.css';

const { Title, Text } = Typography;

interface DashboardCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconClass: string;
  onClick?: () => void;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  icon,
  title,
  description,
  iconClass,
  onClick,
}) => {
  const { theme: currentTheme } = useTheme();
  const {
    token: { colorBgContainer, colorText, colorTextSecondary },
  } = theme.useToken();

  return (
    <Card
      hoverable
      className="dashboard-card"
      onClick={onClick}
      style={{
        background: currentTheme === 'dark' ? '#141414' : colorBgContainer,
        border: `1px solid ${currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        borderRadius: '16px',
        height: '180px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      bodyStyle={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
      }}
    >
      <div className={`icon-container ${iconClass}`}>
        {icon}
      </div>
      <Title level={4} style={{ color: colorText, margin: '0 0 8px 0', textAlign: 'center' }}>
        {title}
      </Title>
      <Text style={{ color: colorTextSecondary, textAlign: 'center', fontSize: '12px' }}>
        {description}
      </Text>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const { theme: currentTheme } = useTheme();

  const cards = [
    {
      icon: <DashboardFilled />,
      title: 'Дашборд',
      description: 'Обзор тендеров и основные показатели',
      iconClass: 'icon-container-dashboard',
    },
    {
      icon: <TableOutlined />,
      title: 'Позиции заказчика',
      description: 'Управление позициями и BOQ',
      iconClass: 'icon-container-positions',
    },
    {
      icon: <CalculatorFilled />,
      title: 'Коммерция',
      description: 'Коммерческие расчеты и финансовые показатели',
      iconClass: 'icon-container-commerce',
    },
    {
      icon: <BookFilled />,
      title: 'Библиотеки',
      description: 'Справочники материалов, работ и шаблонов',
      iconClass: 'icon-container-libraries',
    },
    {
      icon: <DollarCircleFilled />,
      title: 'Затраты на строительство',
      description: 'Управление затратами и калькуляция стоимости',
      iconClass: 'icon-container-costs',
    },
    {
      icon: <SettingFilled />,
      title: 'Администрирование',
      description: 'Системные настройки и справочники',
      iconClass: 'icon-container-admin',
    },
    {
      icon: <UserOutlined />,
      title: 'Пользователи',
      description: 'Управление пользователями системы',
      iconClass: 'icon-container-users',
    },
    {
      icon: <ToolFilled />,
      title: 'Настройки',
      description: 'Настройки системы и профиля',
      iconClass: 'icon-container-settings',
    },
  ];

  return (
    <div className={`dashboard-container ${currentTheme === 'light' ? 'dashboard-light' : 'dashboard-dark'}`}>
      <div className="dashboard-header-section">
        <div className="dashboard-header-content">
          <div className="header-icon">
            <HeaderIcon size={64} color="#ffffff" />
          </div>
          <Title level={2} style={{
            color: '#fff',
            margin: '16px 0 8px 0',
            letterSpacing: '-0.5px',
            fontWeight: 700
          }}>
            Добро пожаловать в TenderHUB
          </Title>
          <Text style={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '16px',
            display: 'block'
          }}>
            Система управления тендерами и строительными расчетами
          </Text>
          <Text style={{
            color: '#ffffff',
            fontSize: '13px',
            marginTop: '8px',
            display: 'inline-block',
            padding: '4px 12px',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            fontWeight: 500,
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            by SU_10
          </Text>
        </div>
      </div>

      <div className="dashboard-content">
        <Row gutter={[24, 24]}>
          {cards.map((card, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <DashboardCard {...card} />
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default Dashboard;