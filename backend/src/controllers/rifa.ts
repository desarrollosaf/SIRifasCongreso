import { Request, Response } from "express"
import Regalos from "../models/regalos";
import Rifa from "../models/rifa";

export const rifa = async (req: Request, res: Response): Promise<any> => {
    const { Op } = require('sequelize');
    let regalo = null;
    let intentos = 0;
    while (!regalo  && intentos < 3) {
        const numero = Math.floor(Math.random() * 16) + 1;
        regalo = await Regalos.findOne({
            where:{
                id: numero,
                cantidad: {
                    [Op.gt]: 0
                }
            }
        });
            
        await regalo?.update({
            cantidad: regalo.cantidad! - 1
        });

        await Rifa.create({
            id_premio: numero,
        })
        intentos++;
    }
              
    res.json( regalo );
}