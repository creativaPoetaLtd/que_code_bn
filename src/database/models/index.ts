import { Sequelize } from "sequelize";
import organization_model from "./organization.model";
import user_model from "./user.model";
import wallet_model from "./wallet.model";
import transaction_model from "./transaction.model";
import payment_model from "./payment.model";

const Models = (sequelize: Sequelize) => {
	const OrganizationModel = organization_model(sequelize);
	const UserModel = user_model(sequelize);
	const WalletModel = wallet_model(sequelize);
	const TransactionModel = transaction_model(sequelize);
	const PaymentModel = payment_model(sequelize);

	// Define associations after all models are initialized
	// User -> Wallet (one-to-one)
	UserModel.hasOne(WalletModel, { foreignKey: 'userId', as: 'wallet' });
	WalletModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

	// User -> Transactions (one-to-many)
	UserModel.hasMany(TransactionModel, { foreignKey: 'senderId', as: 'sentTransactions' });
	UserModel.hasMany(TransactionModel, { foreignKey: 'receiverId', as: 'receivedTransactions' });
	TransactionModel.belongsTo(UserModel, { foreignKey: 'senderId', as: 'sender' });
	TransactionModel.belongsTo(UserModel, { foreignKey: 'receiverId', as: 'receiver' });

	// User -> Payments (one-to-many)
	UserModel.hasMany(PaymentModel, { foreignKey: 'userId', as: 'payments' });
	PaymentModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

	return {
		Organization: OrganizationModel,
		User: UserModel,
		Wallet: WalletModel,
		Transaction: TransactionModel,
		Payment: PaymentModel,
	};
};

export default Models;