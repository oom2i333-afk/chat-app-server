import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic } from 'antd'
import { TeamOutlined, MessageOutlined, GroupOutlined, DollarOutlined } from '@ant-design/icons'
import { getDashboard } from '../api'

export default function Dashboard() {
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    getDashboard().then((res: any) => {
      if (res.success) setStats(res.data)
    })
  }, [])

  return (
    <div>
      <h2>数据概览</h2>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card><Statistic title="用户总数" value={stats.totalUsers || 0} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="群组总数" value={stats.totalGroups || 0} prefix={<GroupOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="消息总数" value={stats.totalMessages || 0} prefix={<MessageOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="系统状态" value="正常" prefix={<DollarOutlined />} /></Card>
        </Col>
      </Row>
    </div>
  )
}
