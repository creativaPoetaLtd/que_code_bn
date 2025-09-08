require("dotenv").config();

const dialect_option =
  process.env.DB_HOST_MODE == "local"
    ? {}
    : {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    };

module.exports = {
  development: {
    use_env_variable: "DB_DEV_URL",
    dialect: "postgres",
    dialectOptions: {},
  },
  test: {
    url: process.env.DB_TEST_URL,
    dialect: "postgres",
    dialectOptions: dialect_option,
  },
  production: {
    url: process.env.DB_PROD_URL,
    dialect: "postgres",
    dialectOptions: dialect_option,
  },
};
