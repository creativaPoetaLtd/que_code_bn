require("dotenv").config();

process.env.DB_HOSTED_MODE == "local"
	? (dialect_option = {})
	: (dialect_option = {
			ssl: {
				require: process.env.SSL,
				rejectUnauthorized: true,
			},
		});
module.exports = {
	development: {
		url: process.env.DB_DEV_URL,
		dialectOptions: dialect_option,
	},
	test: {
		url: process.env.DB_TEST_URL,
		dialectOptions: dialect_option,
	},
	production: {
		url: process.env.DB_PROD_URL,
	},
};