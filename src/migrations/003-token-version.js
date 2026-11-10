import { DataTypes } from "sequelize";

export const name = "003-token-version";

export async function up(queryInterface) {
    const columns = await queryInterface.describeTable("Users");
    if (!columns.tokenVersion) {
        await queryInterface.addColumn("Users", "tokenVersion", {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        });
    }
}
