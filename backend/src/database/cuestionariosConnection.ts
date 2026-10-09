 import { Sequelize } from "sequelize"

<<<<<<< HEAD
const sequelizeCuestionarios = new Sequelize(
    process.env.RIFAS_DB_NAME || 'congresoedomex_rifas',
    process.env.RIFAS_DB_USER || 'usr_rifas',
    process.env.RIFAS_DB_PASSWORD || '0aoqzV3gtddpDc97gQZPleElW', {
    host: process.env.RIFAS_DB_HOST || '192.168.36.53',
=======
const sequelizeCuestionarios = new Sequelize('rifas', 'homestead', 'secret', {
    host: '192.168.10.10',
>>>>>>> e992aaf2063451ee085385379f5cc4a80af4d7a2
    dialect: 'mysql',
    logging: process.env.SQL_LOG === 'true' ? console.log : false,
    define: {
        freezeTableName: true 
    }
})
export default sequelizeCuestionarios 
