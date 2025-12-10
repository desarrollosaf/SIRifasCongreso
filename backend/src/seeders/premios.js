
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('premios', [
      { id: 1, premio: 'Scooter eléctrico', cantidad: 5, createdAt: new Date(),updatedAt: new Date()},
      { id: 2, premio: 'Galaxy A56 Super', cantidad: 10, createdAt: new Date(),updatedAt: new Date()},
      { id: 3, premio: 'Laptop ASUS Vivobook 14 Intel Core i7', cantidad: 15, createdAt: new Date(),updatedAt: new Date()},
      { id: 4, premio: 'Apple 11 Pulgadas iPad', cantidad: 5, createdAt: new Date(),updatedAt: new Date()},
      { id: 5, premio: 'Bicibletas electricas Honey Whale S8 ', cantidad: 2, createdAt: new Date(),updatedAt: new Date()},
      { id: 6, premio: 'Bicicleta Montaña Benotto  R27', cantidad: 5, createdAt: new Date(),updatedAt: new Date()},
      { id: 7, premio: 'Pantallas LG 50" Smar TV', cantidad: 10, createdAt: new Date(),updatedAt: new Date()},
      { id: 8, premio: 'Pantalla Samsung 85" Crystal', cantidad: 1, createdAt: new Date(),updatedAt: new Date()},
      { id: 9, premio: 'Pantalla LG 86" Nano', cantidad: 1, createdAt: new Date(),updatedAt: new Date()},
      { id: 10, premio: 'Pantalla LG 75" Nano', cantidad: 3, createdAt: new Date(),updatedAt: new Date()},
      { id: 11, premio: 'Sistema de Audio Lineal Alienpro Vector de 15 Pulgadas', cantidad: 3, createdAt: new Date(),updatedAt: new Date()},
      { id: 12, premio: 'Pantalla LG 65" QNED Smart TV', cantidad: 10, createdAt: new Date(),updatedAt: new Date()},
      { id: 13, premio: 'Pantalla Samsung 55" Smart TV', cantidad: 10, createdAt: new Date(),updatedAt: new Date()},
      { id: 14, premio: 'Viajes "Cancún"', cantidad: 10, createdAt: new Date(),updatedAt: new Date()},
      { id: 15, premio: 'Viajes "Los Cabos"', cantidad: 5, createdAt: new Date(),updatedAt: new Date()},
      { id: 16, premio: 'Viajes "Puerto Vallarta"', cantidad: 5, createdAt: new Date(),updatedAt: new Date()},
    ], {});
  }
};
