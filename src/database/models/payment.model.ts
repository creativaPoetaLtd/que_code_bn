import { DataTypes, Sequelize, Model, Optional, Op } from "sequelize";

export interface PaymentAttributes {
  id: string;
  userId: string;
  linkId: string;
  url: string;
  amount?: number;
  description?: string;
  expiresAt?: Date;
  isActive: boolean;
  usageCount: number;
  maxUsage?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentCreationAttributes extends Optional<PaymentAttributes, "id" | "linkId" | "url" | "amount" | "description" | "expiresAt" | "isActive" | "usageCount" | "maxUsage" | "createdAt" | "updatedAt"> {}

export class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: string;
  public userId!: string;
  public linkId!: string;
  public url!: string;
  public amount?: number;
  public description?: string;
  public expiresAt?: Date;
  public isActive!: boolean;
  public usageCount!: number;
  public maxUsage?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  public canBeUsed(): boolean {
    if (!this.isActive || this.isExpired()) return false;
    if (this.maxUsage && this.usageCount >= this.maxUsage) return false;
    return true;
  }

  public incrementUsage(): Promise<Payment> {
    return this.update({ usageCount: this.usageCount + 1 });
  }
}

const payment_model = (sequelize: Sequelize) => {
  Payment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users', // Changed from 'users' to 'Users'
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      linkId: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        defaultValue: () => {
          // Generate a short unique identifier
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        },
      },
      url: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
          isUrl: true,
        },
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        validate: {
          min: 0.01,
        },
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        validate: {
          isAfterNow(value: Date) {
            if (value && value <= new Date()) {
              throw new Error('Expiration date must be in the future');
            }
          },
        },
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      usageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      maxUsage: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
        },
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
      tableName: "payments",
      modelName: "Payment",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['linkId'],
        },
        {
          fields: ['userId'],
        },
        {
          fields: ['isActive'],
        },
        {
          fields: ['expiresAt'],
        },
        {
          fields: ['userId', 'isActive'],
        },
      ],
      hooks: {
        beforeCreate: (payment: Payment) => {
          // Generate URL if not provided
          if (!payment.url) {
            payment.url = `https://qiewcode.com/${payment.linkId}`;
          }
        },
        beforeValidate: (payment: Payment) => {
          // Validate maxUsage vs usageCount
          if (payment.maxUsage && payment.usageCount > payment.maxUsage) {
            throw new Error('Usage count cannot exceed maximum usage');
          }
        },
      },
    }
  );

  return Payment;
};

export default payment_model;
