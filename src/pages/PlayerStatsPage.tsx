import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

type Timeframe = '1M' | '6M' | '1Y' | 'ALL';
type ChartGrouping = 'session' | 'weekly' | 'monthly';

interface SessionData {
  result: number;
  total_buyin: number;
  cashout: number;
  position: number | null;
  date: string;
}

interface ChartPoint {
  label: string;
  fullDate: string;
  sessionPnl: number;
  cumulative: number;
}

const GROUPING_LABELS: Record<ChartGrouping, string> = {
  session: 'By Session',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '1M': 'Past Month Net Profit',
  '6M': 'Past 6 Months Net Profit',
  '1Y': 'Past Year Net Profit',
  'ALL': 'Lifetime Net Profit',
};

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
}

const GREEN = '#4ade80';
const RED = '#f87171';
const AXIS_COLOR = 'rgba(134,239,172,0.5)';
const GRID_COLOR = 'rgba(74,222,128,0.07)';

function formatMoney(val: number) {
  const abs = Math.abs(val);
  const str = abs % 1 === 0 ? `$${abs}` : `$${abs.toFixed(2)}`;
  return val >= 0 ? `+${str}` : `-${str}`;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function filterByTimeframe(sessions: SessionData[], tf: Timeframe): SessionData[] {
  if (tf === 'ALL') return sessions;
  const cutoff = new Date();
  if (tf === '1M') cutoff.setMonth(cutoff.getMonth() - 1);
  else if (tf === '6M') cutoff.setMonth(cutoff.getMonth() - 6);
  else cutoff.setFullYear(cutoff.getFullYear() - 1);
  return sessions.filter((s) => new Date(s.date) >= cutoff);
}

function computeStats(sessions: SessionData[]): Stats {
  if (sessions.length === 0) {
    return {
      totalSessions: 0, totalBuyins: 0, totalCashouts: 0, netProfit: 0,
      avgProfit: 0, largestWin: 0, largestLoss: 0, winningSessions: 0,
      losingSessions: 0, roi: 0, currentStreak: 0, longestWin: 0,
      longestLoss: 0, timesFirst: 0,
    };
  }
  const results = sessions.map((s) => s.result);
  const totalBuyins = sessions.reduce((a, s) => a + s.total_buyin, 0);
  const totalCashouts = sessions.reduce((a, s) => a + s.cashout, 0);
  const netProfit = results.reduce((a, b) => a + b, 0);
  const wins = results.filter((r) => r > 0);
  const losses = results.filter((r) => r < 0);

  let winStreak = 0, lossStreak = 0, longestWin = 0, longestLoss = 0;
  for (const r of results) {
    if (r > 0) { winStreak++; lossStreak = 0; longestWin = Math.max(longestWin, winStreak); }
    else if (r < 0) { lossStreak++; winStreak = 0; longestLoss = Math.max(longestLoss, lossStreak); }
    else { winStreak = 0; lossStreak = 0; }
  }
  const last = results[results.length - 1];
  let currentStreak = 0;
  if (last > 0) currentStreak = winStreak;
  else if (last < 0) currentStreak = -lossStreak;

  return {
    totalSessions: sessions.length,
    totalBuyins,
    totalCashouts,
    netProfit,
    avgProfit: netProfit / sessions.length,
    largestWin: wins.length > 0 ? Math.max(...wins) : 0,
    largestLoss: losses.length > 0 ? Math.min(...losses) : 0,
    winningSessions: wins.length,
    losingSessions: losses.length,
    roi: totalBuyins > 0 ? (netProfit / totalBuyins) * 100 : 0,
    currentStreak,
    longestWin,
    longestLoss,
    timesFirst: sessions.filter((s) => s.position === 1).length,
  };
}

function buildChartData(sessions: SessionData[]): ChartPoint[] {
  let running = 0;
  return sessions.map((s) => {
    running += s.result;
    return {
      label: formatShortDate(s.date),
      fullDate: formatFullDate(s.date),
      sessionPnl: s.result,
      cumulative: Math.round(running * 100) / 100,
    };
  });
}

function getWeekKey(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getMonthKey(iso: string): string {
  return iso.slice(0, 7);
}

function buildGroupedChartData(sessions: SessionData[], grouping: ChartGrouping): ChartPoint[] {
  if (grouping === 'session') return buildChartData(sessions);

  const buckets = new Map<string, { total: number; firstDate: string; lastDate: string }>();

  for (const s of sessions) {
    const key = grouping === 'weekly' ? getWeekKey(s.date) : getMonthKey(s.date);
    const existing = buckets.get(key);
    if (existing) {
      existing.total += s.result;
      existing.lastDate = s.date;
    } else {
      buckets.set(key, { total: s.result, firstDate: s.date, lastDate: s.date });
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort();
  let running = 0;
  const monthWeekCount = new Map<string, number>();
  return sortedKeys.map((key) => {
    const b = buckets.get(key)!;
    running += b.total;
    let label: string;
    let fullDate: string;
    if (grouping === 'weekly') {
      const weekStart = new Date(key + 'T00:00:00');
      const monthName = weekStart.toLocaleDateString('en-US', { month: 'short' });
      const monthKey = weekStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const count = (monthWeekCount.get(monthKey) ?? 0) + 1;
      monthWeekCount.set(monthKey, count);
      label = `${monthName}(${count})`;
      fullDate = `${formatFullDate(b.firstDate)} – ${formatFullDate(b.lastDate)}`;
    } else {
      const monthDate = new Date(key + '-01');
      label = monthDate.toLocaleDateString('en-US', { month: 'short' });
      fullDate = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return {
      label,
      fullDate,
      sessionPnl: Math.round(b.total * 100) / 100,
      cumulative: Math.round(running * 100) / 100,
    };
  });
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        bgcolor: '#0a120a',
        border: '1px solid rgba(74,222,128,0.22)',
        borderRadius: 2,
        minWidth: 158,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75, letterSpacing: 0.3 }}>
        {d.fullDate}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.4 }}>
        <Typography variant="caption" color="text.secondary">Session P&L</Typography>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ color: d.sessionPnl >= 0 ? 'success.main' : 'error.main' }}
        >
          {formatMoney(d.sessionPnl)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="caption" color="text.secondary">Bankroll</Typography>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ color: d.cumulative >= 0 ? 'success.main' : 'error.main' }}
        >
          {formatMoney(d.cumulative)}
        </Typography>
      </Box>
    </Paper>
  );
}

