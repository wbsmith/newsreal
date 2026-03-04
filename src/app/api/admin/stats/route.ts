import { NextResponse } from 'next/server';
import { getCached } from '@/lib/cache';

interface DailyAnalytics {
  pageviews: number;
  uniqueIPs: string[];
  storyViews: Record<string, number>;
  shares: Record<string, number>;
  topPages: Record<string, number>;
}

export async function GET() {
  try {
    // Fetch pipeline run history
    const runsManifest = await getCached<string[]>('pipeline-runs') || [];
    const recentRuns = await Promise.all(
      runsManifest.slice(0, 3).map(ts => getCached<Record<string, unknown>>(`pipeline-run:${ts}`))
    );
    const pipelineRuns = recentRuns.filter(Boolean);

    // Pipeline last run
    const lastRun = await getCached<number>('pipeline-last-run');

    // Fetch analytics for last 7 days
    const days: { date: string; pageviews: number; uniqueVisitors: number; shares: number }[] = [];
    let todayData: DailyAnalytics | null = null;

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const data = await getCached<DailyAnalytics>(`analytics:${dateStr}`);

      if (data) {
        if (i === 0) todayData = data;
        days.push({
          date: dateStr,
          pageviews: data.pageviews,
          uniqueVisitors: data.uniqueIPs.length,
          shares: Object.values(data.shares).reduce((a, b) => a + b, 0),
        });
      } else {
        days.push({ date: dateStr, pageviews: 0, uniqueVisitors: 0, shares: 0 });
      }
    }

    // Top stories by views today
    const topStories = todayData
      ? Object.entries(todayData.storyViews)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([slug, views]) => ({ slug, views }))
      : [];

    // Story count from cache manifest
    const manifest = await getCached<string[]>('homepage-manifest');
    const storyCount = manifest?.length || 0;

    return NextResponse.json({
      pipelineRuns,
      lastRun,
      analytics: { days, topStories, todayShares: todayData ? Object.values(todayData.shares).reduce((a, b) => a + b, 0) : 0 },
      storyCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load stats' },
      { status: 500 }
    );
  }
}
