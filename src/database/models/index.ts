import { Sequelize } from "sequelize";
import organization_model from "./organization.model";
import user_model from "./user.model";

const Models = (sequelize: Sequelize) => {
	const OrganizationModel = organization_model(sequelize);
	const UserModel = user_model(sequelize);
	return {
		Organization: OrganizationModel,
		User: UserModel,
	};
};

export default Models;