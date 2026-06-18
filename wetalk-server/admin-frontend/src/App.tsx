import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserList from './pages/UserList'
import GroupList from './pages/GroupList'
import AdminLayout from './components/AdminLayout'

function App() {
  const token = localStorage.getItem('admin_token')

  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/" /> : <Login />} />
          <Route path="/" element={token ? <AdminLayout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<UserList />} />
            <Route path="groups" element={<GroupList />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
