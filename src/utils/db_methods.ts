/* eslint-disable no-shadow */
import { CreateOptions, FindOptions, UpdateOptions } from "sequelize";
import database_models from "../database/config/db.config";

type ModelTypes = "Organization" | "User";
// Updated MethodTypes to include "findByPk"
type MethodTypes = "findAll" | "findOne" | "destroy" | "create" | "update" | "findByPk";

export const read_function = async <T>(
  model: ModelTypes,
  method: MethodTypes,
  condition?: FindOptions | string // Accept a string for findByPk
) => {
  if (!database_models[model] || !database_models[model][method]) {
    throw new Error(
      `Invalid ${!database_models[model] ? "modelName" : ""} ${
        !database_models[model] && !database_models[model][method] ? "and" : ""
      } ${!database_models[model][method] ? "method" : ""}`
    );
  }

  const result = method === "findByPk"
    ? await (database_models[model][method] as (id: string) => Promise<T>)(condition as string)
    : await (database_models[model][method] as (options: FindOptions) => Promise<T>)(condition as FindOptions);

  return result;
};


export const insert_function = async <T>(
	model: ModelTypes,
	method: MethodTypes,
	data: any,
	condition?: FindOptions | UpdateOptions,
): Promise<T> => {
	if (!database_models[model] || !database_models[model][method]) {
		throw new Error(
			`Invalid ${!database_models[model] ? "modelName" : ""} ${!database_models[model] && !database_models[model][method] ? "and" : ""} ${!database_models[model][method] ? "method" : ""}`,
		);
	}

	if (method === "create") {
		const result = await (
			database_models[model][method] as (
				data: any,
				options?: CreateOptions,
			) => Promise<T>
		)(data, condition as CreateOptions);
		return result;
	} else if (method === "update") {
		if (!condition) {
			throw new Error("Condition is required for update operation");
		}
		const result = await (
			database_models[model][method] as (
				values: any,
				options?: UpdateOptions,
			) => Promise<T>
		)(data, condition as UpdateOptions);
		return result;
	} else {
		throw new Error("Invalid method type");
	}
};


export const update_function = async <T>(
	model: ModelTypes,
	method: MethodTypes,
	values: Partial<T>,  // Data to update
	condition: UpdateOptions  // Condition for updating
  ): Promise<[number, T[]]> => {
	// Validate model and method
	if (!database_models[model] || !database_models[model][method]) {
	  throw new Error(
		`Invalid ${!database_models[model] ? "modelName" : ""} ${
		  !database_models[model] && !database_models[model][method] ? "and" : ""
		} ${!database_models[model][method] ? "method" : ""}`
	  );
	}
  
	// Perform the update operation
	if (method === "update") {
	  const result = await (
		database_models[model][method] as (
		  values: Partial<T>,
		  options: UpdateOptions
		) => Promise<[number, T[]]>
	  )(values, condition);
  
	  return result;
	} else {
	  throw new Error("Invalid method type for update operation");
	}
  };