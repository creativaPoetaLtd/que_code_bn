import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import Models from "../database/models";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const ACCESS_TOKEN_EXPIRES_IN =
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "1h";
const DEFAULT_REFRESH_TOKEN_DAYS = Number(
  process.env.REFRESH_TOKEN_DAYS || 180,
);

type ModelsType = ReturnType<typeof Models>;
type AccountType = "user" | "organization";

type CreateSessionInput = {
  accountId: string;
  accountType: AccountType;
  userAgent?: string | null;
  ipAddress?: string | null;
  refreshTokenDays?: number;
};

export const hashRefreshToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createRefreshToken = () => crypto.randomBytes(64).toString("base64url");

const getPrimaryRole = (accountData: any, accountType: AccountType) => {
  if (accountType === "organization") {
    return "organization";
  }

  return accountData.userRoles?.[0]?.role?.name || accountData.role || "user";
};

export const buildAccessToken = (
  accountData: any,
  accountType: AccountType,
) => {
  const tokenPayload = {
    id: accountData.id,
    email: accountData.email,
    name:
      accountType === "user"
        ? `${accountData.firstName || ""} ${accountData.lastName || ""}`.trim()
        : accountData.name,
    accountType,
    role: getPrimaryRole(accountData, accountType),
  };

  return jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN as any,
    algorithm: "HS256",
  });
};

export const createDeviceSession = async (
  models: ModelsType,
  input: CreateSessionInput,
) => {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(
    Date.now() +
      (input.refreshTokenDays || DEFAULT_REFRESH_TOKEN_DAYS) *
        24 *
        60 *
        60 *
        1000,
  );

  const session = await models.DeviceSession.create({
    userId: input.accountType === "user" ? input.accountId : null,
    organizationId:
      input.accountType === "organization" ? input.accountId : null,
    accountType: input.accountType,
    refreshTokenHash: hashRefreshToken(refreshToken),
    userAgent: input.userAgent || null,
    ipAddress: input.ipAddress || null,
    expiresAt,
    lastUsedAt: new Date(),
    isActive: true,
  });

  return { session, refreshToken, expiresAt };
};

export const findActiveDeviceSession = async (
  models: ModelsType,
  refreshToken: string,
) => {
  const refreshTokenHash = hashRefreshToken(refreshToken);

  return models.DeviceSession.findOne({
    where: {
      refreshTokenHash,
      isActive: true,
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
  });
};

export const rotateDeviceSessionRefreshToken = async (
  session: any,
  refreshTokenDays: number = DEFAULT_REFRESH_TOKEN_DAYS,
) => {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(
    Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000,
  );

  await session.update({
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt,
    lastUsedAt: new Date(),
  });

  return { refreshToken, expiresAt };
};

export const extendDeviceSession = async (
  session: any,
  refreshTokenDays: number = DEFAULT_REFRESH_TOKEN_DAYS,
) => {
  const expiresAt = new Date(
    Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000,
  );

  await session.update({
    expiresAt,
    lastUsedAt: new Date(),
  });

  return expiresAt;
};

export const getAccountForSession = async (
  models: ModelsType,
  session: any,
) => {
  if (session.accountType === "organization") {
    return models.Organization.findByPk(session.organizationId);
  }

  return models.User.findByPk(session.userId, {
    include: [
      {
        model: models.UserRole,
        as: "userRoles",
        include: [
          {
            model: models.Role,
            as: "role",
            attributes: ["id", "name", "description"],
          },
        ],
      },
    ],
  });
};

export const revokeDeviceSession = async (
  models: ModelsType,
  refreshToken?: string | null,
) => {
  if (!refreshToken) {
    return false;
  }

  const session = await findActiveDeviceSession(models, refreshToken);
  if (!session) {
    return false;
  }

  await session.update({
    isActive: false,
    revokedAt: new Date(),
  });

  return true;
};