// ─── Profit Timeline Chart ───────────────────────────────────────────────────

function ProfitTimeline({ chartData }: { chartData: ChartPoint[] }) {
  const finalCumulative = chartData.length > 0 ? chartData[chartData.length - 1].cumulative : 0;
  const isPositive = finalCumulative >= 0;
  const lineColor = isPositive ? GREEN : RED;

  const yTickFormatter = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `${v < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
    return `${v < 0 ? '-' : ''}$${abs}`;
  };

  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={chartData} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="psPositiveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.32} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="psNegativeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity={0.02} />
            <stop offset="100%" stopColor={RED} stopOpacity={0.32} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS_COLOR, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          dy={4}
        />
        <YAxis
          tickFormatter={yTickFormatter}
          tick={{ fill: AXIS_COLOR, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: 'rgba(74,222,128,0.18)', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <ReferenceLine y={0} stroke="rgba(74,222,128,0.3)" strokeDasharray="5 3" strokeWidth={1} />

        <Bar dataKey="sessionPnl" maxBarSize={7} radius={[2, 2, 0, 0]}>
          {chartData.map((entry, idx) => (
            <Cell
              key={idx}
              fill={entry.sessionPnl >= 0 ? 'rgba(74,222,128,0.55)' : 'rgba(248,113,113,0.55)'}
            />
          ))}
        </Bar>

        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={lineColor}
          strokeWidth={2}
          fill={isPositive ? 'url(#psPositiveGrad)' : 'url(#psNegativeGrad)'}
          dot={false}
          activeDot={{ r: 4, fill: lineColor, stroke: '#0a120a', strokeWidth: 2 }}
          baseValue={0}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PlayerStatsPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [chartGrouping, setChartGrouping] = useState<ChartGrouping>('session');
  const isOwnProfile = userId === user?.id;

  const loadStats = useCallback(async () => {
    if (!userId) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileData?.display_name) {
      setDisplayName(profileData.display_name);
    }

    type SessionRef = { status: string; ended_at: string | null } | null;

    const { data: players } = await supabase
      .from('session_players')
      .select('result, total_buyin, cashout, position, display_name, sessions(status, ended_at)')
      .eq('user_id', userId)
      .not('result', 'is', null);

    const closed: SessionData[] = ((players ?? []) as unknown as Array<{
      result: number; total_buyin: number; cashout: number | null;
      position: number | null; display_name: string | null;
      sessions: SessionRef;
    }>)
      .filter((p) => p.sessions?.status === 'closed' && p.sessions?.ended_at)
      .map((p) => ({
        result: Number(p.result),
        total_buyin: Number(p.total_buyin),
        cashout: Number(p.cashout ?? 0),
        position: p.position,
        date: p.sessions!.ended_at!,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (!profileData?.display_name && closed.length > 0) {
      const rawPlayers = (players ?? []) as unknown as Array<{ display_name: string | null }>;
      setDisplayName(rawPlayers[0]?.display_name ?? 'Player');
    }

    setAllSessions(closed);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const filtered = useMemo(() => filterByTimeframe(allSessions, timeframe), [allSessions, timeframe]);
  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const chartData = useMemo(() => buildGroupedChartData(filtered, chartGrouping), [filtered, chartGrouping]);

  const noData = filtered.length === 0;
  const initials = displayName ? displayName[0].toUpperCase() : '?';

  return (
    <Box sx={{ pb: 10 }}>
      <AppBar
        position="sticky"
        sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}
        elevation={0}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <Avatar sx={{ bgcolor: 'primary.dark', width: 32, height: 32, fontSize: '0.875rem', fontWeight: 700 }}>
              {initials}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                {displayName || 'Player'}
                {isOwnProfile && (
                  <Chip
                    label="You"
                    size="small"
                    color="primary"
                    sx={{ ml: 1, height: 18, fontSize: '0.6rem', verticalAlign: 'middle' }}
                  />
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">Player Stats</Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 2, pt: 2.5, pb: 6, maxWidth: 600, mx: 'auto' }}>
        {/* Timeframe Filter Pills */}
        <ToggleButtonGroup
          value={timeframe}
          exclusive
          onChange={(_, v) => v && setTimeframe(v as Timeframe)}
          size="small"
          sx={{
            mb: 3,
            gap: 0.75,
            '& .MuiToggleButtonGroup-grouped': {
              border: '1px solid rgba(74,222,128,0.22) !important',
              borderRadius: '20px !important',
              color: 'text.secondary',
              px: 1.5,
              py: 0.3,
              fontSize: '0.7rem',
              fontWeight: 600,
              lineHeight: 1.4,
              minWidth: 0,
              transition: 'all 150ms ease',
              '&.Mui-selected': {
                bgcolor: 'primary.main',
                color: '#080d08',
                borderColor: 'transparent !important',
                '&:hover': { bgcolor: 'primary.light' },
              },
              '&:not(.Mui-selected):hover': {
                bgcolor: 'rgba(74,222,128,0.07)',
              },
            },
          }}
        >
          <ToggleButton value="1M" disableRipple>1M</ToggleButton>
          <ToggleButton value="6M" disableRipple>6M</ToggleButton>
          <ToggleButton value="1Y" disableRipple>1Y</ToggleButton>
          <ToggleButton value="ALL" disableRipple>All Time</ToggleButton>
        </ToggleButtonGroup>

        {loading ? (
          <LinearProgress color="primary" sx={{ mt: 2 }} />
        ) : noData ? (
          <Card sx={{ textAlign: 'center', py: 6, mt: 2 }}>
            <CardContent>
              <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography color="text.secondary">
                {allSessions.length === 0
                  ? 'No completed sessions yet.'
                  : 'No sessions in this timeframe.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Net Profit Hero */}
            <Card
              sx={{
                mb: 2,
                background: stats.netProfit >= 0
                  ? 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(22,163,74,0.1))'
                  : 'linear-gradient(135deg, rgba(248,113,113,0.12), rgba(220,38,38,0.08))',
                border: `1px solid ${stats.netProfit >= 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.25)'}`,
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                {stats.netProfit >= 0
                  ? <TrendingUpIcon sx={{ color: 'success.main', fontSize: 36 }} />
                  : <TrendingDownIcon sx={{ color: 'error.main', fontSize: 36 }} />}
                <Typography variant="h3" fontWeight={800} sx={{ color: stats.netProfit >= 0 ? 'success.main' : 'error.main' }}>
                  {formatMoney(stats.netProfit)}
                </Typography>
                <Typography variant="body2" color="text.secondary">{TIMEFRAME_LABELS[timeframe]}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5 }}>
                  <Chip
                    label={`ROI ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`}
                    size="small"
                    color={stats.roi >= 0 ? 'success' : 'error'}
                  />
                  <Chip label={`${stats.totalSessions} sessions`} size="small" variant="outlined" />
                </Box>
              </CardContent>
            </Card>

            {/* Key Stats Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
              {[
                { label: 'Total Buy-Ins', value: `$${stats.totalBuyins.toFixed(0)}` },
                { label: 'Total Cash-Outs', value: `$${stats.totalCashouts.toFixed(0)}` },
                { label: 'Avg / Session', value: formatMoney(stats.avgProfit), color: stats.avgProfit >= 0 ? 'success.main' : 'error.main' },
                { label: 'Win Rate', value: `${stats.totalSessions > 0 ? ((stats.winningSessions / stats.totalSessions) * 100).toFixed(0) : 0}%` },
                { label: 'Best Session', value: stats.largestWin > 0 ? `+$${stats.largestWin.toFixed(0)}` : '-', color: 'success.main' },
                { label: 'Worst Session', value: stats.largestLoss < 0 ? `-$${Math.abs(stats.largestLoss).toFixed(0)}` : '-', color: 'error.main' },
                { label: 'Times #1', value: `${stats.timesFirst}x` },
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
                    {
                      label: 'Current',
                      value: stats.currentStreak > 0 ? `+${stats.currentStreak}W` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)}L` : '-',
                      color: stats.currentStreak > 0 ? 'success.main' : stats.currentStreak < 0 ? 'error.main' : 'text.primary',
                    },
                    { label: 'Best Win', value: `${stats.longestWin}W`, color: 'success.main' },
                    { label: 'Worst Loss', value: `${stats.longestLoss}L`, color: 'error.main' },
                  ].map((s) => (
                    <Box key={s.label} sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" display="block">{s.label}</Typography>
                      <Typography variant="h6" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Win/Loss Record */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Win/Loss Record</Typography>
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="success.main">Wins ({stats.winningSessions})</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stats.totalSessions > 0 ? ((stats.winningSessions / stats.totalSessions) * 100).toFixed(0) : 0}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={stats.totalSessions > 0 ? (stats.winningSessions / stats.totalSessions) * 100 : 0}
                    sx={{ '& .MuiLinearProgress-bar': { bgcolor: 'success.main' } }}
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="error.main">Losses ({stats.losingSessions})</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stats.totalSessions > 0 ? ((stats.losingSessions / stats.totalSessions) * 100).toFixed(0) : 0}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={stats.totalSessions > 0 ? (stats.losingSessions / stats.totalSessions) * 100 : 0}
                    sx={{ '& .MuiLinearProgress-bar': { bgcolor: 'error.main' } }}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Combined Profit Timeline */}
            <Card
              sx={{
                border: `1px solid ${stats.netProfit >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
              }}
            >
              <CardContent sx={{ pb: '12px !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShowChartIcon
                      sx={{ color: stats.netProfit >= 0 ? 'success.main' : 'error.main', fontSize: 20 }}
                    />
                    <Typography variant="subtitle2" fontWeight={700}>Combined Profit Timeline</Typography>
                  </Box>
                  <TextField
                    select
                    size="small"
                    value={chartGrouping}
                    onChange={(e) => setChartGrouping(e.target.value as ChartGrouping)}
                    sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { fontSize: '0.75rem', py: 0.5 } }}
                  >
                    {Object.entries(GROUPING_LABELS).map(([key, label]) => (
                      <MenuItem key={key} value={key} sx={{ fontSize: '0.8rem' }}>{label}</MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Running bankroll (area) · {chartGrouping === 'session' ? 'Session' : chartGrouping === 'weekly' ? 'Weekly' : 'Monthly'} P&L (bars)
                </Typography>
                {chartData.length < 2 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Need at least 2 sessions to display timeline.
                    </Typography>
                  </Box>
                ) : (
                  <ProfitTimeline chartData={chartData} />
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </Box>
  );
}
