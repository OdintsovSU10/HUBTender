import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, message, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HeaderIcon } from '../../components/Icons/HeaderIcon';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Автоматический редирект если пользователь уже авторизован
  useEffect(() => {
    if (user && user.access_status === 'approved') {
      // Отменяем таймаут загрузки
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);

      // Перенаправляем на dashboard или первую доступную страницу
      const targetPath = user.allowed_pages.length === 0 ? '/dashboard' : user.allowed_pages[0];
      navigate(targetPath, { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (values: LoginFormValues) => {
    setLoading(true);

    try {
      // Аутентификация через Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          message.error('Неверный email или пароль');
        } else if (authError.message.includes('Email not confirmed')) {
          message.error('Email не подтверждён');
        } else {
          message.error(`Ошибка входа: ${authError.message}`);
        }
        setLoading(false);
        return;
      }

      // Успешный вход - AuthContext получит событие SIGNED_IN и загрузит user
      // useEffect сделает редирект когда user появится
      // Таймаут на случай если что-то пойдёт не так
      loadingTimeoutRef.current = setTimeout(() => {
        setLoading(false);
        message.error('Превышено время ожидания. Попробуйте обновить страницу');
      }, 15000);
    } catch (error) {
      console.error('Ошибка при входе:', error);
      message.error('Произошла ошибка при входе');
      setLoading(false);
    }
  };

  // Показываем загрузку пока AuthContext инициализируется
  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48, color: '#fff' }} spin />} />
        <Text style={{ marginTop: 24, fontSize: 18, color: '#fff' }}>Загрузка...</Text>
      </div>
    );
  }

  // Полноэкранный индикатор загрузки при входе
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48, color: '#fff' }} spin />} />
        <Text style={{ marginTop: 24, fontSize: 18, color: '#fff' }}>Вход в систему...</Text>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 450,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          borderRadius: 8,
        }}
      >
        {/* Логотип и заголовок */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 16 }}>
            <HeaderIcon size={64} color="#10b981" />
          </div>
          <Title level={3} style={{ marginBottom: 8, color: '#10b981' }}>
            TenderHUB
          </Title>
          <Text type="secondary">Портал управления тендерами</Text>
        </div>

        {/* Форма входа */}
        <Form
          form={form}
          name="login"
          onFinish={handleLogin}
          layout="vertical"
          requiredMark={false}
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Введите корректный email' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="example@su10.ru"
              size="large"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Введите пароль"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<LoginOutlined />}
              loading={loading}
              block
              size="large"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
              }}
            >
              Войти
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Link to="/forgot-password" style={{ color: '#10b981' }}>
              Забыли пароль?
            </Link>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">
              Нет аккаунта?{' '}
              <Link to="/register" style={{ color: '#10b981' }}>
                Зарегистрироваться
              </Link>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
