import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { env } from '@/env';
import crypto from 'crypto';
import { API_BASE_URL } from '@/constants';

export async function GET(_request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate secure state parameter for CSRF protection
    const state = crypto.randomBytes(30).toString('hex');
    
    // Store state in session/cookie for validation in callback
    const response = NextResponse.redirect(
      `https://www.reddit.com/api/v1/authorize?` +
      new URLSearchParams({
        client_id: env.REDDIT_CLIENT_ID,
        response_type: 'code',
        state: state,
        redirect_uri: `${API_BASE_URL}/api/reddit/callback`,
        duration: 'permanent',
        scope: 'identity mysubreddits read submit'
      }).toString()
    );

    // Set state cookie for validation in callback
    response.cookies.set('reddit_oauth_state', state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Reddit OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Reddit OAuth' },
      { status: 500 }
    );
  }
}