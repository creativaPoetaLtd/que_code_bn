import { Model } from "sequelize";

export enum ContactStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected'
}

export interface ContactAttributes {
    id: string;
    inviterId: string;
    inviteeId: string;
    status: ContactStatus;
    invitedAt: Date;
    respondedAt?: Date;
    invitationToken?: string;
}

export interface contactCreationAttributes {
    id?: string;
    inviterId: string;
    inviteeId: string;
    status?: ContactStatus;
    invitedAt?: Date;
    respondedAt?: Date;
    invitationToken?: string;
}

export class Contact extends Model<ContactAttributes, contactCreationAttributes> implements ContactAttributes {
    public id!: string;
    public inviterId!: string;
    public inviteeId!: string;
    public status!: ContactStatus;
    public invitedAt!: Date;
    public respondedAt?: Date;
    public invitationToken?: string;

    public inviter?: any;
    public invitee?: any;
}
