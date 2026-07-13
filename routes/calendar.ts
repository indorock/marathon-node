import { Router, type Request, type Response } from 'express';
import { getAdapter } from '../db/database';
import { buildCountdown } from '../lib/countdown';

const router = Router();

router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const adapter = await getAdapter();
    const { data, setCookies } = await buildCountdown(
      adapter,
      req.query as Record<string, string | undefined>,
      req.cookies as Record<string, string>,
    );
    for (const c of setCookies) res.cookie(c.name, c.value, c.options);
    res.render('calendar', data);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>${(err as Error).message}</pre>`);
  }
});

export default router;
