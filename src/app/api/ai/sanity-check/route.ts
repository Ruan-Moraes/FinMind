import { NextRequest } from 'next/server';
import {
  handleSanityCheckGet,
  handleSanityCheckPost,
} from '@/features/ai-copilot/providers/sanity-check-api-handlers';

export async function GET(req: NextRequest) {
  return handleSanityCheckGet(req);
}

export async function POST(req: NextRequest) {
  return handleSanityCheckPost(req);
}
