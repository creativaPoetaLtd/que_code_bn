// organizationCategory.model.ts
import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import { OrganizationCategoryAttributes, OrganizationCategoryCreationAttributes } from "../../types/model";

class OrganizationCategory extends Model<
  OrganizationCategoryAttributes,
  OrganizationCategoryCreationAttributes
> {
  public id!: string;
  public name!: string;
  public description?: string;
}

const OrganizationCategory_model = (sequelize: Sequelize) => {
  OrganizationCategory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: DataTypes.STRING,
    },
    { sequelize, tableName: "OrganizationCategories" }
  );

  return OrganizationCategory;
};
export default OrganizationCategory_model;
