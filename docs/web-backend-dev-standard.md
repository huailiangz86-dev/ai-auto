# AI auto — Web 后台开发标准

**Date:** 2026-08-20
**Version:** 1.0
**范围:** 商家后台 + 运营后台（React + Ant Design Pro）

---

## 1. 项目结构

```
apps/
├── merchant-dashboard/           # 商家后台
│   ├── src/
│   │   ├── pages/              # 页面
│   │   │   ├── Dashboard/      # 首页仪表盘
│   │   │   ├── campaigns/      # 活动管理
│   │   │   │   ├── List.tsx
│   │   │   │   ├── Create.tsx
│   │   │   │   └── Detail.tsx
│   │   │   ├── agents/         # 分享员管理
│   │   │   ├── stores/         # 门店管理
│   │   │   └── settings/       # 设置
│   │   ├── components/          # 业务组件
│   │   │   ├── CampaignCard/
│   │   │   ├── AgentTable/
│   │   │   └── StatsCard/
│   │   ├── api/                # API 调用（React Query）
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── stores/            # 状态（Zustand）
│   │   ├── styles/             # 样式
│   │   └── utils/              # 工具
│   └── package.json
│
└── admin-dashboard/            # 运营后台
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard/       # 大屏总览
    │   │   ├── merchants/      # 商户审核
    │   │   ├── agents/         # 分享员审核
    │   │   ├── fraud/          # 风控中心
    │   │   └── finance/        # 财务对账
    │   ├── components/
    │   ├── api/
    │   └── hooks/
    └── package.json
```

---

## 2. 路由规范

### 2.1 路由定义

```typescript
// router/index.tsx
const routes: RouteConfig[] = [
  {
    path: '/',
    component: Layout,
    routes: [
      {
        path: '/',
        redirect: '/dashboard',
      },
      {
        path: '/dashboard',
        component: '@/pages/Dashboard',
        name: '首页',
        icon: 'Dashboard',
      },
      {
        path: '/campaigns',
        component: '@/pages/campaigns/List',
        name: '活动管理',
        icon: 'Gift',
      },
      {
        path: '/campaigns/create',
        component: '@/pages/campaigns/Create',
        name: '创建活动',
        hideInMenu: true,
      },
      {
        path: '/agents',
        component: '@/pages/agents/List',
        name: '分享员管理',
        icon: 'Team',
      },
      {
        path: '/settings/api',
        component: '@/pages/settings/Api',
        name: 'API 设置',
        icon: 'Key',
      },
    ],
  },
]
```

### 2.2 权限控制

```typescript
// 页面级权限
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasPermission(user.role, location.pathname)) {
    return <AccessDenied />;
  }

  return children;
}
```

---

## 3. API 层规范（React Query）

### 3.1 API Client 封装

```typescript
// api/client.ts
import { request } from '@umijs/max'
import type { ApiResponse, PaginatedResponse } from '@ai-auto/shared'

const client = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    request<ApiResponse<T>>(url, { method: 'GET', params }),

  post: <T>(url: string, data?: Record<string, unknown>) =>
    request<ApiResponse<T>>(url, { method: 'POST', data }),

  put: <T>(url: string, data?: Record<string, unknown>) =>
    request<ApiResponse<T>>(url, { method: 'PUT', data }),

  delete: <T>(url: string) =>
    request<ApiResponse<T>>(url, { method: 'DELETE' }),
}

export default client
```

### 3.2 Hooks 封装

```typescript
// hooks/useMerchants.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import type { Merchant } from '@ai-auto/shared'

export function useMerchants(params?: ListMerchantsParams) {
  return useQuery({
    queryKey: ['merchants', params],
    queryFn: () =>
      client.get<PaginatedResponse<Merchant>>('/merchant/profile', params),
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCampaignDto) =>
      client.post<{ campaignId: string }>('/merchant/campaigns', data),
    onSuccess: () => {
      // 创建成功使列表缓存失效
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      message.success('活动创建成功')
    },
    onError: (error: any) => {
      message.error(error.message ?? '创建失败')
    },
  })
}
```

---

## 4. 组件规范

### 4.1 页面结构

