import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

function formatMoney(val: number) {
  const abs = Math.abs(val);
  const str = abs % 1 === 0 ? `$${abs}` : `$${abs.toFixed(2)}`;
  return val >= 0 ? `+${str}` : `-${str}`;
}

interface Stats {
  totalSessions: number;
  totalBuyins: number;
  totalCashouts: number;
  netProfit: number;
  avgProfit: number;
  largestWin: number;
  largestLoss: number;
  winningSessions: number;
  losingSessions: number;
  roi: number;
  currentStreak: number;
  longestWin: number;
  longestLoss: number;
  timesFirst: number;
  results: number[];
}

export default function StatsPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const { data: players } = await supabase
      .from('session_players')
      .select('result, total_buyin, cashout, position, session_id, sessions(status, ended_at)')
      .eq('user_id', user.id)
      .not('result', 'is', null)
      .order('joined_at', { ascending: true });

    const closed = (players ?? []).filter(
      (p) => ((p.sessions as unknown as { status: string } | null)?.status === 'closed')
    );

    if (closed.length === 0) {
      setStats({
        totalSessions: 0, totalBuyins: 0, totalCashouts: 0, netProfit: 0,
        avgProfit: 0, largestWin: 0, largestLoss: 0, winningSessions: 0,
        losingSessions: 0, roi: 0, currentStreak: 0, longestWin: 0,
        longestLoss: 0, timesFirst: 0, results: [],
      });
      setLoading(false);
      return;
    }

    const results = closed.map((p) => Number(p.result));
    const buyins = closed.map((p) => Number(p.total_buyin));
    const totalBuyins = buyins.reduce((a, b) => a + b, 0);
    const totalCashouts = closed.map((p) => Number(p.cashout)).reduce((a, b) => a + b, 0);
    const netProfit = results.reduce((a, b) => a + b, 0);
    const wins = results.filter((r) => r > 0);
    const losses = results.filter((r) => r < 0);

    // Streaks
    let currentStreak = 0;
    let longestWin = 0;
    let longestLoss = 0;
    let winStreak = 0;
    let lossStreak = 0;
    for (const r of results) {
      if (r > 0) { winStreak++; lossStreak = 0; longestWin = Math.max(longestWin, winStreak); }
      else if (r < 0) { lossStreak++; winStreak = 0; longestLoss = Math.max(longestLoss, lossStreak); }
      else { winStreak = 0; lossStreak = 0; }
    }
    const lastResult = results[results.length - 1];
    if (lastResult > 0) currentStreak = winStreak;
    else if (lastResult < 0) currentStreak = -lossStreak;

    setStats({
      totalSessions: closed.length,
      totalBuyins,
      totalCashouts,
      netProfit,
      avgProfit: netProfit / closed.length,
      largestWin: wins.length > 0 ? Math.max(...wins) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses) : 0,
      winningSessions: wins.length,
      losingSessions: losses.length,
      roi: totalBuyins > 0 ? (netProfit / totalBuyins) * 100 : 0,
      currentStreak,
      longestWin,
      longestLoss,
      timesFirst: closed.filter((p) => p.position === 1).length,
      results,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) return (
    <Box sx={{ px: 2, pt: 4, maxWidth: 600, mx: 'auto' }}>
      <LinearProgress color="primary" />
    </Box>
  );

  const noData = !stats || stats.totalSessions === 0;

  return (
    <Box sx={{ px: 2, pt: 3, pb: 2, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>Your Stats</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {profile?.display_name} · All time
      </Typography>

      {noData ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">Play your first session to see stats.</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Net Profit Hero */}
          <Card
            sx={{
              mb: 2,
              background: stats!.netProfit >= 0
                ? 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(22,163,74,0.1))'
                : 'linear-gradient(135deg, rgba(248,113,113,0.12), rgba(220,38,38,0.08))',
              border: `1px solid ${stats!.netProfit >= 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.25)'}`,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              {stats!.netProfit >= 0
                ? <TrendingUpIcon sx={{ color: 'success.main', fontSize: 36 }} />
                : <TrendingDownIcon sx={{ color: 'error.main', fontSize: 36 }} />}
              <Typography variant="h3" fontWeight={800} sx={{ color: stats!.netProfit >= 0 ? 'success.main' : 'error.main' }}>
                {formatMoney(stats!.netProfit)}
              </Typography>
              <Typography variant="body2" color="text.secondary">Lifetime Net Profit</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5 }}>
                <Chip
                  label={`ROI ${stats!.roi >= 0 ? '+' : ''}${stats!.roi.toFixed(1)}%`}
                  size="small"
                  color={stats!.roi >= 0 ? 'success' : 'error'}
                />
                <Chip
                  label={`${stats!.totalSessions} sessions`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>

          {/* Key stats grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
            {[
              { label: 'Total Buy-Ins', value: `$${stats!.totalBuyins.toFixed(0)}` },
              { label: 'Total Cash-Outs', value: `$${stats!.totalCashouts.toFixed(0)}` },
              { label: 'Avg / Session', value: formatMoney(stats!.avgProfit), color: stats!.avgProfit >= 0 ? 'success.main' : 'error.main' },
              { label: 'Win Rate', value: `${stats!.totalSessions > 0 ? ((stats!.winningSessions / stats!.totalSessions) * 100).toFixed(0) : 0}%` },
              { label: 'Best Session', value: stats!.largestWin > 0 ? `+$${stats!.largestWin.toFixed(0)}` : '-', color: 'success.main' },
              { label: 'Worst Session', value: stats!.largestLoss < 0 ? `-$${Math.abs(stats!.largestLoss).toFixed(0)}` : '-', color: 'error.main' },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ color: (item as { color?: string }).color ?? 'text.primary' }}>
                    {item.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Streaks */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <LocalFireDepartmentIcon sx={{ color: 'secondary.main' }} />
                <Typography variant="subtitle2" fontWeight={700}>Streaks</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                {[
                  { label: 'Current', value: stats!.currentStreak > 0 ? `+${stats!.currentStreak}W` : stats!.currentStreak < 0 ? `${Math.abs(stats!.currentStreak)}L` : '-', color: stats!.currentStreak > 0 ? 'success.main' : stats!.currentStreak < 0 ? 'error.main' : 'text.primary' },
                  { label: 'Best Win', value: `${stats!.longestWin}W`, color: 'success.main' },
                  { label: 'Worst Loss', value: `${stats!.longestLoss}L`, color: 'error.main' },
                ].map((s) => (
                  <Box key={s.label} sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" display="block">{s.label}</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Sessions summary */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Win/Loss Record</Typography>
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="success.main">
                    Wins ({stats!.winningSessions})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats!.totalSessions > 0 ? ((stats!.winningSessions / stats!.totalSessions) * 100).toFixed(0) : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats!.totalSessions > 0 ? (stats!.winningSessions / stats!.totalSessions) * 100 : 0}
                  sx={{ '& .MuiLinearProgress-bar': { bgcolor: 'success.main' } }}
                />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="error.main">
                    Losses ({stats!.losingSessions})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats!.totalSessions > 0 ? ((stats!.losingSessions / stats!.totalSessions) * 100).toFixed(0) : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats!.totalSessions > 0 ? (stats!.losingSessions / stats!.totalSessions) * 100 : 0}
                  sx={{ '& .MuiLinearProgress-bar': { bgcolor: 'error.main' } }}
                />
              </Box>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
