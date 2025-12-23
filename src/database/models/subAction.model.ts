import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  SubActionCreationAttributes,
  SubActionModelAttributes,
} from "../../types/model";

class SubAction extends Model<
  SubActionModelAttributes,
  SubActionCreationAttributes
> {
  public id!: string;
  public actionId!: string;
  public name!: string;
  public description!: string | null;
  public price!: number;
  public stock!: number | null; // null = unlimited
  public stockReserved!: number; // Currently reserved in pending transactions
  public variants!: any; // JSON: { color?: string[], size?: string[], etc. }
  public metadata!: any; // JSON: type-specific data (seat, row, class, etc.)
  public isActive!: boolean;
  public sortOrder!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const SubAction_model = (sequelize: Sequelize) => {
  SubAction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      actionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Actions",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      stock: { type: DataTypes.INTEGER, allowNull: true }, // null = unlimited
      stockReserved: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      variants: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      tableName: "SubActions",
    }
  );

  return SubAction;
};

export default SubAction_model;