```typescript
// pages/campaigns/List.tsx
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Button, Table, Space, Tag, message } from 'antd';
import { useCampaigns, useDeleteCampaign } from '@/hooks/useCampaigns';

export default function CampaignList() {
  const { data, isLoading } = useCampaigns();
  const deleteMutation = useDeleteCampaign();

  const columns: ColumnProps<Campaign>[] = [
    {
      title: '活动名称',
      dataIndex: 'campaignName',
      render: (name, record) => (
        <Link to={`/campaigns/${record.id}`}>{name}</Link>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const map: Record<string, { color: string; text: string }> = {
          running: { color: 'success', text: '进行中' },
          paused: { color: 'warning', text: '已暂停' },
          ended: { color: 'default', text: '已结束' },
          draft: { color: 'default', text: '草稿' },
        };
        const { color, text } = map[status] ?? { color: 'default', text: status };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '核销笔数',
      dataIndex: ['stats', 'redeemed'],
      sorter: true,
      render: (val) => val?.toLocaleString() ?? '-',
    },
    {
      title: '佣金支出',
      dataIndex: ['stats', 'commissionPaid'],
      render: (val) => <span style={{ color: '#d69e2e' }}>¥{val?.toFixed(2)}</span>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Link to={`/campaigns/${record.id}`}>查看</Link>
          <Link to={`/campaigns/${record.id}/edit`}>编辑</Link>
          {record.status === 'running' && (
            <a onClick={() => handlePause(record.id)}>暂停</a>
          )}
          <a onClick={() => handleDelete(record.id)} style={{ color: '#ff4d4f' }}>
            删除
          </a>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="活动管理"
      extra={[
        <Link key="create" to="/campaigns/create">
          <Button type="primary">创建活动</Button>
        </Link>,
      ]}
    >
      <Card>
        <Table
          columns={columns}
          dataSource={data?.items}
          loading={isLoading}
          rowKey="id"
          pagination={{
            total: data?.total,
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>
    </PageContainer>
  );
}
```

---

## 5. 状态管理

### 5.1 全局状态（Zustand）

```typescript
// stores/auth.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: MerchantUser | null
  setToken: (token: string) => void
  setUser: (user: MerchantUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth-storage' },
  ),
)
```

---

## 6. 表格规范

### 6.1 商家后台表格（商家/分享员/核销）

- 使用 Ant Design Table 组件
- 操作列放右侧
- 金额列：佣金用金色 `#d69e2e`，支出用中性色
- 状态列：使用 Tag，颜色映射见状态规范

### 6.2 运营后台表格（财务/风控）

- 告警行：critical=红色背景，warning=橙色背景
- 可疑数据：红色高亮
- 批量操作：checkbox 选择

---

## 7. 图表规范

### 7.1 KPI 卡片

```typescript
// components/StatsCard/index.tsx
interface StatsCardProps {
  title: string;
  value: string | number;
  prefix?: React.ReactNode;
  suffix?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  loading?: boolean;
}

// 使用示例
<StatsCard
  title="今日核销"
  value={1234}
  trend={{ value: 18.2, direction: 'up' }}
  suffix="笔"
/>
```

### 7.2 趋势图

使用 Recharts：

```typescript
// components/TrendChart/index.tsx
<ResponsiveContainer width="100%" height={240}>
  <AreaChart data={dailyData}>
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip formatter={(value) => [`${value}`, '核销笔数']} />
    <Area
      type="monotone"
      dataKey="redeemed"
      stroke="#2c5282"
      fill="#2c5282"
      fillOpacity={0.1}
    />
  </AreaChart>
</ResponsiveContainer>
```

---

## 8. 表单规范

### 8.1 表单布局

```typescript
<Form layout="vertical" form={form}>
  <Row gutter={24}>
    <Col span={12}>
      <Form.Item label="活动名称" name="campaignName" rules={[{ required: true }]}>
        <Input placeholder="请输入活动名称" maxLength={100} />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="活动类型" name="campaignType" rules={[{ required: true }]}>
        <Select placeholder="请选择">
          <Option value="discount">满减券</Option>
          <Option value="cash">现金券</Option>
        </Select>
      </Form.Item>
    </Col>
  </Row>
</Form>
```

### 8.2 佣金配置

```typescript
<Form.Item
  label="每笔佣金"
  name="commissionPerRedemption"
  extra={
    <span style={{ color: '#666' }}>
      佣金 = 券面值 × 80%（平台抽 20%）
      <br />
      分享员到手：¥{commissionAmount * 0.8} / 笔
    </span>
  }
>
  <InputNumber
    min={0}
    precision={2}
    prefix="¥"
    style={{ width: 200 }}
  />
</Form.Item>
```

---

## 9. 测试规范

### 9.1 组件测试

```typescript
// pages/campaigns/CampaignList.spec.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignList from './CampaignList';

// Mock API
jest.mock('@/hooks/useCampaigns', () => ({
  useCampaigns: () => ({
    data: {
      items: [
        { id: '1', campaignName: '七夕活动', status: 'running', stats: { redeemed: 100, commissionPaid: 800 } },
      ],
      total: 1,
    },
    isLoading: false,
  }),
}));

describe('CampaignList', () => {
  it('displays campaign name', async () => {
    render(<CampaignList />);
    expect(screen.getByText('七夕活动')).toBeInTheDocument();
  });

  it('shows commission in gold color', async () => {
    render(<CampaignList />);
    const commissionEl = screen.getByText('¥800.00');
    expect(commissionEl).toHaveStyle({ color: '#d69e2e' });
  });
});
```

---

_本文档配合 `dev-standard.md` 开发规范总纲使用。_
