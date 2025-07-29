# Transaction System Documentation

## Overview
This transaction system allows users to transfer money to other users. Each user has a wallet with a balance, and transactions include automatic fee calculation (2% of transfer amount).

## Features
- **User Wallet Management**: Each user gets a wallet automatically created when registering
- **Money Transfers**: Users can transfer money to other approved users
- **Transaction Fees**: Automatic 2% fee calculation on transfers
- **Transaction History**: View all transactions with pagination and filters
- **Deposit System**: Add money to wallets (admin function)
- **Balance Tracking**: Real-time wallet balance updates

## API Endpoints

### Wallet Management

#### 1. Get Wallet Balance
```
GET /api/transactions/wallet/:userId
```
Returns the wallet balance for a specific user.

**Response:**
```json
{
    "userId": "user-uuid",
    "balance": 5000.00,
    "currency": "RWF",
    "isActive": true
}
```

#### 2. Create Wallet (Admin)
```
POST /api/transactions/wallet/create
```
**Body:**
```json
{
    "userId": "user-uuid",
    "initialBalance": 10000
}
```

#### 3. Add Money to Wallet (Deposit)
```
POST /api/transactions/wallet/deposit
```
**Body:**
```json
{
    "userId": "user-uuid",
    "amount": 5000,
    "description": "Initial deposit"
}
```

### Money Transfers

#### 1. Transfer Money
```
POST /api/transactions/transfer
```
**Body:**
```json
{
    "senderId": "sender-uuid",
    "receiverId": "receiver-uuid",
    "amount": 1000,
    "description": "Payment for services"
}
```

**Response:**
```json
{
    "message": "Transfer completed successfully",
    "transaction": {
        "id": "transaction-uuid",
        "transactionId": "TXN1642501234567",
        "amount": 1000,
        "fee": 20,
        "totalAmount": 1020,
        "status": "completed",
        "description": "Payment for services",
        "processedAt": "2024-01-18T10:30:00.000Z"
    },
    "balances": {
        "senderBalance": 3980,
        "receiverBalance": 6000
    }
}
```

**Fee Calculation:**
- Fee = 2% of transfer amount
- Total deducted from sender = amount + fee
- Receiver gets only the transfer amount (fee goes to system)

### Transaction History

#### 1. Get Transaction History
```
GET /api/transactions/history/:userId?page=1&limit=10&type=transfer&status=completed
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 10)
- `type`: Filter by transaction type (transfer, deposit, withdrawal)
- `status`: Filter by status (pending, completed, failed, cancelled)

#### 2. Get Transaction by ID
```
GET /api/transactions/:transactionId
```

## Transaction Flow

### 1. User Registration
1. User registers with personal details
2. System automatically creates a wallet with 0 balance
3. User receives verification email

### 2. Adding Money (Deposit)
1. Admin or system adds money to user's wallet
2. Creates a "deposit" transaction record
3. Updates wallet balance immediately

### 3. Money Transfer Process
1. **Validation**: Check if sender and receiver exist and are approved
2. **Wallet Check**: Verify both users have active wallets
3. **Balance Check**: Ensure sender has sufficient balance (amount + fee)
4. **Fee Calculation**: Calculate 2% fee on transfer amount
5. **Transaction Creation**: Create pending transaction record
6. **Balance Updates**: 
   - Deduct (amount + fee) from sender's wallet
   - Add amount to receiver's wallet
7. **Transaction Completion**: Mark transaction as completed

### 4. Error Handling
- Insufficient balance: Transaction fails, no balance changes
- User not found: Transaction rejected
- Wallet not found: Transaction rejected
- Transfer to self: Transaction rejected

## Database Schema

### Wallets Table
```sql
{
    id: UUID (Primary Key)
    userId: UUID (Foreign Key to users.id)
    balance: DECIMAL(15,2)
    currency: STRING(3) (Default: 'RWF')
    isActive: BOOLEAN (Default: true)
    createdAt: TIMESTAMP
    updatedAt: TIMESTAMP
}
```

### Transactions Table
```sql
{
    id: UUID (Primary Key)
    transactionId: STRING(50) (Unique, Auto-generated)
    senderId: UUID (Foreign Key to users.id)
    receiverId: UUID (Foreign Key to users.id)
    amount: DECIMAL(15,2)
    fee: DECIMAL(15,2)
    totalAmount: DECIMAL(15,2)
    currency: STRING(3) (Default: 'RWF')
    status: ENUM('pending', 'completed', 'failed', 'cancelled')
    type: ENUM('transfer', 'deposit', 'withdrawal')
    description: TEXT
    metadata: JSON
    processedAt: TIMESTAMP
    createdAt: TIMESTAMP
    updatedAt: TIMESTAMP
}
```

## Testing with Postman

### Prerequisites
1. Import the `Transaction_API.postman_collection.json` file into Postman
2. Set the `baseUrl` variable to your server URL (e.g., `http://localhost:3000`)

### Testing Flow
1. **Create Test Users**: Create 2 users to test transfers between them
2. **Note User IDs**: Copy the user IDs from the creation responses
3. **Add Money**: Use the deposit endpoint to add money to the first user's wallet
4. **Transfer Money**: Transfer money from first user to second user
5. **Check Balances**: Verify wallet balances after transfer
6. **View History**: Check transaction history for both users

### Example Test Scenario
```
1. Create User A → Get userId A
2. Create User B → Get userId B
3. Add 10000 RWF to User A's wallet
4. Transfer 1000 RWF from User A to User B
   - User A pays: 1000 + 20 (fee) = 1020 RWF
   - User B receives: 1000 RWF
   - User A balance: 8980 RWF
   - User B balance: 1000 RWF
```

## Security Considerations
- Validate all user inputs
- Check user approval status before transactions
- Implement proper authentication/authorization
- Log all transactions for audit trails
- Prevent negative balances
- Handle concurrent transactions properly

## Fee Structure
- **Transfer Fee**: 2% of transfer amount
- **Deposit Fee**: No fee
- **Withdrawal Fee**: To be implemented

## Status Definitions
- **pending**: Transaction created but not processed
- **completed**: Transaction successfully processed
- **failed**: Transaction failed due to error
- **cancelled**: Transaction cancelled by user or admin
