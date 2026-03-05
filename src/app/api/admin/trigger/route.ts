import { NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export async function POST() {
  try {
    const region = process.env.NEWSREAL_AWS_REGION || 'us-east-1';
    const client = new LambdaClient({
      region,
      credentials: {
        accessKeyId: process.env.NEWSREAL_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEWSREAL_AWS_SECRET_ACCESS_KEY!,
      },
    });

    await client.send(new InvokeCommand({
      FunctionName: 'newsreal-cron',
      InvocationType: 'Event',
    }));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to trigger Lambda' },
      { status: 500 }
    );
  }
}
