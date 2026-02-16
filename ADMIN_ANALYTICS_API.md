# Admin Analytics API Endpoints

## Overview

Comprehensive analytics endpoints for the admin dashboard, providing real-time metrics, KPIs, and insights.

## Base URL

```
/api/v1/admin/analytics
```

## Authentication

All endpoints require:

- **Authentication**: Valid JWT token
- **Authorization**: `admin` or `super_admin` role

## Endpoints

### 1. Dashboard Overview

```
GET /admin/analytics/dashboard-overview
```

**Description**: Get comprehensive dashboard overview with all KPIs for the main admin dashboard.

**Response Structure**:

```json
{
  "success": true,
  "data": {
    "kpis": {
      "users": {
        "total": 184532,
        "verified": 180000,
        "todayCount": 312,
        "last7DaysCount": 2184,
        "trendPercent": "3.2",
        "trendDirection": "up"
      },
      "organizations": {
        "total": 2184,
        "pending": 9,
        "last30DaysCount": 86,
        "trendPercent": "1.1",
        "trendDirection": "up",
        "byCategory": [{ "categoryId": "uuid", "count": 500 }]
      },
      "volume24h": {
        "amount": 482910.5,
        "transactionCount": 18420,
        "trendPercent": "12.3",
        "trendDirection": "up",
        "vsAvgPercent": "12.3"
      },
      "risk": {
        "failureRateToday": 0.8,
        "failureRateLast7Days": 0.6,
        "flaggedToday": 147,
        "flaggedLast7Days": 896,
        "trendPercent": "0.2"
      }
    },
    "flowSummary": {
      "transactions": {
        "today": 18420,
        "last7Days": 112380,
        "trendPercent": "11.2"
      },
      "actions": {
        "today": 312,
        "last7Days": 2104,
        "trendPercent": "6.5"
      },
      "newOrganizations": {
        "today": 17,
        "last7Days": 86,
        "trendPercent": "0.0"
      },
      "refunds": {
        "today": 64,
        "last7Days": 402,
        "trendPercent": "2.1"
      },
      "failedBlocked": {
        "rateToday": 0.7,
        "rateLast7Days": 0.8,
        "trendPercent": "-0.1"
      }
    },
    "financial": {
      "totalWalletBalance": 6420000.0,
      "fundsReserved": 182400.0,
      "disputeCount": 241,
      "revenue30Days": 42380.0,
      "avgDisputeResolutionDays": "2.4"
    }
  }
}
```

**Frontend Mapping**:

- **KPI Cards**: `kpis.users`, `kpis.organizations`, `kpis.volume24h`, `kpis.risk`
- **Flow Summary Table**: `flowSummary.*`
- **Financial Snapshot**: `financial.*`

---

### 2. Transactions Chart Data

```
GET /admin/analytics/transactions-chart?days=7
```

**Description**: Get transaction data for chart visualization showing volume and disputes over time.

**Query Parameters**:

- `days` (optional): Number of days to fetch data for. Default: `7`. Options: `7`, `30`, `90`

**Response**:

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "date": "2026-02-10",
        "status": "completed",
        "count": 2500,
        "volume": 125000.0
      },
      {
        "date": "2026-02-10",
        "status": "failed",
        "count": 20,
        "volume": 1000.0
      }
    ],
    "disputes": []
  }
}
```

**Frontend Usage**: Chart component showing transactions/disputes over time

---

### 3. Top Events (Audit Trail)

```
GET /admin/analytics/top-events
```

**Description**: Get today's top events/activities for audit trail on dashboard.

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "type": "org_approved",
      "entity": "Simba Express",
      "details": "Status: active",
      "timestamp": "2026-02-16T09:41:00.000Z",
      "severity": "success"
    },
    {
      "type": "org_status_change",
      "entity": "NGO FutureCare",
      "details": "Status: suspended",
      "timestamp": "2026-02-16T08:55:00.000Z",
      "severity": "warning"
    },
    {
      "type": "role_assigned",
      "entity": "John Doe",
      "details": "Assigned role: moderator",
      "timestamp": "2026-02-16T08:16:00.000Z",
      "severity": "info"
    },
    {
      "type": "action_created",
      "entity": "Bus VT-552",
      "details": "Type: transport • Status: active",
      "timestamp": "2026-02-16T07:22:00.000Z",
      "severity": "info"
    }
  ]
}
```

