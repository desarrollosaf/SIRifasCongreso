/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('partido_participantes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      folio: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      nombre_completo: {2025-12-11 00:46:43
        type: Sequelize.STRING(255),
        allowNull: false
      },
      adscripcion: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      ganador: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('partido_participantes');
  }
};
