// api/index.js — Vercel Serverless Function entrypoint
import handleRequest from '../server.js';

export default async function handler(req, res) {
  return handleRequest(req, res);
}
