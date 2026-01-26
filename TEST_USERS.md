# Test User Credentials for QUE Code Platform

## Available Test Accounts

All users have the same password: **Password123!**
All users have PIN: **1234**

### 1. Super Admin

- **Email**: superadmin@quecode.com
- **Phone**: +250788000001
- **Role**: super_admin
- **Access**: Full system access, all permissions

### 2. Admin

- **Email**: admin@quecode.com
- **Phone**: +250788000002
- **Role**: admin
- **Access**: Most permissions except role/permission creation

### 3. Organization Admin

- **Email**: orgadmin@quecode.com
- **Phone**: +250788000003
- **Role**: organization_admin
- **Access**: Organization and transaction management

### 4. Moderator

- **Email**: moderator@quecode.com
- **Phone**: +250788000004
- **Role**: moderator
- **Access**: Content moderation and user viewing

### 5. Regular User

- **Email**: user@quecode.com
- **Phone**: +250788000005
- **Role**: user
- **Access**: Basic user permissions (transactions)

### 6. Test User 1

- **Email**: testuser1@quecode.com
- **Phone**: +250788000006
- **Role**: user
- **Access**: Basic user permissions

### 7. Test User 2

- **Email**: testuser2@quecode.com
- **Phone**: +250788000007
- **Role**: user
- **Access**: Basic user permissions

### 8. Pending User (Not Approved)

- **Email**: pending@quecode.com
- **Phone**: +250788000008
- **Role**: user
- **Status**: Not verified/approved
- **Access**: Limited until approved

## Roles and Permissions Structure

### Roles

1. **super_admin** - Complete system control
2. **admin** - Platform administration
3. **organization_admin** - Organization management
4. **moderator** - Content & user moderation
5. **user** - Standard user access

### Permission Categories

- User Management (view, create, edit, delete, approve users)
- Role Management (view, create, edit, delete, assign roles)
- Organization Management (view, create, edit, delete, approve organizations)
- Transaction Management (view all, view own, create, cancel, refund)
- Analytics & Reports (view analytics, view reports, export data)
- System Configuration (manage settings, categories, audit logs)
- Content Moderation (moderate content, manage notifications)

## Login Redirect Rules

- **super_admin** → `/admin`
- **admin** → `/admin`
- **organization_admin** → `/organization/dashboard`
- **moderator** → `/moderator/dashboard`
- **user** → `/home`
