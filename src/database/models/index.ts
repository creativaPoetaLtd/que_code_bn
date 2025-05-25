import { Sequelize } from "sequelize";
import organization_model from "./organization.model";
import user_model from "./user.model";
import wallet_model from "./wallet.model";
import transaction_model from "./transaction.model";
import payment_model from "./payment.model";
import contact_model from "./contact.model";
import Group_model from "./group.model";
import GroupMember_model from "./groupMember.model";
import Notification_model from "./notification.model";

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
	const ContactModel = contact_model(sequelize);
	const groupModel = Group_model(sequelize);
	const groupMemberModel = GroupMember_model(sequelize);
	const NotificationModel = Notification_model(sequelize);

	// User relationships
	UserModel.hasMany(ContactModel, { foreignKey: 'inviterId', as: 'sentInvitations' });
	UserModel.hasMany(ContactModel, { foreignKey: 'inviteeId', as: 'receivedInvitations' });
	UserModel.hasMany(groupModel, { foreignKey: 'ownerId', as: 'ownedGroups' });
	UserModel.hasMany(groupMemberModel, { foreignKey: 'userId', as: 'groupMemberships' });
	UserModel.hasMany(groupMemberModel, { foreignKey: 'invitedBy', as: 'groupInvitations' });

	// Contact relationships
	ContactModel.belongsTo(UserModel, { foreignKey: 'inviterId', as: 'inviter' });
	ContactModel.belongsTo(UserModel, { foreignKey: 'inviteeId', as: 'invitee' });

	// Group relationships
	groupModel.hasMany(groupMemberModel, { foreignKey: 'groupId', as: 'members' });
	groupModel.belongsTo(UserModel, { foreignKey: "ownerId", as: 'owner' });

	// GroupMember relationships
	groupMemberModel.belongsTo(groupModel, { foreignKey: 'groupId', as: 'group' });
	groupMemberModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
	groupMemberModel.belongsTo(UserModel, { foreignKey: 'invitedBy', as: 'inviter' });

	return {
		Organization: OrganizationModel,
		User: UserModel,
		Wallet: WalletModel,
		Transaction: TransactionModel,
		Payment: PaymentModel,
		Contact: ContactModel,
		Group: groupModel,
		GroupMember: groupMemberModel,
		Notification: NotificationModel
	};
};

export default Models;