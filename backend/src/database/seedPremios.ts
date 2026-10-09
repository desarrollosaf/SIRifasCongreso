// Premios de fábrica (los del seeder original). Se usan al instalar y en "Reinicio de fábrica".
export const PREMIOS_SEED: { id: number; premio: string; cantidad: number }[] = [
    { id: 1, premio: 'Scooter eléctrico', cantidad: 5 },
    { id: 2, premio: 'Galaxy A56 Super', cantidad: 10 },
    { id: 3, premio: 'Laptop ASUS Vivobook 14 Intel Core i7', cantidad: 15 },
    { id: 4, premio: 'Apple 11 Pulgadas iPad', cantidad: 5 },
    { id: 5, premio: 'Bicicletas eléctricas Honey Whale S8', cantidad: 2 },
    { id: 6, premio: 'Bicicleta Montaña Benotto R27', cantidad: 5 },
    { id: 7, premio: 'Pantallas LG 50" Smart TV', cantidad: 10 },
    { id: 8, premio: 'Pantalla Samsung 85" Crystal', cantidad: 1 },
    { id: 9, premio: 'Pantalla LG 86" Nano', cantidad: 1 },
    { id: 10, premio: 'Pantalla LG 75" Nano', cantidad: 3 },
    { id: 11, premio: 'Sistema de Audio Lineal Alienpro Vector de 15 Pulgadas', cantidad: 3 },
    { id: 12, premio: 'Pantalla LG 65" QNED Smart TV', cantidad: 10 },
    { id: 13, premio: 'Pantalla Samsung 55" Smart TV', cantidad: 10 },
    { id: 14, premio: 'Viajes "Cancún"', cantidad: 10 },
    { id: 15, premio: 'Viajes "Los Cabos"', cantidad: 5 },
    { id: 16, premio: 'Viajes "Puerto Vallarta"', cantidad: 5 },
];

export const premiosSeedRows = () => PREMIOS_SEED.map(p => ({
    ...p,
    stock_inicial: p.cantidad,
    path: `images/navidad/regalos/${p.id}.jpg`,
    activo: true,
}));
