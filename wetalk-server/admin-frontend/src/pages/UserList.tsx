import { useEffect, useState } from 'react'
import { Table, Button, Tag, message, Space } from 'antd'
import { getUsers, banUser, unbanUser } from '../api'

export default function UserList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res: any = await getUsers()
      if (res.success) setUsers(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleBan = async (uid: string) => {
    await banUser(uid)
    message.success('已封禁')
    fetchUsers()
  }

  const handleUnban = async (uid: string) => {
    await unbanUser(uid)
    message.success('已解封')
    fetchUsers()
  }

  const columns = [
    { title: 'UID', dataIndex: 'uid', key: 'uid' },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: number) => s === 1
        ? <Tag color="green">正常</Tag>
        : <Tag color="red">封禁</Tag>,
    },
    {
      title: '实名', dataIndex: 'verifyStatus', key: 'verifyStatus',
      render: (v: number) => v === 2 ? <Tag color="blue">已认证</Tag> : <Tag>未认证</Tag>,
    },
    { title: '余额', dataIndex: 'balance', key: 'balance' },
    {
      title: '操作', key: 'action',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 1
            ? <Button danger size="small" onClick={() => handleBan(record.uid)}>封禁</Button>
            : <Button size="small" onClick={() => handleUnban(record.uid)}>解封</Button>
          }
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2>用户管理</h2>
      <Table dataSource={users} columns={columns} rowKey="uid" loading={loading} />
    </div>
  )
}
