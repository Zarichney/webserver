import express, { Request, Response } from 'express';
import * as model from 'server/models';

const router = express.Router();

// Full URL: /api/test
router.get('/', (req: Request, res: Response) => {

  let data: model.MyModel[] = [{
    id: 1, name: 'Item 1', description: 'Description 1'
  }];
  res.status(200);
  res.json(data);
});

export default router;
