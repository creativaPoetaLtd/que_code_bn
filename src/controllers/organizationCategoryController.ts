import { Request, Response } from "express";
import { insert_function, read_function } from "../utils/db_methods";
import {
  CategoryAttributes,
  CategoryCreationAttributes,
} from "../types/model";
import database_models from "../database/config/db.config";

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
  return obj && typeof obj.get === "function";
}

// Create a new organization category
const create_category = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ message: "Category name is required" });
      return;
    }

    // Check if category already exists
    const existingCategory =
      await read_function<CategoryAttributes>(
        "Category",
        "findOne",
        { where: { name } }
      );

    if (existingCategory) {
      res
        .status(400)
        .json({ message: "Category with this name already exists" });
      return;
    }

    // Create category
    const categoryData: CategoryCreationAttributes = {
      name,
      description,
      isActive: true,
    };

    const newCategory = await insert_function<CategoryAttributes>(
      "Category",
      "create",
      categoryData
    );

    const plainCategory = isSequelizeInstance(newCategory)
      ? newCategory.get({ plain: true })
      : newCategory;

    res.status(201).json({
      message: "Organization category created successfully",
      data: plainCategory,
    });
  } catch (error: any) {
    console.error("Category creation error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while creating the category" });
  }
};

// Get all organization categories
const get_all_categories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const categories = await read_function<CategoryAttributes[]>(
      "Category",
      "findAll",
      { order: [["name", "ASC"]] }
    );

    const plainCategories = Array.isArray(categories)
      ? categories.map((category) =>
          isSequelizeInstance(category)
            ? category.get({ plain: true })
            : category
        )
      : [];

    res.status(200).json(plainCategories);
  } catch (error: any) {
    console.error("Categories fetch error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while fetching categories" });
  }
};

// Get organization category by ID
const get_category_by_id = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await read_function<CategoryAttributes>(
      "Category",
      "findByPk",
      id
    );

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const plainCategory = isSequelizeInstance(category)
      ? category.get({ plain: true })
      : category;

    res.status(200).json(plainCategory);
  } catch (error: any) {
    console.error("Category fetch error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while fetching the category" });
  }
};

// Update organization category
const update_category = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if category exists
    const category = await read_function<CategoryAttributes>(
      "Category",
      "findByPk",
      id
    );

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Check if name already exists (if name is being updated)
    if (name) {
      const existingCategory =
        await read_function<CategoryAttributes>(
          "Category",
          "findOne",
          { where: { name } }
        );

      if (existingCategory && existingCategory.id !== id) {
        res
          .status(400)
          .json({ message: "Category with this name already exists" });
        return;
      }
    }

    // Update category
    const updateData: Partial<CategoryCreationAttributes> = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    await insert_function<CategoryAttributes>(
      "Category",
      "update",
      updateData,
      { where: { id } }
    );

    // Fetch updated category
    const updatedCategory = await read_function<CategoryAttributes>(
      "Category",
      "findByPk",
      id
    );

    const plainCategory = isSequelizeInstance(updatedCategory)
      ? updatedCategory!.get({ plain: true })
      : updatedCategory;

    res.status(200).json({
      message: "Category updated successfully",
      data: plainCategory,
    });
  } catch (error: any) {
    console.error("Category update error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while updating the category" });
  }
};

// Delete organization category
const delete_category = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if category exists
    const category = await read_function<CategoryAttributes>(
      "Category",
      "findByPk",
      id
    );

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Check if category has associated organizations
    const organizationsCount = await database_models.Organization.count({
      where: { categoryId: id },
    });

    if (organizationsCount > 0) {
      res.status(400).json({
        message:
          "Cannot delete category with associated organizations. Please reassign organizations first.",
      });
      return;
    }

    // Delete category
    await read_function<CategoryAttributes>(
      "Category",
      "destroy",
      { where: { id } }
    );

    res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    console.error("Category deletion error:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while deleting the category" });
  }
};

export {
  create_category,
  get_all_categories,
  get_category_by_id,
  update_category,
  delete_category,
};
