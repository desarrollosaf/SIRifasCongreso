import { Sequelize } from "sequelize"

const sequelizeCuestionarios = new Sequelize('adminplem_jornadamujeres', 'usr_jornadamujeres', '4UYxXzz6wIuAxvfzN0z7', {
    host: '192.168.36.53',
    dialect: 'mysql',
    define: {
        freezeTableName: true 
    }
})
export default sequelizeCuestionarios 
