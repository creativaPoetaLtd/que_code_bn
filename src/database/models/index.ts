import { Sequelize } from "sequelize";
import organization_model from "./organization.model";

const Models = (sequelize: Sequelize) => {
	const OrganizationModel = organization_model(sequelize);
	return {
		Organization: OrganizationModel,
	};
};

export default Models;