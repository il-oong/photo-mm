// Vercel 서버리스 함수: GET /capture?url=<주소>[&width=390][&desktop=1] -> image/jpeg
import { capturePage } from '../server/src/capture.js';

export default async function handler(req, res) {
  const TOKEN = process.env.API_TOKEN; // 설정하면 Authorization: Bearer <token> 필요
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.status(401).send('unauthorized');
    return;
  }
  const target = req.query.url;
  if (!target || Array.isArray(target)) {
    res.status(400).send('url 파라미터가 필요합니다');
    return;
  }
  try {
    const { image, height, truncated } = await capturePage(target, {
      width: Number(req.query.width) || undefined,
      mobile: req.query.desktop !== '1',
    });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Page-Height', String(height));
    res.setHeader('X-Truncated', String(truncated));
    res.status(200).send(image);
  } catch (e) {
    res.status(422).setHeader('Content-Type', 'text/plain; charset=utf-8').send(String(e.message));
  }
}