**Event Types**:

- `org_approved` - Organization activated
- `org_status_change` - Organization status changed
- `role_assigned` - User role assignment
- `action_created` - New action created

**Frontend Usage**: Live alerts/events feed

---

### 4. User Growth

```
GET /admin/analytics/user-growth?days=30
```

**Description**: Get user growth/registration data over time.

**Query Parameters**:

- `days` (optional): Number of days to fetch data for. Default: `30`

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-02-01",
      "count": 150
    },
    {
      "date": "2026-02-02",
      "count": 175
    }
  ]
}
```

**Frontend Usage**: User growth chart/sparkline

---

### 5. Organization Statistics

```
GET /admin/analytics/organization-stats
```

**Description**: Get detailed organization statistics with breakdowns.

**Response**:

```json
{
  "success": true,
  "data": {
    "byStatus": [
      { "status": "active", "count": 1950 },
      { "status": "pending", "count": 150 },
      { "status": "inactive", "count": 50 },
      { "status": "suspended", "count": 34 }
    ],
    "byCategory": [
      { "categoryId": "uuid-ngo", "count": 500 },
      { "categoryId": "uuid-transport", "count": 750 },
      { "categoryId": "uuid-merchant", "count": 800 },
      { "categoryId": "uuid-event", "count": 134 }
    ],
    "recentActivity": [
      {
        "id": "uuid",
        "name": "Simba Express",
        "status": "active",
        "categoryId": "uuid-transport",
        "createdAt": "2026-02-16T09:00:00.000Z"
      }
    ]
  }
}
```

**Frontend Usage**: Organization breakdown charts and tables

---

### 6. Transaction Statistics

```
GET /admin/analytics/transaction-stats?days=30
```

**Description**: Get detailed transaction statistics with breakdowns by status, type, and daily volumes.

**Query Parameters**:

- `days` (optional): Number of days to fetch data for. Default: `30`

**Response**:

```json
{
  "success": true,
  "data": {
    "byStatus": [
      { "status": "completed", "count": 100000, "volume": 5000000.0 },
      { "status": "pending", "count": 500, "volume": 25000.0 },
      { "status": "failed", "count": 800, "volume": 40000.0 },
      { "status": "disputed", "count": 50, "volume": 5000.0 }
    ],
    "byType": [
      { "type": "transfer", "count": 80000, "volume": 4000000.0 },
      { "type": "payment", "count": 15000, "volume": 750000.0 },
      { "type": "donation", "count": 3000, "volume": 150000.0 },
      { "type": "refund", "count": 2000, "volume": 100000.0 }
    ],
    "volumeByDay": [
      {
        "date": "2026-02-01",
        "count": 3500,
        "volume": 175000.0
      },
      {
        "date": "2026-02-02",
        "count": 3200,
        "volume": 160000.0
      }
    ]
  }
}
```

**Frontend Usage**: Transaction breakdown pie charts, volume charts

---

## Frontend Implementation Recommendations

### 1. Dashboard Overview Page

```typescript
// Fetch dashboard overview data
const response = await adminService.getDashboardOverview();

// Map to KPI cards
<KPICard
  title="Total users"
  value={response.data.kpis.users.total}
  label="Verified accounts"
  badge={{ text: `+${response.data.kpis.users.todayCount} today`, variant: 'success' }}
  trend={{
    direction: response.data.kpis.users.trendDirection,
    value: `+${response.data.kpis.users.trendPercent}%`,
    timeframe: 'last 7 days'
  }}
