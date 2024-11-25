import { json } from '@sveltejs/kit';
import { PUBLIC_TWITTER_CLIENT_ID, PUBLIC_TWITTER_CLIENT_SECRET } from '$env/static/public';

export async function POST({ request }) {
    try {
        const { code, codeVerifier } = await request.json();

        // Exchange code for tokens
        const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${PUBLIC_TWITTER_CLIENT_ID}:${PUBLIC_TWITTER_CLIENT_SECRET}`).toString('base64')}`
            },
            body: new URLSearchParams({
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': 'http://localhost:5173/auth/callback',
                'code_verifier': codeVerifier
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            console.error('Token error:', error);
            return json({ error: 'Failed to get access token' }, { status: 400 });
        }

        const tokens = await tokenResponse.json();
        return json(tokens);
    } catch (error) {
        console.error('Token exchange error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
} 