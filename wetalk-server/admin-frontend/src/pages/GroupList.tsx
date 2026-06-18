import { useEffect, useState } from 'react'
import { Table, Tag } from 'antd'
import { getGroups } from '../api'

export default function GroupList() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getGroups().then((res: any) => {
      if (res.success) setGroups(res.data)
    }).finally(() => setLoading(false))
  }, [])

  const columns = [
    { title: '群ID', dataIndex: 'groupId', key: 'groupId' },
    { title: '群名称', dataIndex: 'name', key: 'name' },
    { title: '群主', dataIndex: 'ownerUid', key: 'ownerUid' },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: number) => v ? new Date(v).toLocaleString() : '-',
    },
  ]

  return (
    <div>
      <h2>群组管理</h2>
      <Table dataSource={groups} columns={columns} rowKey="groupId" loading={loading} />
    </div>
  )
}
