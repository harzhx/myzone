// api/index.js — Vercel Serverless Function entrypoint
import { handleRequest } from '../server.js';

export default async function handler(req, res) {
  // Global CORS Headers for Vercel Serverless
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Restore the real request URL when rewritten by Vercel
  const matchedPath = req.headers?.['x-matched-path'];
  const queryPath = req.query?._path;

  if (matchedPath && matchedPath.startsWith('/api/')) {
    req.url = matchedPath;
  } else if (queryPath) {
    req.url = '/api/' + queryPath;
  }

  return handleRequest(req, res);
}
