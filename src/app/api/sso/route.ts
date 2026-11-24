import { NextRequest } from 'next/server';
import {
  handleSsoStatusGet,
  handleSsoAuthenticateOrRevokePost,
} from '@/features/auth/services/sso-api-handlers';

export async function GET(req: NextRequest) {
  return handleSsoStatusGet(req);
}

export async function POST(req: NextRequest) {
  return handleSsoAuthenticateOrRevokePost(req);
}
