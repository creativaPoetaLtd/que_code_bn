// categories.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { CategoryAttributes, CategoryCreationAttributes } from "../../types/model";

class Category extends Model<
  CategoryAttributes,
  CategoryCreationAttributes
> {
  public id!: string;
  public name!: string;
  public description?: string;
  public isActive!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;
}

const Category_model = (sequelize: Sequelize) => {
  Category.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: DataTypes.TEXT,
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, tableName: "Categories" }
  );

  return Category;
};
export default Category_model;
