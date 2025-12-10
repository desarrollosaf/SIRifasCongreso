'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('sedes', [
      {
        sede: 'Consultorio 1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        sede: 'Consultorio 2',
        createdAt: new Date(),
        updatedAt: new Date()
      },
       {
        sede: 'Consultorio 3',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('sedes', null, {});
  }
};

