// transactionCategory.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { TransactionCategoryAttributes, TransactionCategoryCreationAttributes } from "../../types/model";

class TransactionCategory extends Model<
  TransactionCategoryAttributes,
  TransactionCategoryCreationAttributes
> {
  public id!: string;
  public name!: string;
  public description?: string;
  public isRestricted!: boolean;
  public requiresOrgCategoryId?: string;
}

const TransactionCategory_model = (sequelize: Sequelize) => {
  TransactionCategory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.STRING,
      isRestricted: { type: DataTypes.BOOLEAN, defaultValue: false },
      requiresOrgCategoryId: DataTypes.UUID,
    },
    { sequelize, tableName: "TransactionCategories" }
  );

  return TransactionCategory;
};
export default TransactionCategory_model;
