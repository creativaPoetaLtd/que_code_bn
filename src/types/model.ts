import { Optional } from "sequelize";

export interface OrganizationModelAttributes {
    id: string;
    name: string;
    type: string;
    email: string;
    ownerPhone: string;
    ownerEmail: string;
    contactPhone: string;
    tinNumber: any;
    registrationNumber: string;
    province: string;
    district: string;
    sector: string;
    cell: string;
    logo: string | string[] | null;
    operationalDocument: string | string[] | null;
    apporvalStatus: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export type OrganizationCreationAttributes = Optional<
    OrganizationModelAttributes,
    "id" | "createdAt" | "updatedAt"
> & {
    name: string;
    type: string;
    email: string;
    ownerPhone: string;
    ownerEmail: string;
    contactPhone: string;
    tinNumber: any;
    registrationNumber: string;
    province: string;
    district: string;
    sector: string;
    cell: string;
    logo: string | string[] | null;
    operationalDocument: string | string[] | null;
    apporvalStatus: boolean;
};
