import { DataTypes, Model, Sequelize, UUIDV4 } from "sequelize";
import {
  GalleryItemCreationAttributes,
  GalleryItemModelAttributes,
} from "../../types/model";

class GalleryItem extends Model<
  GalleryItemModelAttributes,
  GalleryItemCreationAttributes
> {
  public id!: string;
  public userId?: string;
  public organizationId?: string;
  public imageUrl!: string;
  public caption?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

const GalleryItem_model = (sequelize: Sequelize) => {
  GalleryItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true },
      organizationId: { type: DataTypes.UUID, allowNull: true },
      imageUrl: { type: DataTypes.TEXT, allowNull: false },
      caption: { type: DataTypes.STRING, allowNull: true },
    },
    {
      sequelize,
      tableName: "GalleryItems",
    }
  );

  return GalleryItem;
};

export default GalleryItem_model;
