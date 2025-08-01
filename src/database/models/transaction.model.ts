import { DataTypes, Sequelize, Model, Optional } from "sequelize";

export interface TransactionAttributes {
  id: string;
  transactionId: string;
  senderId: string;
  receiverId: string;
  amount: number;
  fee: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  type: 'transfer' | 'deposit' | 'withdrawal';
  description?: string;
  metadata?: any;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionCreationAttributes extends Optional<TransactionAttributes, "id" | "transactionId" | "fee" | "currency" | "status" | "type" | "description" | "metadata" | "processedAt" | "createdAt" | "updatedAt"> {}

export class Transaction extends Model<TransactionAttributes, TransactionCreationAttributes> implements TransactionAttributes {
  public id!: string;
  public transactionId!: string;
  public senderId!: string;
  public receiverId!: string;
  public amount!: number;
  public fee!: number;
  public totalAmount!: number;
  public currency!: string;
  public status!: 'pending' | 'completed' | 'failed' | 'cancelled';
  public type!: 'transfer' | 'deposit' | 'withdrawal';
  public description?: string;
  public metadata?: any;
  public processedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const transaction_model = (sequelize: Sequelize) => {
  Transaction.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      transactionId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        defaultValue: () => `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users', // Changed from 'users' to 'Users'
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      receiverId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users', // Changed from 'users' to 'Users'
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: 0.01,
        },
      },
      fee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        validate: {
          min: 0,
        },
      },
      totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        validate: {
          min: 0.01,
        },
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'RWF',
      },
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      type: {
        type: DataTypes.ENUM('transfer', 'deposit', 'withdrawal'),
        allowNull: false,
        defaultValue: 'transfer',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "transactions",
      modelName: "Transaction",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['transactionId'],
        },
        {
          fields: ['senderId'],
        },
        {
          fields: ['receiverId'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['type'],
        },
        {
          fields: ['createdAt'],
        },
        {
          fields: ['senderId', 'receiverId'],
        },
      ],
      hooks: {
        beforeCreate: (transaction: Transaction) => {
          // Calculate total amount as amount + fee
          transaction.totalAmount = parseFloat(transaction.amount.toString()) + parseFloat(transaction.fee.toString());
        },
        beforeUpdate: (transaction: Transaction) => {
          // Recalculate total amount if amount or fee changes
          if (transaction.changed('amount') || transaction.changed('fee')) {
            transaction.totalAmount = parseFloat(transaction.amount.toString()) + parseFloat(transaction.fee.toString());
          }
          
          // Set processedAt when status changes to completed
          if (transaction.changed('status') && transaction.status === 'completed' && !transaction.processedAt) {
            transaction.processedAt = new Date();
          }
        },
      },
    }
  );

  return Transaction;
};

export default transaction_model;
