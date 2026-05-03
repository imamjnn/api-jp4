import express from 'express';
import {main} from './controllers/main';
import {example} from './controllers/example';

const router = express.Router();

router.get('/', main);
router.get('/example', example);

export default router;
