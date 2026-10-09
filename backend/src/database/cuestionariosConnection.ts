 import { Sequelize } from "sequelize"

const sequelizeCuestionarios = new Sequelize(
    process.env.RIFAS_DB_NAME || 'congresoedomex_rifas',
    process.env.RIFAS_DB_USER || 'usr_rifas',
    process.env.RIFAS_DB_PASSWORD || '0aoqzV3gtddpDc97gQZPleElW', {
    host: process.env.RIFAS_DB_HOST || '192.168.36.53',
    dialect: 'mysql',
    logging: process.env.SQL_LOG === 'true' ? console.log : false,
    define: {
        freezeTableName: true 
    }
})
export default sequelizeCuestionarios 