/>
```

### 2. Transaction Chart

```typescript
// Fetch chart data
const { data } = await adminService.getTransactionsChart(7); // last 7 days

// Format for chart library
const chartData = data.transactions.map((t) => ({
  date: t.date,
  count: t.count,
  volume: t.volume,
  status: t.status,
}));
```

### 3. Live Alerts/Events

```typescript
// Fetch top events
const { data: events } = await adminService.getTopEvents();

// Render event list
{events.map(event => (
  <AlertItem
    key={event.timestamp}
    type={event.type}
    entity={event.entity}
    details={event.details}
    time={formatTime(event.timestamp)}
    severity={event.severity}
  />
))}
```

### 4. Financial Snapshot

```typescript
const { data } = await adminService.getDashboardOverview();

<MiniKPI
  label="Float on main bank account"
  value={formatCurrency(data.financial.totalWalletBalance)}
  meta="All currencies converted to EUR"
/>
<MiniKPI
  label="Funds reserved (disputes & holds)"
  value={formatCurrency(data.financial.fundsReserved)}
  meta={`Across ${data.financial.disputeCount} transactions`}
/>
```

---

## Performance Notes

1. **Caching**: Consider caching dashboard overview data for 1-5 minutes as it involves multiple database queries
2. **Pagination**: Event feeds should be paginated if showing more than 10-20 items
3. **Real-time Updates**: Use WebSocket or polling (every 30-60s) for live KPI updates
4. **Date Ranges**: Allow admins to select custom date ranges for deeper analysis

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Status Codes**:

- `200` - Success
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `500` - Internal server error

---

## Next Steps for Frontend Integration

1. **Create API Service Methods**:

```typescript
// src/services/adminAnalyticsService.ts
export const adminAnalyticsService = {
  getDashboardOverview: () => api.get("/admin/analytics/dashboard-overview"),
  getTransactionsChart: (days = 7) =>
    api.get(`/admin/analytics/transactions-chart?days=${days}`),
  getTopEvents: () => api.get("/admin/analytics/top-events"),
  getUserGrowth: (days = 30) =>
    api.get(`/admin/analytics/user-growth?days=${days}`),
  getOrganizationStats: () => api.get("/admin/analytics/organization-stats"),
  getTransactionStats: (days = 30) =>
    api.get(`/admin/analytics/transaction-stats?days=${days}`),
};
```

2. **Create React Hooks**:

```typescript
// src/hooks/useAdminAnalytics.ts
export const useAdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const response = await adminAnalyticsService.getDashboardOverview();
      setData(response.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  return { data, loading };
};
```

3. **Update Overview Section**:
   Replace hardcoded values with real API data from these endpoints.

---

## Additional Enhancements Suggested

Based on the frontend design, consider adding:

1. **Advanced Filters**: Date range pickers for all endpoints
2. **Export Functionality**: CSV/PDF export of analytics data
3. **Alerts Configuration**: Set thresholds for KPIs to trigger alerts
4. **Comparison Modes**: Compare current period vs previous period
5. **Drill-down Reports**: Click KPIs to see detailed breakdowns
6. **Scheduled Reports**: Email digest of key metrics

---

## Testing

Test all endpoints using:

```bash
# Dashboard overview
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:5001/api/v1/admin/analytics/dashboard-overview

# Transactions chart
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:5001/api/v1/admin/analytics/transactions-chart?days=7"

# Top events
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:5001/api/v1/admin/analytics/top-events
```

---

## Deployment Checklist

- [ ] All endpoints build successfully
- [ ] Routes registered in `src/routes/index.ts`
- [ ] Authentication middleware applied
- [ ] Admin role requirement enforced
- [ ] Tested locally with real data
- [ ] Frontend service methods created
- [ ] Dashboard UI updated with real API calls
- [ ] Error handling implemented
- [ ] Loading states added to UI
- [ ] Deployed to production
- [ ] Monitoring/logging configured
