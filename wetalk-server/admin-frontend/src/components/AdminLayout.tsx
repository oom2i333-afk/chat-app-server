import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, theme } from 'antd'
import {
  DashboardOutlined, TeamOutlined, GroupOutlined,
  GiftOutlined, WalletOutlined, LogoutOutlined,
} from '@ant-design/icons'
import { useState } from 'react'

const { Header, Sider, Content } = Layout

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { token: { colorBgContainer } } = theme.useToken()

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
    { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
    { key: '/groups', icon: <GroupOutlined />, label: '群组管理' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ color: '#fff', textAlign: 'center', padding: 16, fontSize: collapsed ? 14 : 18 }}>
          {collapsed ? 'WT' : 'WeTalk 管理'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>退出登录</Button>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: colorBgContainer }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
