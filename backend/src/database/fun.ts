import { Sequelize } from "sequelize"

const sequelizefun = new Sequelize('congresoedomex_rifas', 'usr_rifas', '0aoqzV3gtddpDc97gQZPleElW', {
    host: '192.168.36.53',
    dialect: 'mysql',
    define: {
        freezeTableName: true 
    }
})

export default sequelizefun 