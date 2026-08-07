import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TuneIcon from '@mui/icons-material/Tune';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface RawPlayer {
  user_id: string;
  display_name: string;
  result: number;
  total_buyin: number;
  session_status: string;
  session_date: string;
}

function formatMoney(val: number) {
  const abs = Math.abs(val);
  const str = `$${abs % 1 === 0 ? abs : abs.toFixed(2)}`;
  return val >= 0 ? `+${str}` : `-${str}`;
}

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7f32'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.display_name === 'MasterManuver';
  const [tab, setTab] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKey(new Date().toISOString()));
  const [minSessionsOverride, setMinSessionsOverride] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [rawPlayers, setRawPlayers] = useState<RawPlayer[]>([]);
  const [showProfitableOnly, setShowProfitableOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  const isMonthly = selectedMonth !== 'all';
  const minSessions = minSessionsOverride ?? (isMonthly ? 1 : 3);

  const loadLeaderboards = useCallback(async () => {
    const { data: players } = await supabase
      .from('session_players')
      .select(`
        user_id, display_name, result, total_buyin,
        sessions!inner(status, started_at)
      `)
      .not('user_id', 'is', null)
      .not('result', 'is', null);

    const filtered = (players ?? []).filter(
      (p) => ((p.sessions as unknown as { status: string; started_at: string } | null)?.status === 'closed')
    );

    const mapped: RawPlayer[] = filtered.map((p) => ({
      user_id: p.user_id as string,
      display_name: (p.display_name as string | null) ?? 'Unknown',
      result: Number(p.result),
      total_buyin: Number(p.total_buyin),
      session_status: (p.sessions as unknown as { status: string })?.status ?? '',
      session_date: (p.sessions as unknown as { started_at: string })?.started_at ?? '',
    }));

    setRawPlayers(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { loadLeaderboards(); }, [loadLeaderboards]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const p of rawPlayers) {
      if (p.session_date) set.add(monthKey(p.session_date));
    }
    return Array.from(set).sort().reverse();
  }, [rawPlayers]);

  const boards = useMemo(() => {
    const filtered = selectedMonth === 'all'
      ? rawPlayers
      : rawPlayers.filter((p) => monthKey(p.session_date) === selectedMonth);

    const map = new Map<string, { display_name: string; net: number; buyin: number; count: number }>();
    for (const p of filtered) {
      const existing = map.get(p.user_id) ?? { display_name: p.display_name, net: 0, buyin: 0, count: 0 };
      existing.net += p.result;
      existing.buyin += p.total_buyin;
      existing.count += 1;
      map.set(p.user_id, existing);
    }

    const entries = Array.from(map.entries()).map(([uid, d]) => ({
      user_id: uid,
      display_name: d.display_name,
      sessions: d.count,
      net: d.net,
      roi: d.buyin > 0 ? (d.net / d.buyin) * 100 : 0,
      count: d.count,
    }));

    const profit = [...entries]
      .filter((e) => !showProfitableOnly || e.net > 0)
      .sort((a, b) => b.net - a.net)
      .map((e) => ({ user_id: e.user_id, display_name: e.display_name, value: e.net, sessions: e.sessions }));

    const roi = [...entries]
      .filter((e) => e.sessions >= 3)
      .sort((a, b) => b.roi - a.roi)
      .map((e) => ({ user_id: e.user_id, display_name: e.display_name, value: e.roi, sessions: e.sessions }));

    const active = [...entries]
      .sort((a, b) => b.count - a.count)
      .map((e) => ({ user_id: e.user_id, display_name: e.display_name, value: e.count, sessions: e.sessions }));

    return [
      profit.filter((e) => e.sessions >= minSessions),
      roi.filter((e) => e.sessions >= minSessions),
      active.filter((e) => e.sessions >= minSessions),
    ];
  }, [rawPlayers, selectedMonth, minSessions, showProfitableOnly]);

  const currentBoard = boards[tab] ?? [];
  const maxVal = currentBoard.length > 0 ? Math.abs(currentBoard[0].value) : 1;

  function formatValue(val: number, tabIdx: number) {
    if (tabIdx === 0) return formatMoney(val);
    if (tabIdx === 1) return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
    return `${val} sessions`;
  }

  function handleMinSessionsChange(raw: string) {
    setInputVal(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setMinSessionsOverride(n);
    else if (raw === '') setMinSessionsOverride(null);
  }

  return (
    <Box sx={{ px: 2, pt: 3, pb: 2, maxWidth: 600, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <LeaderboardIcon sx={{ color: 'secondary.main' }} />
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>Leaderboards</Typography>
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="filter settings"
          sx={{
            color: minSessions > 1 || selectedMonth !== 'all' || (isAdmin && !showProfitableOnly) ? 'primary.main' : 'text.secondary',
            border: '1px solid',
            borderColor: minSessions > 1 || selectedMonth !== 'all' || (isAdmin && !showProfitableOnly) ? 'primary.main' : 'divider',
            borderRadius: 1.5,
            p: 0.75,
          }}
        >
          <TuneIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {selectedMonth === 'all' ? 'All-time rankings' : `${formatMonthLabel(selectedMonth)} rankings`}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          select
          size="small"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
        >
          <MenuItem value="all" sx={{ fontSize: '0.85rem' }}>All Time</MenuItem>
          {availableMonths.map((m) => (
            <MenuItem key={m} value={m} sx={{ fontSize: '0.85rem' }}>{formatMonthLabel(m)}</MenuItem>
          ))}
        </TextField>
        {minSessionsOverride !== null && (
          <Typography variant="caption" color="primary.main" sx={{ alignSelf: 'center' }}>
            Min: {minSessionsOverride}
          </Typography>
        )}
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              minWidth: 220,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            },
          },
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Filter Options
        </Typography>
        <TextField
          label="Min. sessions"
          type="number"
          size="small"
          fullWidth
          value={inputVal}
          onChange={(e) => handleMinSessionsChange(e.target.value)}
          slotProps={{ htmlInput: { min: 1 } }}
          helperText={isMonthly ? `Defaults to 1 for monthly view` : `Defaults to 3 for All Time`}
        />
        {isAdmin && (
          <FormControlLabel
            sx={{ mt: 1, mx: 0 }}
            control={(
              <Switch
                size="small"
                checked={!showProfitableOnly}
                onChange={(e) => setShowProfitableOnly(!e.target.checked)}
              />
            )}
            label={<Typography variant="body2">Show all profit results</Typography>}
          />
        )}
      </Popover>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as number)}
        sx={{ mb: 2 }}
        textColor="primary"
        indicatorColor="primary"
        variant="fullWidth"
      >
        <Tab label="Profit" />
        <Tab label="ROI" />
        <Tab label="Active" />
      </Tabs>

      {minSessions > 1 && (
        <Typography variant="caption" color="primary.main" sx={{ display: 'block', mb: 1.5 }}>
          Showing players with {minSessions}+ sessions
        </Typography>
      )}
      {minSessions === 1 && minSessionsOverride === null && isMonthly && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Monthly view: showing all players with at least 1 session
        </Typography>
      )}

      {loading ? (
        <LinearProgress color="primary" />
      ) : currentBoard.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography color="text.secondary">
              {minSessions > 1 ? `No players with ${minSessions}+ sessions yet.` : 'No data yet. Play some sessions!'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {currentBoard.map((entry, idx) => (
            <Card
              key={entry.user_id}
              sx={{
                border: idx < 3 ? `1px solid ${RANK_COLORS[idx]}40` : '1px solid rgba(74,222,128,0.1)',
              }}
            >
              <CardActionArea onClick={() => navigate(`/player/${entry.user_id}`)}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ width: 28, color: idx < 3 ? RANK_COLORS[idx] : 'text.secondary', fontSize: idx < 3 ? '1.2rem' : '1rem' }}
                    >
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </Typography>
                    <Avatar
                      sx={{ bgcolor: idx < 3 ? RANK_COLORS[idx] : 'primary.dark', width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700, color: '#000' }}
                    >
                      {entry.display_name[0].toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>{entry.display_name}</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((Math.abs(entry.value) / maxVal) * 100, 100)}
                        sx={{
                          mt: 0.5,
                          '& .MuiLinearProgress-bar': {
                            bgcolor: tab !== 2 && entry.value < 0
                              ? 'error.main'
                              : (idx < 3 ? RANK_COLORS[idx] : 'primary.main'),
                          },
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          sx={{ color: tab === 2 ? 'text.primary' : entry.value >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {formatValue(entry.value, tab)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.sessions} sess.
                        </Typography>
                      </Box>
                      <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
